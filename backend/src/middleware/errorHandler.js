// src/middleware/errorHandler.js
'use strict';

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isDev  = process.env.NODE_ENV === 'development';

  // Log server errors
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Este registro já existe.' });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ message: 'Referência inválida.' });
  }
  // PostgreSQL check constraint
  if (err.code === '23514') {
    return res.status(400).json({ message: 'Valor inválido para o campo.' });
  }

  res.status(status).json({
    message: err.message || 'Erro interno do servidor.',
    ...(isDev ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
