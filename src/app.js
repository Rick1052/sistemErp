import express from 'express'
import cors from 'cors'
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
import saleStatus from './modules/sales/saleStatus.routes.js'
import productInventory from './modules/products/productInventory/pdInventory.routes.js'
import productTax from './modules/products/productTax/pdTax.routes.js'
import stockMovement from './modules/products/stockMovement/stockMovement.routes.js'
import financialRoutes from './modules/financial/financial.routes.js'
import reportRoutes from './modules/financial/report.routes.js'

import { globalErrorHandler } from './middleware/error.middleware.js'

const app = express()

// Security & Optimization Middlewares
app.use(cors())
app.use(compression())
app.use(express.json())

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Muitas requisições deste IP, tente novamente após 15 minutos'
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

// Router Products
app.use('/api/products/category', categoryProduct)
app.use('/api/products/supplier', supplierProduct)
app.use('/api/products/brand', brandProduct)
app.use('/api/products/tag', tagProduct)
app.use('/api/products/warehouse', warehouseProduct)
app.use('/api/products', product)
app.use('/api/sales', sale)
app.use('/api/sale-statuses', saleStatus)
app.use('/api/products/products-inventory', productInventory)
app.use('/api/products/product-tax', productTax)
app.use('/api/products/stock-movement', stockMovement)
app.use('/api/financial', financialRoutes)
app.use('/api/reports', reportRoutes)

// Router Error
app.use(globalErrorHandler)

export default app