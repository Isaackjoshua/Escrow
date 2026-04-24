import { Router } from 'express';
import { createMilestones, listMilestones, requestMilestoneOtp, confirmMilestone } from '../controllers/milestone.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/transactions/:id/milestones', createMilestones);
router.get('/transactions/:id/milestones', listMilestones);
router.post('/milestones/:milestoneId/request-otp', requestMilestoneOtp);
router.post('/milestones/:milestoneId/confirm', confirmMilestone);

export default router;
