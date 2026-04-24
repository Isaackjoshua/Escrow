import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { notifyBothParties, notifyUser } from '../services/notification.service';
import { uploadToS3, validateFileUpload } from '../services/s3.service';
import { env } from '../config/env';
import { z } from 'zod';
import multer from 'multer';

const raiseDisputeSchema = z.object({
  body: z.object({
    reason: z.string().min(20).max(2000),
    isFastTrack: z.coerce.boolean().default(false),
  }),
});

const resolveSchema = z.object({
  body: z.object({
    resolution: z.string().min(20).max(2000),
    action: z.enum(['RELEASE_TO_MERCHANT', 'REFUND_TO_CUSTOMER', 'SPLIT']),
    splitPercent: z.number().min(0).max(100).optional(),
  }),
});

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function raiseDispute(req: Request, res: Response): Promise<void> {
  const { id: transactionId } = req.params;
  const { reason, isFastTrack } = raiseDisputeSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }

  const isParty = tx.customerId === req.user!.userId || tx.merchantId === req.user!.userId;
  if (!isParty) {
    sendError(res, 'Only transaction parties can raise a dispute', 403);
    return;
  }

  if (tx.status !== 'HELD') {
    sendError(res, 'Disputes can only be raised on HELD transactions', 400);
    return;
  }

  const existingOpen = await prisma.dispute.findFirst({
    where: { transactionId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
  });
  if (existingOpen) {
    sendError(res, 'A dispute is already open for this transaction', 400);
    return;
  }

  const dispute = await prisma.$transaction(async (prismaTx) => {
    const d = await prismaTx.dispute.create({
      data: {
        transactionId,
        raisedBy: req.user!.userId,
        reason,
        isFastTrack,
        evidenceUrls: [],
      },
    });

    await prismaTx.transaction.update({ where: { id: transactionId }, data: { status: 'DISPUTED' } });

    await prismaTx.auditLog.create({
      data: {
        transactionId,
        action: 'DISPUTE_RAISED',
        actorId: req.user!.userId,
        ipAddress: req.ip,
        metadata: { disputeId: d.id, isFastTrack },
      },
    });

    return d;
  });

  const otherPartyId = tx.customerId === req.user!.userId ? tx.merchantId : tx.customerId;
  await notifyBothParties(
    req.user!.userId,
    otherPartyId,
    `Your dispute for transaction ${transactionId.slice(0, 8)} has been submitted. Our team will review within ${isFastTrack ? '24 hours' : '5-7 days'}.`,
    `A dispute has been raised for transaction ${transactionId.slice(0, 8)}. Funds are frozen pending review.`,
    'DISPUTE',
    { disputeId: dispute.id }
  );

  sendSuccess(res, dispute, 'Dispute raised. Funds are frozen pending resolution.', 201);
}

export async function uploadEvidence(req: Request, res: Response): Promise<void> {
  const { disputeId } = req.params;

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { transaction: true },
  });

  if (!dispute) {
    sendError(res, 'Dispute not found', 404);
    return;
  }

  const isParty =
    dispute.transaction.customerId === req.user!.userId ||
    dispute.transaction.merchantId === req.user!.userId;

  if (!isParty) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  if (dispute.status === 'RESOLVED') {
    sendError(res, 'Cannot upload evidence to a resolved dispute', 400);
    return;
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    sendError(res, 'No files uploaded', 400);
    return;
  }

  const uploadedUrls: string[] = [];
  for (const file of files.slice(0, 5)) {
    validateFileUpload(file.mimetype, file.size);
    const url = await uploadToS3(file.buffer, file.originalname, file.mimetype, `disputes/${disputeId}`);
    uploadedUrls.push(url);
  }

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: { evidenceUrls: { push: uploadedUrls } },
  });

  await prisma.auditLog.create({
    data: {
      transactionId: dispute.transactionId,
      action: 'EVIDENCE_UPLOADED',
      actorId: req.user!.userId,
      metadata: { disputeId, count: uploadedUrls.length },
    },
  });

  sendSuccess(res, { urls: uploadedUrls, dispute: updated }, 'Evidence uploaded.');
}

export async function listDisputes(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const status = req.query.status as string | undefined;
  const skip = (page - 1) * limit;

  const isAdmin = req.user!.role === 'ADMIN';
  const userId = req.user!.userId;

  const where = isAdmin
    ? status ? { status: status as any } : {}
    : {
        OR: [
          { raisedBy: userId },
          { transaction: { customerId: userId } },
          { transaction: { merchantId: userId } },
        ],
        ...(status ? { status: status as any } : {}),
      };

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          select: { id: true, amount: true, currency: true, customerId: true, merchantId: true },
        },
        raiser: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.dispute.count({ where }),
  ]);

  sendPaginated(res, disputes, total, page, limit, 'Disputes retrieved');
}

export async function resolveDispute(req: Request, res: Response): Promise<void> {
  const { disputeId } = req.params;
  const { resolution, action, splitPercent } = resolveSchema.parse({ body: req.body }).body;

  if (req.user!.role !== 'ADMIN') {
    sendError(res, 'Only admins can resolve disputes', 403);
    return;
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      transaction: {
        include: {
          customer: { select: { id: true, phone: true } },
          merchant: { select: { id: true, phone: true } },
        },
      },
    },
  });

  if (!dispute) {
    sendError(res, 'Dispute not found', 404);
    return;
  }

  if (dispute.status === 'RESOLVED') {
    sendError(res, 'Dispute already resolved', 400);
    return;
  }

  const tx = dispute.transaction;
  const totalAmount = Number(tx.amount);
  let merchantAmount = 0;
  let customerAmount = 0;

  if (action === 'RELEASE_TO_MERCHANT') {
    merchantAmount = totalAmount - Number(tx.platformFee);
  } else if (action === 'REFUND_TO_CUSTOMER') {
    customerAmount = totalAmount;
  } else if (action === 'SPLIT') {
    const merchantPercent = splitPercent ?? 50;
    merchantAmount = Math.round((totalAmount * merchantPercent) / 100);
    customerAmount = totalAmount - merchantAmount;
  }

  const newTxStatus = action === 'REFUND_TO_CUSTOMER' ? 'REFUNDED' : 'RELEASED';

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedBy: req.user!.userId,
        resolvedAt: new Date(),
      },
    });

    await prismaTx.transaction.update({
      where: { id: tx.id },
      data: { status: newTxStatus, releasedAt: new Date() },
    });

    await prismaTx.auditLog.create({
      data: {
        transactionId: tx.id,
        action: 'DISPUTE_RESOLVED',
        actorId: req.user!.userId,
        metadata: { disputeId, action, merchantAmount, customerAmount, resolution },
      },
    });
  });

  await notifyBothParties(
    tx.customerId,
    tx.merchantId,
    `Dispute for transaction ${tx.id.slice(0, 8)} resolved. ${action === 'REFUND_TO_CUSTOMER' ? `TZS ${customerAmount.toLocaleString()} refunded to you.` : `Funds released to merchant.`}`,
    `Dispute for transaction ${tx.id.slice(0, 8)} resolved. ${action === 'RELEASE_TO_MERCHANT' ? `TZS ${merchantAmount.toLocaleString()} released to you.` : `Customer refunded.`}`,
    'DISPUTE',
    { disputeId }
  );

  sendSuccess(res, null, 'Dispute resolved successfully.');
}
