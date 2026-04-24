// src/middleware/validate.js — express-validator helper
'use strict';

const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ message: first.msg });
  }
  next();
}

module.exports = validate;
