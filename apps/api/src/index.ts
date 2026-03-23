import 'dotenv/config';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startJobs } from './jobs';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(`Lighthouse API running on port ${PORT} [${process.env['NODE_ENV']}]`);
  });

  startJobs();

  const shutdown = async () => {
    logger.info('Shutting down...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
