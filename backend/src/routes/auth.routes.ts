import { Router } from 'express';
import {
  register,
  verifyRegistrationOtp,
  login,
  verifyLoginOtp,
  refreshToken,
  logout,
  getProfile,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/verify-registration', authLimiter, verifyRegistrationOtp);
router.post('/login', authLimiter, login);
router.post('/verify-otp', authLimiter, verifyLoginOtp);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);

export default router;
