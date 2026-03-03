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
  console.error('ERROR:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Algo deu muito errado no servidor!'
  });
};