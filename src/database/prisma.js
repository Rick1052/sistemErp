// src/database/prisma.js
import dotenv from 'dotenv'
dotenv.config()
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import logger from '../utils/logger.js'

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!databaseUrl) {
    logger.error('DIRECT_URL or DATABASE_URL is missing in environment variables')
}

let pool
let prismaInstance
let devClientMtime = 0
let devInitLogged = false

function createPool() {
    const base = {
        connectionString: databaseUrl,
        connectionTimeoutMillis: 5000,
    }
    if (process.env.NODE_ENV === 'production') {
        return new pg.Pool({
            ...base,
            max: 10,
            idleTimeoutMillis: 30000,
        })
    }
    return new pg.Pool(base)
}

function attachClient(nextPool) {
    const adapter = new PrismaPg(nextPool)
    return new PrismaClient({ adapter })
}

function disposeDevClient() {
    if (prismaInstance) {
        prismaInstance.$disconnect().catch(() => {})
        prismaInstance = undefined
    }
    if (pool) {
        pool.end().catch(() => {})
        pool = undefined
    }
}

function prismaGeneratedClientMtime() {
    try {
        const clientIndex = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'index.js')
        return fs.statSync(clientIndex).mtimeMs
    } catch {
        return 0
    }
}

/** Em dev, após `prisma generate` o singleton antigo ainda não conhece novos campos — recria o client. */
function ensureDevPrismaFresh() {
    if (process.env.NODE_ENV === 'production') return
    const mtime = prismaGeneratedClientMtime()
    if (mtime === devClientMtime && prismaInstance) return
    if (prismaInstance) {
        logger.info('Cliente Prisma recriado (arquivo gerado alterado; ex.: após prisma generate).')
        disposeDevClient()
    }
    devClientMtime = mtime
    pool = createPool()
    prismaInstance = attachClient(pool)
    if (!devInitLogged) {
        logger.info('Prisma Client inicializado (desenvolvimento)')
        devInitLogged = true
    }
}

if (process.env.NODE_ENV === 'production') {
    pool = createPool()
    prismaInstance = attachClient(pool)
} else {
    ensureDevPrismaFresh()
}

const devPrismaProxy =
    process.env.NODE_ENV === 'production'
        ? null
        : new Proxy(
              {},
              {
                  get(_target, prop) {
                      ensureDevPrismaFresh()
                      const value = Reflect.get(prismaInstance, prop, prismaInstance)
                      if (typeof value === 'function') {
                          return value.bind(prismaInstance)
                      }
                      return value
                  },
              }
          )

export default process.env.NODE_ENV === 'production' ? prismaInstance : devPrismaProxy
