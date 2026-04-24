import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user!.userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { userId: req.user!.userId } }),
  ]);

  sendPaginated(res, notifications, total, page, limit, 'Notifications retrieved');
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (id === 'all') {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, read: false },
      data: { read: true },
    });
    sendSuccess(res, null, 'All notifications marked as read');
    return;
  }

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user!.userId) {
    sendError(res, 'Notification not found', 404);
    return;
  }

  await prisma.notification.update({ where: { id }, data: { read: true } });
  sendSuccess(res, null, 'Notification marked as read');
}

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const count = await prisma.notification.count({
    where: { userId: req.user!.userId, read: false },
  });
  sendSuccess(res, { count }, 'Unread count retrieved');
}
