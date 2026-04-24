import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { generateOtp, storeOtp, verifyOtp } from '../utils/otp';
import { sendOtpSms } from '../services/sms.service';
import { notifyUser } from '../services/notification.service';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const createMilestonesSchema = z.object({
  body: z.object({
    milestones: z
      .array(
        z.object({
          title: z.string().min(3).max(100),
          description: z.string().min(10).max(500),
          amount: z.number().positive(),
          order: z.number().int().min(0).default(0),
        })
      )
      .min(2, 'At least 2 milestones required'),
  }),
});

export async function createMilestones(req: Request, res: Response): Promise<void> {
  const { id: transactionId } = req.params;
  const { milestones } = createMilestonesSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.merchantId !== req.user!.userId) {
    sendError(res, 'Only the merchant can create milestones', 403);
    return;
  }
  if (tx.status !== 'HELD') {
    sendError(res, 'Milestones can only be created after funds are in escrow', 400);
    return;
  }

  const totalMilestoneAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  if (Math.abs(totalMilestoneAmount - Number(tx.amount)) > 1) {
    sendError(res, `Milestone amounts must sum to TZS ${tx.amount} (got TZS ${totalMilestoneAmount})`, 400);
    return;
  }

  const existing = await prisma.milestone.count({ where: { transactionId } });
  if (existing > 0) {
    sendError(res, 'Milestones already exist for this transaction', 400);
    return;
  }

  const created = await prisma.milestone.createMany({
    data: milestones.map((m) => ({
      transactionId,
      title: m.title,
      description: m.description,
      amount: new Decimal(m.amount),
      order: m.order,
    })),
  });

  await prisma.auditLog.create({
    data: {
      transactionId,
      action: 'MILESTONES_CREATED',
      actorId: req.user!.userId,
      metadata: { count: created.count },
    },
  });

  await notifyUser(
    tx.customerId,
    `Merchant has proposed ${milestones.length} milestones for your transaction. Review them in your dashboard.`,
    'TRANSACTION',
    true,
    { transactionId }
  );

  const all = await prisma.milestone.findMany({
    where: { transactionId },
    orderBy: { order: 'asc' },
  });

  sendSuccess(res, all, 'Milestones created', 201);
}

export async function listMilestones(req: Request, res: Response): Promise<void> {
  const { id: transactionId } = req.params;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }

  const userId = req.user!.userId;
  const isParty = tx.customerId === userId || tx.merchantId === userId || req.user!.role === 'ADMIN';
  if (!isParty) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  const milestones = await prisma.milestone.findMany({
    where: { transactionId },
    orderBy: { order: 'asc' },
  });

  sendSuccess(res, milestones, 'Milestones retrieved');
}

export async function requestMilestoneOtp(req: Request, res: Response): Promise<void> {
  const { milestoneId } = req.params;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { transaction: true },
  });

  if (!milestone) {
    sendError(res, 'Milestone not found', 404);
    return;
  }
  if (milestone.transaction.customerId !== req.user!.userId) {
    sendError(res, 'Only the customer can confirm milestones', 403);
    return;
  }
  if (milestone.status !== 'IN_PROGRESS') {
    sendError(res, 'Milestone is not in progress', 400);
    return;
  }

  const otp = generateOtp();
  await storeOtp(req.user!.phone, otp, 'milestone');
  await sendOtpSms(req.user!.phone, otp, 'milestone');

  sendSuccess(res, null, 'OTP sent. Enter it to confirm milestone completion.');
}

export async function confirmMilestone(req: Request, res: Response): Promise<void> {
  const { milestoneId } = req.params;
  const { otp } = z.object({ body: z.object({ otp: z.string().length(6) }) }).parse({ body: req.body }).body;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      transaction: {
        include: { merchant: { select: { phone: true, id: true } } },
      },
    },
  });

  if (!milestone) {
    sendError(res, 'Milestone not found', 404);
    return;
  }
  if (milestone.transaction.customerId !== req.user!.userId) {
    sendError(res, 'Only the customer can confirm milestones', 403);
    return;
  }

  const isValid = await verifyOtp(req.user!.phone, otp, 'milestone');
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  const updatedMilestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: 'COMPLETED', confirmedAt: new Date(), otpVerified: true },
  });

  await prisma.auditLog.create({
    data: {
      transactionId: milestone.transactionId,
      action: 'MILESTONE_CONFIRMED',
      actorId: req.user!.userId,
      metadata: { milestoneId, amount: milestone.amount.toString() },
    },
  });

  // Check if all milestones are complete
  const allMilestones = await prisma.milestone.findMany({
    where: { transactionId: milestone.transactionId },
  });
  const allDone = allMilestones.every((m) => m.status === 'COMPLETED');

  if (allDone) {
    await notifyUser(
      milestone.transaction.merchantId,
      `All milestones confirmed! Requesting fund release OTP for transaction ${milestone.transactionId.slice(0, 8)}.`,
      'PAYMENT',
      true
    );
  } else {
    const next = allMilestones.find((m) => m.status === 'PENDING' && m.order > milestone.order);
    if (next) {
      await prisma.milestone.update({ where: { id: next.id }, data: { status: 'IN_PROGRESS' } });
      await notifyUser(
        milestone.transaction.merchantId,
        `Milestone "${milestone.title}" confirmed. Next milestone unlocked: "${next.title}"`,
        'TRANSACTION',
        true
      );
    }
  }

  sendSuccess(res, updatedMilestone, 'Milestone confirmed.');
}
