import express from 'express'
import cors from 'cors'

import authRoutes from './modules/auth/auth.routes.js'
import companyRoutes from './modules/company/company.routes.js'
import clientRoutes from './modules/client/client.routes.js'

import categoryProduct from './modules//products/category/category.routes.js'
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


import { globalErrorHandler } from './middleware/error.middleware.js'

const app = express()

app.use(cors())
app.use(express.json())

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


// Router Error
app.use(globalErrorHandler)


export default app