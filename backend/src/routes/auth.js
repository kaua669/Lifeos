// src/routes/auth.js
'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body } = require('express-validator');
const { query }    = require('../db/pool');
const { signToken } = require('../middleware/auth');
const validate      = require('../middleware/validate');

const router = express.Router();
const ROUNDS = () => parseInt(process.env.BCRYPT_ROUNDS || '12');

// ─── POST /api/auth/register ─────────────────────────
router.post('/register',
  body('name').trim().notEmpty().withMessage('Nome é obrigatório.')
    .isLength({ max: 100 }).withMessage('Nome muito longo.'),
  body('email').trim().isEmail().withMessage('E-mail inválido.')
    .normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres.'),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      // Check duplicate email
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'E-mail já cadastrado.' });
      }

      const password_hash = await bcrypt.hash(password, ROUNDS());
      const result = await query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, bio, avatar_url, created_at`,
        [name, email, password_hash]
      );
      const user  = result.rows[0];
      const token = signToken(user.id);

      res.status(201).json({
        token,
        user: {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          bio:       user.bio,
          avatarUrl: user.avatar_url,
        },
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/auth/login ────────────────────────────
router.post('/login',
  body('email').trim().isEmail().withMessage('E-mail inválido.').normalizeEmail(),
  body('password').notEmpty().withMessage('Senha é obrigatória.'),
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const result = await query(
        'SELECT id, name, email, password_hash, bio, avatar_url FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];

      // Constant-time comparison even when user not found (prevent timing attacks)
      const hash = user ? user.password_hash : '$2a$12$invalidhashpaddingtomatch000000000000000000000000000000';
      const match = await bcrypt.compare(password, hash);

      if (!user || !match) {
        return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
      }

      const token = signToken(user.id);
      res.json({
        token,
        user: {
          id:        user.id,
          name:      user.name,
          email:     user.email,
          bio:       user.bio,
          avatarUrl: user.avatar_url,
        },
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
