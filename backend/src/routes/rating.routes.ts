import { Router } from 'express';
import { submitRating, getUserRatings } from '../controllers/rating.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', submitRating);
router.get('/user/:userId', getUserRatings);

export default router;
