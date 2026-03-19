// src/database/prisma.js
import dotenv from 'dotenv'
dotenv.config()
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import logger from '../utils/logger.js'

let prisma;

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!databaseUrl) {
    logger.error('DATABASE_URL or DIRECT_URL is missing in environment variables');
}

if (process.env.NODE_ENV === 'production') {
    const pool = new pg.Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })
} else {
    if (!global.prisma) {
        const pool = new pg.Pool({ 
            connectionString: databaseUrl,
            connectionTimeoutMillis: 5000,
        });
        const adapter = new PrismaPg(pool)
        global.prisma = new PrismaClient({ adapter })
        logger.info('Prisma Client initialized (Development Singleton)')
    }
    prisma = global.prisma;
}

export default prisma