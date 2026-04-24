import { Router } from 'express';
import { listNotifications, markRead, getUnreadCount } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markRead);

export default router;
