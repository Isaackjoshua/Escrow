import { Router } from 'express';
import { handleWebhook, getPaymentStatus } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { paymentLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/webhook', handleWebhook);
router.get('/:transactionId/status', authenticate, paymentLimiter, getPaymentStatus);

export default router;
