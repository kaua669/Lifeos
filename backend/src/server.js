// src/server.js — LifeOS API Entry Point
'use strict';

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const authRouter     = require('./routes/auth');
const userRouter     = require('./routes/user');
const scheduleRouter = require('./routes/schedule');
const studyRouter    = require('./routes/study');
const gymRouter      = require('./routes/gym');
const financeRouter  = require('./routes/finance');
const errorHandler   = require('./middleware/errorHandler');
const { getPool }    = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ──── TRUST PROXY (for Render, Railway, Fly.io, etc.) ──── */
app.set('trust proxy', 1);

/* ──── SECURITY HEADERS ──── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/* ──── CORS ──── */
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// In development, also allow any localhost
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(/^http:\/\/localhost(:\d+)?$/);
  allowedOrigins.push(/^http:\/\/127\.0\.0\.1(:\d+)?$/);
}

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    const allowed = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(allowed ? null : new Error(`CORS: ${origin} not allowed`), allowed);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

/* ──── BODY PARSING ──── */
// Larger limit to accommodate base64 avatar images
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

/* ──── LOGGING ──── */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/* ──── GLOBAL RATE LIMIT ──── */
app.use('/api', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX || '200'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: 'Muitas requisições. Tente novamente em instantes.' },
}));

/* ──── STRICT RATE LIMIT FOR AUTH ──── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20'),
  message: { message: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

/* ──── ROUTES ──── */
app.get('/health', async (req, res) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth',     authLimiter, authRouter);
app.use('/api/user',     userRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/study',    studyRouter);
app.use('/api/gym',      gymRouter);
app.use('/api/finance',  financeRouter);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

/* ──── GLOBAL ERROR HANDLER ──── */
app.use(errorHandler);

/* ──── START ──── */
async function start() {
  try {
    // Verify DB connection on startup
    await getPool().query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Make sure PostgreSQL is running and your .env is configured.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   ⬡  LifeOS API  running on :${PORT}   ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(22)}║
╚═══════════════════════════════════════╝
    `);
  });
}

start();

module.exports = app; // for testing
