import { Router } from 'express';
import { raiseDispute, uploadEvidence, listDisputes, resolveDispute, upload } from '../controllers/dispute.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/transactions/:id/dispute', raiseDispute);
router.post('/disputes/:disputeId/evidence', upload.array('files', 5), uploadEvidence);
router.get('/disputes', listDisputes);
router.post('/disputes/:disputeId/resolve', authorize('ADMIN'), resolveDispute);

export default router;
