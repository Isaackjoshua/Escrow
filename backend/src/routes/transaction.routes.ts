import { Router } from 'express';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  initiateDeposit,
  verifyDepositOtp,
  confirmDelivery,
  releaseFunds,
  cancelTransaction,
} from '../controllers/transaction.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { paymentLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createTransaction);
router.get('/', listTransactions);
router.get('/:id', getTransaction);
router.post('/:id/deposit', paymentLimiter, initiateDeposit);
router.post('/:id/deposit/verify', paymentLimiter, verifyDepositOtp);
router.post('/:id/confirm-delivery', confirmDelivery);
router.post('/:id/release', paymentLimiter, releaseFunds);
router.post('/:id/cancel', cancelTransaction);

export default router;
