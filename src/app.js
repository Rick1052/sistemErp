import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import morgan from 'morgan'
import logger from './utils/logger.js'

import authRoutes from './modules/auth/auth.routes.js'
import companyRoutes from './modules/company/company.routes.js'
import clientRoutes from './modules/client/client.routes.js'
import categoryProduct from './modules/products/category/category.routes.js'
import supplierProduct from './modules/products/supplier/supplier.routes.js'
import brandProduct from './modules/products/brand/brand.routes.js'
import tagProduct from './modules/products/tag/tag.routes.js'
import warehouseProduct from './modules/products/warehouse/warehouse.routes.js'
import product from './modules/products/product/product.routes.js'
import sale from './modules/sales/sale.routes.js'
import budgetRoutes from './modules/budgets/budget.routes.js'
import saleStatus from './modules/sales/saleStatus.routes.js'
import productInventory from './modules/products/productInventory/pdInventory.routes.js'
import productTax from './modules/products/productTax/pdTax.routes.js'
import stockMovement from './modules/products/stockMovement/stockMovement.routes.js'
import financialRoutes from './modules/financial/financial.routes.js'
import reportRoutes from './modules/reports/report.routes.js'
import userRoutes from './modules/users/user.routes.js'
import dashboardRoutes from './modules/dashboard/dashboard.routes.js'
import nfeRoutes from './modules/nfe/nfe.routes.js'
import platformBillingRoutes from './modules/platformBilling/platformBilling.routes.js'

import { globalErrorHandler } from './middleware/error.middleware.js'

const app = express()

/** Origens padrão do ERP Cerâmica Marim (produção) */
const PRODUCTION_ORIGINS = [
  'https://erp.ceramicamm.com.br',
  'https://www.erp.ceramicamm.com.br',
];

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

function parseAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const origins = [...fromEnv, ...PRODUCTION_ORIGINS];

  if (process.env.NODE_ENV !== 'production') {
    origins.push(...LOCAL_ORIGINS);
  }

  return [...new Set(origins)];
}

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    // Sem Origin: Postman, apps mobile, health checks
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn({ msg: 'CORS bloqueado', origin, allowedOrigins });
    // Nunca passar Error — quebra o preflight OPTIONS com 500 sem headers CORS
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

// Security & Optimization Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(compression())
// Limite maior para comportar o logo da empresa em base64 (~350KB)
app.use(express.json({ limit: '1mb' }))

// Rate Limiting (ignora preflight OPTIONS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições deste IP, tente novamente após 15 minutos',
    skip: (req) => req.method === 'OPTIONS',
})
app.use('/api/', limiter)

// Request Logging
app.use(morgan('dev', {
    stream: { write: (message) => logger.info(message.trim()) }
}))

// API Health Check / Root
app.get('/api', (req, res) => {
    res.json({
        status: 'UP',
        message: 'ERP API is running',
        timestamp: new Date().toISOString()
    });
});

// Router Auth
app.use('/api/auth', authRoutes)
app.use('/api/company', companyRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Router Products
app.use('/api/products/category', categoryProduct)
app.use('/api/products/supplier', supplierProduct)
app.use('/api/products/brand', brandProduct)
app.use('/api/products/tag', tagProduct)
app.use('/api/products/warehouse', warehouseProduct)
app.use('/api/products', product)
app.use('/api/sales', sale)
app.use('/api/budgets', budgetRoutes)
app.use('/api/sale-statuses', saleStatus)
app.use('/api/products/products-inventory', productInventory)
app.use('/api/products/product-tax', productTax)
app.use('/api/products/stock-movement', stockMovement)
app.use('/api/financial', financialRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/users', userRoutes)
app.use('/api/nfe', nfeRoutes)
app.use('/api/platform/billing', platformBillingRoutes)

// Router Error
app.use(globalErrorHandler)

export default app
