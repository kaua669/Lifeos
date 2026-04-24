// src/routes/finance.js
'use strict';

const express  = require('express');
const { body, param, query: qv } = require('express-validator');
const db                = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const validate           = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

const CATEGORIES = [
  'Alimentação','Moradia','Transporte','Saúde','Educação',
  'Lazer','Roupas','Serviços','Investimento','Salário','Outros'
];

/* ══════════ TRANSACTIONS ══════════ */

// GET /api/finance/transactions
router.get('/transactions',
  qv('type').optional().isIn(['INCOME','EXPENSE']),
  qv('from').optional().isDate(),
  qv('to').optional().isDate(),
  validate,
  async (req, res, next) => {
    try {
      const { type, from, to } = req.query;
      let sql = `
        SELECT id, description, type, amount, category,
               trans_date AS "date", frequency, notes,
               created_at AS "createdAt"
        FROM finance_transactions
        WHERE user_id = $1 AND deleted_at IS NULL
      `;
      const params = [req.userId];
      if (type) { params.push(type); sql += ` AND type = $${params.length}`; }
      if (from) { params.push(from); sql += ` AND trans_date >= $${params.length}`; }
      if (to)   { params.push(to);   sql += ` AND trans_date <= $${params.length}`; }
      sql += ' ORDER BY trans_date DESC, id DESC';

      const { rows } = await db.query(sql, params);
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// POST /api/finance/transactions
router.post('/transactions',
  body('description').trim().notEmpty().withMessage('Descrição é obrigatória.')
    .isLength({ max: 200 }),
  body('type').isIn(['INCOME','EXPENSE']).withMessage('Tipo deve ser INCOME ou EXPENSE.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser positivo.'),
  body('date').isDate().withMessage('Data inválida.'),
  body('category').optional().isIn(CATEGORIES),
  body('frequency').optional().isLength({ max: 20 }),
  body('notes').optional().isLength({ max: 1000 }),
  validate,
  async (req, res, next) => {
    try {
      const { description, type, amount, date, category, frequency, notes } = req.body;
      const { rows } = await db.query(
        `INSERT INTO finance_transactions
           (user_id, description, type, amount, category, trans_date, frequency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, description, type, amount, category,
                   trans_date AS "date", frequency, notes,
                   created_at AS "createdAt"`,
        [req.userId, description, type, amount, category || null,
         date, frequency || 'Único', notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/finance/transactions/:id
router.delete('/transactions/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE finance_transactions SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Transação não encontrada.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

/* ══════════ SALARIES / FIXED INCOME ══════════ */

// GET /api/finance/salaries
router.get('/salaries', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, source, amount, day_of_month AS "dayOfMonth", notes,
              created_at AS "createdAt"
       FROM finance_salaries
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/finance/salaries
router.post('/salaries',
  body('source').trim().notEmpty().withMessage('Fonte é obrigatória.')
    .isLength({ max: 100 }),
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser positivo.'),
  body('dayOfMonth').optional({ nullable: true }).isInt({ min: 1, max: 31 }),
  body('notes').optional().isLength({ max: 500 }),
  validate,
  async (req, res, next) => {
    try {
      const { source, amount, dayOfMonth, notes } = req.body;
      const { rows } = await db.query(
        `INSERT INTO finance_salaries (user_id, source, amount, day_of_month, notes)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, source, amount, day_of_month AS "dayOfMonth", notes,
                   created_at AS "createdAt"`,
        [req.userId, source, amount, dayOfMonth || null, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/finance/salaries/:id
router.delete('/salaries/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE finance_salaries SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Salário não encontrado.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

// GET /api/finance/summary — monthly summary for charts
router.get('/summary', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT
         TO_CHAR(trans_date, 'YYYY-MM') AS month,
         type,
         SUM(amount) AS total
       FROM finance_transactions
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND trans_date >= NOW() - INTERVAL '6 months'
       GROUP BY 1, 2
       ORDER BY 1 ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
