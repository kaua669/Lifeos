// src/routes/user.js
'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body } = require('express-validator');
const { query }           = require('../db/pool');
const { authMiddleware }  = require('../middleware/auth');
const validate            = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/user/me ───────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, bio, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Usuário não encontrado.' });
    const u = rows[0];
    res.json({ id: u.id, name: u.name, email: u.email, bio: u.bio, avatarUrl: u.avatar_url });
  } catch (err) { next(err); }
});

// ─── PUT /api/user/profile ──────────────────────────
router.put('/profile',
  body('name').trim().notEmpty().withMessage('Nome é obrigatório.')
    .isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('E-mail inválido.').normalizeEmail(),
  body('bio').optional().isLength({ max: 500 }),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, bio } = req.body;
      // Check email uniqueness (excluding self)
      const dup = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.userId]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ message: 'E-mail já está em uso.' });
      }
      const { rows } = await query(
        `UPDATE users SET name = $1, email = $2, bio = $3
         WHERE id = $4
         RETURNING id, name, email, bio, avatar_url`,
        [name, email, bio || null, req.userId]
      );
      const u = rows[0];
      res.json({ id: u.id, name: u.name, email: u.email, bio: u.bio, avatarUrl: u.avatar_url });
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/user/password ─────────────────────────
router.put('/password',
  body('currentPassword').notEmpty().withMessage('Senha atual é obrigatória.'),
  body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter pelo menos 8 caracteres.'),
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
      const user = rows[0];
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Senha atual incorreta.' });

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const newHash = await bcrypt.hash(newPassword, rounds);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

// ─── POST /api/user/avatar ──────────────────────────
router.post('/avatar',
  body('avatarUrl').notEmpty().withMessage('URL do avatar é obrigatória.')
    .isLength({ max: 2097152 }), // 2MB base64 cap
  validate,
  async (req, res, next) => {
    try {
      const { avatarUrl } = req.body;
      await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.userId]);
      res.json({ avatarUrl });
    } catch (err) { next(err); }
  }
);

module.exports = router;
