// src/routes/schedule.js
'use strict';

const express  = require('express');
const { body, param, query: qv } = require('express-validator');
const db                = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const validate           = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/schedule ──────────────────────────────
router.get('/',
  qv('from').optional().isDate(),
  qv('to').optional().isDate(),
  validate,
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      let sql = `
        SELECT id, title, description,
               event_date  AS "date",
               event_time::text AS "time",
               category, created_at AS "createdAt"
        FROM schedule_events
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      const params = [req.userId];
      if (from) { params.push(from); sql += ` AND event_date >= $${params.length}`; }
      if (to)   { params.push(to);   sql += ` AND event_date <= $${params.length}`; }
      sql += ' ORDER BY event_date ASC, event_time ASC NULLS LAST';

      const { rows } = await db.query(sql, params);
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/schedule ─────────────────────────────
router.post('/',
  body('title').trim().notEmpty().withMessage('Título é obrigatório.')
    .isLength({ max: 200 }),
  body('date').isDate().withMessage('Data inválida.'),
  body('time').optional({ nullable: true }).matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Hora inválida.'),
  body('category').optional().isLength({ max: 50 }),
  body('description').optional().isLength({ max: 2000 }),
  validate,
  async (req, res, next) => {
    try {
      const { title, date, time, category, description } = req.body;
      const { rows } = await db.query(
        `INSERT INTO schedule_events (user_id, title, description, event_date, event_time, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description,
                   event_date AS "date",
                   event_time::text AS "time",
                   category, created_at AS "createdAt"`,
        [req.userId, title, description || null, date, time || null, category || 'Geral']
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/schedule/:id ───────────────────────
router.delete('/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE schedule_events SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Evento não encontrado.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

module.exports = router;
