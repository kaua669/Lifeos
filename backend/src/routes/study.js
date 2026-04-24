// src/routes/study.js
'use strict';

const express  = require('express');
const { body, param } = require('express-validator');
const db                = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const validate           = require('../middleware/validate');

const router = express.Router();
router.use(authMiddleware);

/* ══════════ SUBJECTS ══════════ */

// GET /api/study/subjects
router.get('/subjects', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, description, created_at AS "createdAt"
       FROM study_subjects
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/study/subjects
router.post('/subjects',
  body('name').trim().notEmpty().withMessage('Nome é obrigatório.')
    .isLength({ max: 100 }),
  body('description').optional().isLength({ max: 1000 }),
  validate,
  async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const { rows } = await db.query(
        `INSERT INTO study_subjects (user_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, created_at AS "createdAt"`,
        [req.userId, name, description || null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/study/subjects/:id
router.delete('/subjects/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      await db.withTransaction(async (client) => {
        // Soft-delete the subject
        const { rowCount } = await client.query(
          'UPDATE study_subjects SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [req.params.id, req.userId]
        );
        if (rowCount === 0) {
          const err = new Error('Matéria não encontrada.');
          err.status = 404;
          throw err;
        }
        // Also soft-delete linked notes
        await client.query(
          'UPDATE study_notes SET deleted_at = NOW() WHERE subject_id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [req.params.id, req.userId]
        );
      });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

/* ══════════ NOTES ══════════ */

// GET /api/study/notes
router.get('/notes', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, subject_id AS "subjectId", title, content,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM study_notes
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/study/notes
router.post('/notes',
  body('title').trim().notEmpty().withMessage('Título é obrigatório.')
    .isLength({ max: 200 }),
  body('content').notEmpty().withMessage('Conteúdo é obrigatório.'),
  body('subjectId').optional({ nullable: true }).isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { title, content, subjectId } = req.body;

      // Verify subject belongs to user (if provided)
      if (subjectId) {
        const s = await db.query(
          'SELECT id FROM study_subjects WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [subjectId, req.userId]
        );
        if (s.rows.length === 0) {
          return res.status(400).json({ message: 'Matéria inválida.' });
        }
      }

      const { rows } = await db.query(
        `INSERT INTO study_notes (user_id, subject_id, title, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, subject_id AS "subjectId", title, content,
                   created_at AS "createdAt"`,
        [req.userId, subjectId || null, title, content]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// DELETE /api/study/notes/:id
router.delete('/notes/:id',
  param('id').isInt({ min: 1 }),
  validate,
  async (req, res, next) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE study_notes SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [req.params.id, req.userId]
      );
      if (rowCount === 0) return res.status(404).json({ message: 'Nota não encontrada.' });
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

module.exports = router;
