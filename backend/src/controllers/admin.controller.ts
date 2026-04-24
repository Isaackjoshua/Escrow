import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { z } from 'zod';

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const [
    totalTransactions,
    totalVolume,
    disputeCount,
    pendingKyc,
    transactionsByStatus,
    recentTransactions,
    platformRevenue,
  ] = await Promise.all([
    prisma.transaction.count(),
    prisma.transaction.aggregate({ _sum: { amount: true } }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.transaction.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, phone: true } },
        merchant: { select: { name: true, phone: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: { status: 'RELEASED' },
      _sum: { platformFee: true },
    }),
  ]);

  const completedTransactions = transactionsByStatus.find((s) => s.status === 'RELEASED');
  const disputeRate = totalTransactions > 0 ? (disputeCount / totalTransactions) * 100 : 0;
  const avgValue = totalTransactions > 0
    ? Number(totalVolume._sum.amount ?? 0) / totalTransactions
    : 0;

  sendSuccess(res, {
    totalTransactions,
    totalVolume: Number(totalVolume._sum.amount ?? 0),
    openDisputes: disputeCount,
    pendingKyc,
    platformRevenue: Number(platformRevenue._sum.platformFee ?? 0),
    disputeRate: parseFloat(disputeRate.toFixed(2)),
    averageTransactionValue: Math.round(avgValue),
    transactionsByStatus: transactionsByStatus.map((s) => ({
      status: s.status,
      count: s._count._all,
      volume: Number(s._sum.amount ?? 0),
    })),
    recentTransactions,
  }, 'Dashboard stats retrieved');
}

export async function getDisputeQueue(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const skip = (page - 1) * limit;

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      skip,
      take: limit,
      orderBy: [{ isFastTrack: 'desc' }, { createdAt: 'asc' }],
      include: {
        raiser: { select: { id: true, name: true, phone: true } },
        transaction: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            merchant: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
  ]);

  sendPaginated(res, disputes, total, page, limit, 'Dispute queue retrieved');
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const skip = (page - 1) * limit;
  const role = req.query.role as string | undefined;
  const kycStatus = req.query.kycStatus as string | undefined;
  const search = req.query.search as string | undefined;

  const where = {
    ...(role ? { role: role as any } : {}),
    ...(kycStatus ? { kycStatus: kycStatus as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, email: true,
        role: true, kycStatus: true, isActive: true, createdAt: true,
        _count: { select: { customerTransactions: true, merchantTransactions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  sendPaginated(res, users, total, page, limit, 'Users retrieved');
}

export async function updateKycStatus(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { status } = z
    .object({ body: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }) })
    .parse({ body: req.body }).body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });

  await prisma.notification.create({
    data: {
      userId,
      message: status === 'APPROVED'
        ? 'Your KYC has been approved. You can now receive escrow payments.'
        : 'Your KYC has been rejected. Please contact support for details.',
      type: 'SYSTEM',
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'KYC_STATUS_UPDATED',
      actorId: req.user!.userId,
      metadata: { targetUserId: userId, status },
    },
  });

  sendSuccess(res, null, `KYC status updated to ${status}`);
}

export async function toggleUserStatus(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  if (user.role === 'ADMIN') {
    sendError(res, 'Cannot suspend admin accounts', 400);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: { id: true, name: true, isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      action: updated.isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_SUSPENDED',
      actorId: req.user!.userId,
      metadata: { targetUserId: userId },
    },
  });

  sendSuccess(res, updated, `User ${updated.isActive ? 'activated' : 'suspended'} successfully`);
}

export async function adminReleaseFunds(req: Request, res: Response): Promise<void> {
  const { transactionId } = req.params;
  const { action, reason } = z.object({
    body: z.object({
      action: z.enum(['RELEASE', 'REFUND']),
      reason: z.string().min(10),
    }),
  }).parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      customer: { select: { id: true } },
      merchant: { select: { id: true } },
    },
  });

  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }
  if (tx.status !== 'HELD' && tx.status !== 'DISPUTED') {
    sendError(res, 'Transaction cannot be manually released in its current status', 400);
    return;
  }

  const newStatus = action === 'RELEASE' ? 'RELEASED' : 'REFUNDED';

  await prisma.$transaction(async (prismaTx) => {
    await prismaTx.transaction.update({
      where: { id: transactionId },
      data: { status: newStatus, releasedAt: new Date() },
    });

    await prismaTx.auditLog.create({
      data: {
        transactionId,
        action: `ADMIN_${action}`,
        actorId: req.user!.userId,
        metadata: { reason },
      },
    });
  });

  sendSuccess(res, null, `Transaction ${action.toLowerCase()}d by admin.`);
}
