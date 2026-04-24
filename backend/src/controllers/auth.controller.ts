import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { signAccessToken, signRefreshToken, verifyRefreshToken, blacklistToken } from '../utils/jwt';
import { generateOtp, storeOtp, verifyOtp } from '../utils/otp';
import { sendOtpSms } from '../services/sms.service';
import { createNotification } from '../services/notification.service';
import { env } from '../config/env';
import { z } from 'zod';

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().regex(/^(\+?255|0)[67]\d{8}$/, 'Invalid Tanzanian phone number'),
    email: z.string().email().optional(),
    password: z.string().min(8).max(100),
    role: z.enum(['CUSTOMER', 'MERCHANT']).default('CUSTOMER'),
    nationalId: z.string().optional(),
    brelaNumber: z.string().optional(),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(9),
    otp: z.string().length(6),
    purpose: z.enum(['register', 'login', 'deposit', 'release', 'milestone', 'delivery']),
  }),
});

const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(9),
    password: z.string().min(1),
  }),
});

const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string() }),
});

export async function register(req: Request, res: Response): Promise<void> {
  const { name, phone, email, password, role, nationalId, brelaNumber } = registerSchema.parse({
    body: req.body,
  }).body;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    sendError(res, 'Phone number already registered', 409);
    return;
  }

  if (email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      sendError(res, 'Email already registered', 409);
      return;
    }
  }

  if (role === 'MERCHANT' && !brelaNumber) {
    sendError(res, 'BRELA registration number required for merchant accounts', 400);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const otp = generateOtp();

  // Store pending registration in Redis until OTP verified
  const { redis } = await import('../config/redis');
  const pendingKey = `pending_reg:${phone}`;
  await redis.setex(
    pendingKey,
    env.OTP_EXPIRY_MINUTES * 60,
    JSON.stringify({ name, phone, email, hashedPassword, role, nationalId, brelaNumber })
  );

  await storeOtp(phone, otp, 'register');
  await sendOtpSms(phone, otp, 'register');

  sendSuccess(res, { phone }, 'OTP sent to your phone number. Please verify to complete registration.', 200);
}

export async function verifyRegistrationOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp } = verifyOtpSchema.parse({ body: req.body }).body;

  const isValid = await verifyOtp(phone, otp, 'register');
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  const { redis } = await import('../config/redis');
  const pendingKey = `pending_reg:${phone}`;
  const pendingData = await redis.get(pendingKey);

  if (!pendingData) {
    sendError(res, 'Registration session expired. Please register again.', 400);
    return;
  }

  const { name, email, hashedPassword, role, nationalId, brelaNumber } = JSON.parse(pendingData);

  const user = await prisma.user.create({
    data: { name, phone, email, hashedPassword, role, nationalId, brelaNumber },
    select: { id: true, name: true, phone: true, email: true, role: true, kycStatus: true, createdAt: true },
  });

  await redis.del(pendingKey);

  await createNotification(user.id, `Welcome to Escrow255, ${name}! Your account has been created.`, 'SYSTEM');

  const accessToken = signAccessToken({ userId: user.id, role: user.role, phone: user.phone });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, phone: user.phone });

  sendSuccess(res, { user, accessToken, refreshToken }, 'Registration successful', 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { phone, password } = loginSchema.parse({ body: req.body }).body;

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
    sendError(res, 'Invalid phone number or password', 401);
    return;
  }

  if (!user.isActive) {
    sendError(res, 'Your account has been suspended. Please contact support.', 403);
    return;
  }

  const otp = generateOtp();
  await storeOtp(phone, otp, 'login');
  await sendOtpSms(phone, otp, 'login');

  sendSuccess(res, { phone }, 'OTP sent to your phone. Enter it to complete login.');
}

export async function verifyLoginOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp } = verifyOtpSchema.parse({ body: req.body }).body;

  const isValid = await verifyOtp(phone, otp, 'login');
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, name: true, phone: true, email: true, role: true, kycStatus: true },
  });

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role, phone: user.phone });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, phone: user.phone });

  await prisma.auditLog.create({
    data: {
      action: 'USER_LOGIN',
      actorId: user.id,
      ipAddress: req.ip,
      metadata: { userAgent: req.headers['user-agent'] },
    },
  });

  sendSuccess(res, { user, accessToken, refreshToken }, 'Login successful');
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = refreshSchema.parse({ body: req.body }).body;

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, phone: true, isActive: true },
    });

    if (!user || !user.isActive) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role, phone: user.phone });
    sendSuccess(res, { accessToken }, 'Token refreshed');
  } catch {
    sendError(res, 'Invalid or expired refresh token', 401);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await blacklistToken(token, 60 * 60); // blacklist for 1 hour (covers 15m access token lifetime)
  }

  if (req.user) {
    await prisma.auditLog.create({
      data: {
        action: 'USER_LOGOUT',
        actorId: req.user.userId,
        ipAddress: req.ip,
      },
    });
  }

  sendSuccess(res, null, 'Logged out successfully');
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      kycStatus: true,
      nationalId: true,
      brelaNumber: true,
      createdAt: true,
    },
  });

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  sendSuccess(res, user, 'Profile retrieved');
}
