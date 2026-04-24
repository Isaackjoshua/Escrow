import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { verifySelcomWebhook } from '../services/selcom.service';
import { handlePaymentConfirmed } from './transaction.controller';
import { logger } from '../utils/logger';
import { z } from 'zod';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['x-selcom-signature'] as string;

  if (signature && !verifySelcomWebhook(rawBody, signature)) {
    logger.warn('Invalid Selcom webhook signature', { ip: req.ip });
    sendError(res, 'Invalid signature', 401);
    return;
  }

  const { order_id, payment_status, transid } = req.body;

  logger.info('Selcom webhook received', { order_id, payment_status, transid });

  try {
    if (payment_status === 'COMPLETED' || payment_status === 'SUCCESS') {
      await handlePaymentConfirmed(order_id);

      await prisma.transaction.update({
        where: { id: order_id },
        data: { selcomPaymentRef: transid },
      }).catch(() => null);
    } else if (payment_status === 'FAILED' || payment_status === 'CANCELLED') {
      logger.info('Payment failed/cancelled', { order_id, payment_status });
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error('Webhook processing error', { err });
    res.status(500).json({ status: 'error' });
  }
}

export async function getPaymentStatus(req: Request, res: Response): Promise<void> {
  const { transactionId } = req.params;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, status: true, selcomOrderId: true, selcomPaymentRef: true, amount: true },
  });

  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }

  const userId = req.user!.userId;
  const full = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { customerId: true, merchantId: true },
  });

  if (full?.customerId !== userId && full?.merchantId !== userId && req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden', 403);
    return;
  }

  sendSuccess(res, tx, 'Payment status retrieved');
}
