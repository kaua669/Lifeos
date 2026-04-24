// src/middleware/auth.js — JWT verification middleware
'use strict';

const jwt  = require('jsonwebtoken');

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set and at least 32 chars');
  return s;
};

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de autenticação necessário.' });
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET());
    req.userId = payload.sub;
    req.user   = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(401).json({ message: 'Token inválido.' });
  }
}

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    SECRET(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d', issuer: 'lifeos' }
  );
}

module.exports = { authMiddleware, signToken };
