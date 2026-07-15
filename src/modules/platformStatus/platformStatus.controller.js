import prisma from '../../database/prisma.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const platformStatusController = {
  getStatus: asyncHandler(async (req, res) => {
    // Mede a latência do banco com uma query trivial
    let db = { ok: false, latencyMs: null };
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = { ok: true, latencyMs: Date.now() - started };
    } catch {
      db = { ok: false, latencyMs: Date.now() - started };
    }

    const mem = process.memoryUsage();

    return res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      db,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
    });
  }),
};
