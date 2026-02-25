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

const app = express()

app.use(cors())
app.use(express.json())

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(500).json({
    message: "Unexpected error"
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


export default app