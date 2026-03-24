import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { ZodError } from 'zod';

export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log non-operational errors
  if (!err.isOperational && statusCode === 500) {
    logger.error({
      msg: 'Unexpected Error',
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  }

  // Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Erro de validação',
      errors: err.flatten().fieldErrors
    });
  }

  // Handle Prisma Unique Constraint
  if (err.code === 'P2002') {
    return res.status(400).json({
      status: 'error',
      message: `Já existe um registro com este valor: ${err.meta?.target || 'campo único'}`
    });
  }

  // AppError (Operational)
  if (err.isOperational) {
    return res.status(statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Generic Error
  return res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Erro inesperado',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};