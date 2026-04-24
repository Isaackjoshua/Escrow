import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { generateOtp, storeOtp } from '../utils/otp';
import { sendTransactionNotification } from '../services/sms.service';
import { uploadToS3, validateFileUpload } from '../services/s3.service';
import { z } from 'zod';

const logDeliverySchema = z.object({
  body: z.object({
    courierName: z.string().optional(),
    trackingNumber: z.string().optional(),
  }),
});

export async function logDelivery(req: Request, res: Response): Promise<void> {
  const { id: transactionId } = req.params;
  const { courierName, trackingNumber } = logDeliverySchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { customer: { select: { id: true, phone: true } } },
  });

  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.merchantId !== req.user!.userId) {
    sendError(res, 'Only the merchant can log delivery', 403);
    return;
  }
  if (tx.status !== 'HELD') {
    sendError(res, 'Transaction must be in HELD status', 400);
    return;
  }

  const otp = generateOtp();
  await storeOtp(tx.customer.phone, otp, 'delivery');

  let photoUrl: string | undefined;
  if (req.file) {
    validateFileUpload(req.file.mimetype, req.file.size);
    photoUrl = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      `deliveries/${transactionId}`
    );
  }

  const delivery = await prisma.delivery.upsert({
    where: { transactionId },
    create: {
      transactionId,
      courierName,
      trackingNumber,
      otpCode: otp,
      deliveryPhotoUrl: photoUrl,
      deliveredAt: new Date(),
    },
    update: {
      courierName,
      trackingNumber,
      otpCode: otp,
      deliveryPhotoUrl: photoUrl,
      deliveredAt: new Date(),
    },
  });

  // Send delivery OTP to customer
  await sendTransactionNotification(tx.customer.phone, 'delivery_otp', {
    txId: transactionId.slice(0, 8),
    otp,
  });

  await prisma.auditLog.create({
    data: {
      transactionId,
      action: 'DELIVERY_LOGGED',
      actorId: req.user!.userId,
      metadata: { courierName, trackingNumber },
    },
  });

  sendSuccess(res, { deliveryId: delivery.id }, 'Delivery logged. OTP sent to customer.');
}

export async function verifyDeliveryOtp(req: Request, res: Response): Promise<void> {
  const { id: transactionId } = req.params;
  const { otp } = z
    .object({ body: z.object({ otp: z.string().length(6) }) })
    .parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { delivery: true, customer: { select: { phone: true } } },
  });

  if (!tx || !tx.delivery) {
    sendError(res, 'Transaction or delivery not found', 404);
    return;
  }

  if (tx.status !== 'HELD') {
    sendError(res, 'Transaction is not in HELD status', 400);
    return;
  }

  // Merchant or courier enters OTP on delivery
  if (tx.merchantId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    sendError(res, 'Only the merchant can verify the delivery OTP', 403);
    return;
  }

  const { verifyOtp } = await import('../utils/otp');
  const isValid = await verifyOtp(tx.customer.phone, otp, 'delivery');
  if (!isValid) {
    sendError(res, 'Invalid or expired delivery OTP', 400);
    return;
  }

  await prisma.delivery.update({
    where: { transactionId },
    data: { confirmedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      transactionId,
      action: 'DELIVERY_OTP_VERIFIED',
      actorId: req.user!.userId,
      ipAddress: req.ip,
    },
  });

  sendSuccess(res, null, 'Delivery confirmed. Customer can now release funds.');
}
