import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { generateOtp, storeOtp, verifyOtp } from '../utils/otp';
import { sendOtpSms, sendTransactionNotification } from '../services/sms.service';
import { notifyBothParties, notifyUser } from '../services/notification.service';
import { calculatePlatformFee } from '../utils/currency';
import { env } from '../config/env';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const createTxSchema = z.object({
  body: z.object({
    merchantPhone: z.string().regex(/^(\+?255|0)[67]\d{8}$/),
    amount: z.number().positive().min(1000, 'Minimum transaction is TZS 1,000'),
    agreementDescription: z.string().min(20).max(2000),
    inspectionWindowHours: z.number().min(1).max(168).default(48),
    productPhotos: z.array(z.string().url()).max(5).default([]),
  }),
});

const releaseSchema = z.object({
  body: z.object({ otp: z.string().length(6) }),
});

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  return `+255${digits}`;
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const { merchantPhone, amount, agreementDescription, inspectionWindowHours, productPhotos } =
    createTxSchema.parse({ body: req.body }).body;

  const merchant = await prisma.user.findUnique({
    where: { phone: normalizePhone(merchantPhone) },
    select: { id: true, name: true, phone: true, role: true, kycStatus: true },
  });

  if (!merchant || merchant.role !== 'MERCHANT') {
    sendError(res, 'Merchant not found or not registered as a merchant', 404);
    return;
  }

  if (merchant.kycStatus !== 'APPROVED') {
    sendError(res, 'Merchant KYC verification is not yet approved', 400);
    return;
  }

  if (merchant.id === req.user!.userId) {
    sendError(res, 'You cannot create a transaction with yourself', 400);
    return;
  }

  const platformFee = calculatePlatformFee(amount, env.PLATFORM_FEE_PERCENT);

  const transaction = await prisma.transaction.create({
    data: {
      customerId: req.user!.userId,
      merchantId: merchant.id,
      amount: new Decimal(amount),
      platformFee: new Decimal(platformFee),
      agreementDescription,
      inspectionWindowHours,
      productPhotos,
      status: 'PENDING',
    },
    include: {
      customer: { select: { name: true, phone: true } },
      merchant: { select: { name: true, phone: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      transactionId: transaction.id,
      action: 'TRANSACTION_CREATED',
      actorId: req.user!.userId,
      ipAddress: req.ip,
      metadata: { amount, merchantId: merchant.id },
    },
  });

  await notifyBothParties(
    req.user!.userId,
    merchant.id,
    `New escrow transaction of TZS ${amount.toLocaleString()} created with ${merchant.name}. Transaction ID: ${transaction.id.slice(0, 8)}`,
    `New escrow transaction of TZS ${amount.toLocaleString()} initiated by ${transaction.customer.name}. Review and confirm the terms.`,
    'TRANSACTION',
    { transactionId: transaction.id }
  );

  sendSuccess(res, transaction, 'Transaction created. Both parties will be notified to confirm terms.', 201);
}

export async function getTransaction(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      merchant: { select: { id: true, name: true, phone: true } },
      milestones: { orderBy: { order: 'asc' } },
      disputes: { orderBy: { createdAt: 'desc' } },
      delivery: true,
      ratings: true,
    },
  });

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

  sendSuccess(res, tx, 'Transaction retrieved');
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const status = req.query.status as string | undefined;
  const skip = (page - 1) * limit;

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN';

  const where = isAdmin
    ? status ? { status: status as any } : {}
    : {
        OR: [{ customerId: userId }, { merchantId: userId }],
        ...(status ? { status: status as any } : {}),
      };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        merchant: { select: { id: true, name: true, phone: true } },
        _count: { select: { disputes: true, milestones: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  sendPaginated(res, transactions, total, page, limit, 'Transactions retrieved');
}

export async function initiateDeposit(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.customerId !== req.user!.userId) {
    sendError(res, 'Only the customer can deposit funds', 403);
    return;
  }
  if (tx.status !== 'PENDING') {
    sendError(res, 'Transaction is not in PENDING status', 400);
    return;
  }

  const otp = generateOtp();
  await storeOtp(req.user!.phone, otp, 'deposit');
  await sendOtpSms(req.user!.phone, otp, 'deposit');

  sendSuccess(res, { transactionId: id }, 'Deposit OTP sent. Verify to proceed with payment.');
}

export async function verifyDepositOtp(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { otp } = releaseSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.customerId !== req.user!.userId) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.status !== 'PENDING') {
    sendError(res, 'Transaction is not in PENDING status', 400);
    return;
  }

  const isValid = await verifyOtp(req.user!.phone, otp, 'deposit');
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  // In production: trigger Selcom payment here and update once webhook confirms
  // For now: move to HELD (sandbox: treat OTP verification as payment confirmation)
  const { initiateSelcomPayment } = await import('../services/selcom.service');
  const amountNumber = Number(tx.amount);

  const { orderId } = await initiateSelcomPayment({
    vendor: env.SELCOM_VENDOR_ID,
    order_id: tx.id,
    buyer_name: 'Customer',
    buyer_phone: req.user!.phone,
    amount: amountNumber,
    currency: 'TZS',
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/transactions/${tx.id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/transactions/${tx.id}`,
    webhook: `${process.env.NEXT_PUBLIC_API_URL}/payments/webhook`,
  });

  await prisma.transaction.update({
    where: { id },
    data: { selcomOrderId: orderId, otpVerified: true },
  });

  sendSuccess(res, { orderId }, 'Payment initiated. Complete payment via mobile money.');
}

export async function handlePaymentConfirmed(transactionId: string): Promise<void> {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx || tx.status !== 'PENDING') return;

  const inspectionDeadline = new Date();
  inspectionDeadline.setHours(inspectionDeadline.getHours() + tx.inspectionWindowHours);

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.transaction.update({
      where: { id: transactionId },
      data: { status: 'HELD', inspectionDeadline },
    });

    await prismaTx.auditLog.create({
      data: {
        transactionId,
        action: 'FUNDS_DEPOSITED',
        actorId: tx.customerId,
        metadata: { amount: tx.amount.toString() },
      },
    });
  });

  const [customer, merchant] = await Promise.all([
    prisma.user.findUnique({ where: { id: tx.customerId }, select: { phone: true } }),
    prisma.user.findUnique({ where: { id: tx.merchantId }, select: { phone: true } }),
  ]);

  await Promise.all([
    sendTransactionNotification(customer!.phone, 'deposit_confirmed', {
      amount: tx.amount.toString(),
      txId: transactionId.slice(0, 8),
    }),
    sendTransactionNotification(merchant!.phone, 'merchant_notified', {
      amount: tx.amount.toString(),
      txId: transactionId.slice(0, 8),
    }),
  ]);
}

export async function confirmDelivery(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { otp } = releaseSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: { delivery: true },
  });

  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.status !== 'HELD') {
    sendError(res, 'Transaction funds are not in escrow', 400);
    return;
  }

  const isValid = await verifyOtp(req.user!.phone, otp, 'delivery');
  if (!isValid) {
    sendError(res, 'Invalid or expired delivery OTP', 400);
    return;
  }

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.delivery.upsert({
      where: { transactionId: id },
      create: { transactionId: id, otpCode: otp, confirmedAt: new Date() },
      update: { confirmedAt: new Date() },
    });

    await prismaTx.auditLog.create({
      data: {
        transactionId: id,
        action: 'DELIVERY_CONFIRMED',
        actorId: req.user!.userId,
        ipAddress: req.ip,
      },
    });
  });

  sendSuccess(res, null, 'Delivery confirmed. You can now release funds or wait for the inspection window.');
}

export async function releaseFunds(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { otp } = releaseSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: {
      merchant: { select: { id: true, name: true, phone: true } },
      customer: { select: { id: true, phone: true } },
    },
  });

  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.customerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    sendError(res, 'Only the customer or admin can release funds', 403);
    return;
  }
  if (tx.status !== 'HELD') {
    sendError(res, 'Funds are not in escrow', 400);
    return;
  }

  const isValid = await verifyOtp(req.user!.phone, otp, 'release');
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  const amountToRelease = Number(tx.amount) - Number(tx.platformFee);

  // In production: trigger Selcom disbursement here
  const { initiateSelcomDisbursement } = await import('../services/selcom.service');
  await initiateSelcomDisbursement({
    transid: `RELEASE-${tx.id}`,
    msisdn: tx.merchant.phone,
    vendor: env.SELCOM_VENDOR_ID,
    pin: '',
    amount: amountToRelease,
    currency: 'TZS',
    utilityref: tx.id,
    network: 'MPESA',
  });

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.transaction.update({
      where: { id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await prismaTx.auditLog.create({
      data: {
        transactionId: id,
        action: 'FUNDS_RELEASED',
        actorId: req.user!.userId,
        ipAddress: req.ip,
        metadata: { amountReleased: amountToRelease, merchantId: tx.merchantId },
      },
    });
  });

  await notifyBothParties(
    tx.customerId,
    tx.merchantId,
    `Funds of TZS ${amountToRelease.toLocaleString()} released to merchant. Transaction ${id.slice(0, 8)} complete.`,
    `TZS ${amountToRelease.toLocaleString()} has been released to your mobile money account. Transaction complete!`,
    'PAYMENT',
    { transactionId: id }
  );

  sendSuccess(res, null, 'Funds released to merchant successfully.');
}

export async function cancelTransaction(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }

  const isParty = tx.customerId === req.user!.userId || req.user!.role === 'ADMIN';
  if (!isParty) {
    sendError(res, 'Forbidden', 403);
    return;
  }

  if (!['PENDING'].includes(tx.status)) {
    sendError(res, 'Only PENDING transactions can be cancelled', 400);
    return;
  }

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.transaction.update({ where: { id }, data: { status: 'CANCELLED' } });
    await prismaTx.auditLog.create({
      data: {
        transactionId: id,
        action: 'TRANSACTION_CANCELLED',
        actorId: req.user!.userId,
        ipAddress: req.ip,
      },
    });
  });

  sendSuccess(res, null, 'Transaction cancelled.');
}
