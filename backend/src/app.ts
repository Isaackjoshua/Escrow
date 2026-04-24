import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { defaultLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFound } from './middleware/error.middleware';
import { logger } from './utils/logger';

import authRoutes from './routes/auth.routes';
import transactionRoutes from './routes/transaction.routes';
import milestoneRoutes from './routes/milestone.routes';
import disputeRoutes from './routes/dispute.routes';
import deliveryRoutes from './routes/delivery.routes';
import ratingRoutes from './routes/rating.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Rate limiting (global) ───────────────────────────────────────────────────
app.use('/api', defaultLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api', milestoneRoutes);
app.use('/api', disputeRoutes);
app.use('/api', deliveryRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── 404 / Error handlers ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
