import { AppError } from '../utils/AppError.js';

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Se for um erro que criamos (AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Tratamento especial para erros do Prisma (ex: Unique Constraint)
  if (err.code === 'P2002') {
    return res.status(400).json({
      status: 'error',
      message: `Campo duplicado: ${err.meta.target}`
    });
  }

  // Erro genérico/desconhecido (Logamos para o desenvolvedor ver)
  console.error('SERVER ERROR:', err);
  return res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Algo deu muito errado no servidor!',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack, details: err })
  });
};