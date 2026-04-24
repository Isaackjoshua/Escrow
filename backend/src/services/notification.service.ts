import { prisma } from '../config/database';
import { NotificationType } from '@prisma/client';
import { sendSms } from './sms.service';
import { logger } from '../utils/logger';

export async function createNotification(
  userId: string,
  message: string,
  type: NotificationType = 'SYSTEM',
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: { userId, message, type, metadata },
  });
}

export async function notifyUser(
  userId: string,
  message: string,
  type: NotificationType,
  sendSmsFlag = true,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createNotification(userId, message, type, metadata);

  if (sendSmsFlag) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (user) {
      await sendSms(user.phone, message).catch((err) =>
        logger.error('Failed to send notification SMS', { userId, err })
      );
    }
  }
}

export async function notifyBothParties(
  customerId: string,
  merchantId: string,
  customerMessage: string,
  merchantMessage: string,
  type: NotificationType,
  metadata?: Record<string, unknown>
): Promise<void> {
  await Promise.all([
    notifyUser(customerId, customerMessage, type, true, metadata),
    notifyUser(merchantId, merchantMessage, type, true, metadata),
  ]);
}
