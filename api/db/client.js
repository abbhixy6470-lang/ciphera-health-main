// Shared Postgres (Neon) client for Vercel serverless functions.
// Reads the connection string from the POSTGRES_URL env var provided by
// Vercel's Postgres/Neon integration (or a DATABASE_URL fallback for local dev).

import pg from 'pg';
const { Pool } = pg;

let cachedPool = null;

function connectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

export function getPool() {
  if (!connectionString()) {
    throw new Error('Database not configured: set POSTGRES_URL (or DATABASE_URL) env var.');
  }
  if (cachedPool) return cachedPool;

  cachedPool = new Pool({
    connectionString: connectionString(),
    ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 1,
  });
  return cachedPool;
}

export async function query(text, params) {
  const pool = getPool();
  const res = await pool.query(text, params);
  return res;
}

export async function endPool() {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}