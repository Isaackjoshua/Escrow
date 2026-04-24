import { Router } from 'express';
import {
  getDashboardStats,
  getDisputeQueue,
  listUsers,
  updateKycStatus,
  toggleUserStatus,
  adminReleaseFunds,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', getDashboardStats);
router.get('/disputes', getDisputeQueue);
router.get('/users', listUsers);
router.patch('/users/:userId/kyc', updateKycStatus);
router.patch('/users/:userId/toggle-status', toggleUserStatus);
router.post('/transactions/:transactionId/release', adminReleaseFunds);

export default router;
