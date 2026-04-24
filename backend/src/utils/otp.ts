import crypto from 'crypto';
import { redis } from '../config/redis';
import { env } from '../config/env';

const OTP_PREFIX = 'otp:';

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function storeOtp(phone: string, otp: string, purpose: string): Promise<void> {
  const key = `${OTP_PREFIX}${purpose}:${phone}`;
  await redis.setex(key, env.OTP_EXPIRY_MINUTES * 60, otp);
}

export async function verifyOtp(phone: string, otp: string, purpose: string): Promise<boolean> {
  const key = `${OTP_PREFIX}${purpose}:${phone}`;
  const stored = await redis.get(key);
  if (!stored || stored !== otp) return false;
  await redis.del(key);
  return true;
}

export async function invalidateOtp(phone: string, purpose: string): Promise<void> {
  const key = `${OTP_PREFIX}${purpose}:${phone}`;
  await redis.del(key);
}
