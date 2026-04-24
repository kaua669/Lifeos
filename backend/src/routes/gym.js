// src/routes/gym.js
'use strict';

const express  = require('express');
const { body, param } = require('express-validator');
const db                = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const validate           = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

const VALID_TYPES = ['Musculação','Cardio','Funcional','Crossfit','Yoga','Outro'];

/* ══════════ WORKOUTS ══════════ */

// GET /api/gym/workouts
router.get('/workouts', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, exercise_name AS "exerciseName",
              exercise_type AS "exerciseType",
              sets, reps, weight,
              workout_date AS "date",
              notes, created_at AS "createdAt"
       FROM gym_workouts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY workout_date DESC, id DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/gym/workouts
router.post('/workouts',
  body('exerciseName').trim().notEmpty().withMessage('Nome do exercício é obrigatório.')
    .isLength({ max: 100 }),
  body('exerciseType').optional().isIn(VALID_TYPES),
  body('sets').optional({ nullable: true }).isInt({ min: 1, max: 999 }),
  body('reps').optional({ nullable: true }).isInt({ min: 1, max: 9999 }),
  body('weight').optional({ nullable: true }).isFloat({ min: 0, max: 9999 }),
  body('date').isDate().withMessage('Data inválida.'),
  body('notes').optional().isLength({ max: 1000 }),
  validate,
  async (req, res, next) => {
    try {
      const { exerciseName, exerciseType, sets, reps, weight, date, notes } = req.body;
      const { rows } = await db.query(
        `INSERT INTO gym_workouts
           (user_id, exercise_name, exercise_type, sets, reps, weight, workout_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id,
                   exercise_name AS "exerciseName",
                   exercise_type AS "exerciseType",
                   sets, reps, weight,
                   workout_date AS "date",
                   notes, created_at AS "createdAt"`,
        [req.userId, exerciseName, exerciseType || 'Musculação',
         sets || null, reps || null, weight || null, date, notes || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/gym/workouts/:id
router.delete('/workouts/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE gym_workouts SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Treino não encontrado.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

/* ══════════ NUTRITION ══════════ */

// GET /api/gym/nutrition
router.get('/nutrition', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, meal_name AS "mealName",
              calories, protein, carbs, fats,
              entry_date AS "date",
              created_at AS "createdAt"
       FROM nutrition_entries
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY entry_date DESC, id DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/gym/nutrition
router.post('/nutrition',
  body('mealName').trim().notEmpty().withMessage('Nome da refeição é obrigatório.')
    .isLength({ max: 100 }),
  body('calories').optional({ nullable: true }).isFloat({ min: 0 }),
  body('protein').optional({ nullable: true }).isFloat({ min: 0 }),
  body('carbs').optional({ nullable: true }).isFloat({ min: 0 }),
  body('fats').optional({ nullable: true }).isFloat({ min: 0 }),
  body('date').isDate().withMessage('Data inválida.'),
  validate,
  async (req, res, next) => {
    try {
      const { mealName, calories, protein, carbs, fats, date } = req.body;
      const { rows } = await db.query(
        `INSERT INTO nutrition_entries
           (user_id, meal_name, calories, protein, carbs, fats, entry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, meal_name AS "mealName",
                   calories, protein, carbs, fats,
                   entry_date AS "date",
                   created_at AS "createdAt"`,
        [req.userId, mealName, calories || 0, protein || 0, carbs || 0, fats || 0, date]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/gym/nutrition/:id
router.delete('/nutrition/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE nutrition_entries SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Refeição não encontrada.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

module.exports = router;
