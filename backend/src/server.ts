import './config/env'; // validate env first
import app from './app';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { env } from './config/env';

async function start(): Promise<void> {
  try {
    await redis.connect();
    await prisma.$connect();
    logger.info('Database connected');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Escrow255 API running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await prisma.$disconnect();
        await redis.quit();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
}

start();
