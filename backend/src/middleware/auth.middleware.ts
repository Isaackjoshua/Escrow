import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenBlacklisted } from '../utils/jwt';
import { sendError } from '../utils/response';
import { prisma } from '../config/database';
import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        phone: string;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Unauthorized — missing token', 401);
    return;
  }

  const token = authHeader.slice(7);

  try {
    if (await isTokenBlacklisted(token)) {
      sendError(res, 'Unauthorized — token revoked', 401);
      return;
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, phone: true, isActive: true },
    });

    if (!user || !user.isActive) {
      sendError(res, 'Unauthorized — account inactive', 401);
      return;
    }

    req.user = { userId: user.id, role: user.role, phone: user.phone };
    next();
  } catch {
    sendError(res, 'Unauthorized — invalid token', 401);
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, 'Forbidden — insufficient permissions', 403);
      return;
    }
    next();
  };
}
