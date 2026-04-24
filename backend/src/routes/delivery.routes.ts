import { Router } from 'express';
import { logDelivery, verifyDeliveryOtp } from '../controllers/delivery.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(authenticate);

router.post('/transactions/:id/delivery', upload.single('photo'), logDelivery);
router.post('/transactions/:id/delivery/verify-otp', verifyDeliveryOtp);

export default router;
