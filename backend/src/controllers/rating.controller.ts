import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const submitSchema = z.object({
  body: z.object({
    transactionId: z.string().uuid(),
    ratedUserId: z.string().uuid(),
    score: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  }),
});

export async function submitRating(req: Request, res: Response): Promise<void> {
  const { transactionId, ratedUserId, score, comment } = submitSchema.parse({ body: req.body }).body;

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) {
    sendError(res, 'Transaction not found', 404);
    return;
  }

  if (tx.status !== 'RELEASED' && tx.status !== 'REFUNDED') {
    sendError(res, 'Ratings can only be submitted for completed transactions', 400);
    return;
  }

  const isParty = tx.customerId === req.user!.userId || tx.merchantId === req.user!.userId;
  if (!isParty) {
    sendError(res, 'Only transaction parties can submit ratings', 403);
    return;
  }

  const isRatingParty = ratedUserId === tx.customerId || ratedUserId === tx.merchantId;
  if (!isRatingParty || ratedUserId === req.user!.userId) {
    sendError(res, 'Invalid rating target', 400);
    return;
  }

  const existing = await prisma.rating.findUnique({
    where: { transactionId_ratedBy: { transactionId, ratedBy: req.user!.userId } },
  });
  if (existing) {
    sendError(res, 'You have already rated this transaction', 400);
    return;
  }

  const rating = await prisma.rating.create({
    data: {
      transactionId,
      ratedBy: req.user!.userId,
      ratedUser: ratedUserId,
      score,
      comment,
    },
  });

  // Check if merchant falls below 3.0 average — trigger admin review
  if (ratedUserId === tx.merchantId) {
    const avgResult = await prisma.rating.aggregate({
      where: { ratedUser: ratedUserId },
      _avg: { score: true },
      _count: true,
    });

    if (avgResult._avg.score !== null && avgResult._avg.score < 3.0 && avgResult._count >= 3) {
      await prisma.notification.create({
        data: {
          userId: ratedUserId,
          message: `Warning: Your average rating has dropped below 3.0. Admin review has been triggered.`,
          type: 'SYSTEM',
        },
      });
      // Notify admin (find first admin user)
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            message: `Merchant ${ratedUserId} has fallen below 3.0 average rating (${avgResult._avg.score?.toFixed(1)}). Review required.`,
            type: 'SYSTEM',
            metadata: { merchantId: ratedUserId, avgRating: avgResult._avg.score },
          },
        });
      }
    }
  }

  sendSuccess(res, rating, 'Rating submitted.', 201);
}

export async function getUserRatings(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const [ratings, aggregate] = await Promise.all([
    prisma.rating.findMany({
      where: { ratedUser: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        rater: { select: { id: true, name: true } },
        transaction: { select: { id: true, amount: true, currency: true } },
      },
    }),
    prisma.rating.aggregate({
      where: { ratedUser: userId },
      _avg: { score: true },
      _count: true,
    }),
  ]);

  sendSuccess(res, {
    ratings,
    averageScore: aggregate._avg.score ?? 0,
    totalRatings: aggregate._count,
  }, 'Ratings retrieved');
}
