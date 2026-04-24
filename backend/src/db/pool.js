// src/db/pool.js — PostgreSQL connection pool
'use strict';

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const config = process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
        }
      : {
          host:     process.env.DB_HOST     || 'localhost',
          port:     parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME     || 'lifeos_db',
          user:     process.env.DB_USER     || 'lifeos_user',
          password: process.env.DB_PASSWORD || '',
          ssl:      process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
        };

    pool = new Pool({
      ...config,
      max: 20,                    // max connections in pool
      idleTimeoutMillis: 30000,   // close idle clients after 30s
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client:', err);
    });
  }
  return pool;
}

// Helper: run a parameterized query
async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 500) {
    console.warn(`Slow query (${duration}ms):`, text);
  }
  return res;
}

// Helper: run multiple statements in a transaction
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, getPool };
