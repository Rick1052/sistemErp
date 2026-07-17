import dotenv from 'dotenv'
dotenv.config()

import app from './app.js'
import logger from './utils/logger.js'
import prisma from './database/prisma.js'
import { getRedis } from './utils/redis.js'

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  logger.info({
    msg: `🚀 Servidor rodando na porta ${PORT}`,
    env: process.env.NODE_ENV,
    port: PORT
  })

  // Warm-up do Redis em background: a 1ª requisição real já encontra a conexão pronta
  // (se o Redis estiver indisponível, o cache simplesmente faz fallback — nunca bloqueia)
  const redis = getRedis()
  if (redis) {
    redis.connect().then(
      () => logger.info('[redis] Conectado (warm-up)'),
      (err) => logger.warn(`[redis] Indisponível no warm-up: ${err?.message || err}`)
    )
  }
})

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(async () => {
    logger.info('HTTP server closed')
    await prisma.$disconnect()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(async () => {
    logger.info('HTTP server closed')
    await prisma.$disconnect()
    process.exit(0)
  })
})

server.on('error', (err) => {
  logger.error({
    msg: "Failed to start server",
    error: err.message
  })
  process.exit(1)
})