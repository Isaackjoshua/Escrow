import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';

export interface JwtPayload {
  userId: string;
  role: string;
  phone: string;
}

const BLACKLIST_PREFIX = 'jwt:blacklist:';

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export async function blacklistToken(token: string, expiresIn: number): Promise<void> {
  const key = `${BLACKLIST_PREFIX}${token}`;
  await redis.setex(key, expiresIn, '1');
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `${BLACKLIST_PREFIX}${token}`;
  const result = await redis.get(key);
  return result !== null;
}
