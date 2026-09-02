// Shared Postgres (Neon) client for Vercel serverless functions.
// Reads the connection string from the POSTGRES_URL env var provided by
// Vercel's Postgres/Neon integration (or a DATABASE_URL fallback for local dev).

import pg from 'pg';
import { ensureSchema } from './schema-sql.js';
const { Pool } = pg;

let cachedPool = null;
let schemaReady = false;

function connectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

// Lazily create the pool and apply the schema on first use (idempotent).
export async function getPool() {
  if (!connectionString()) {
    throw new Error('Database not configured: set POSTGRES_URL (or DATABASE_URL) env var.');
  }
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: connectionString(),
      ssl: process.env.POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 1,
    });
  }
  if (!schemaReady) {
    const pool = cachedPool;
    await ensureSchema((text, params) => pool.query(text, params));
    schemaReady = true;
  }
  return cachedPool;
}

export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

export async function endPool() {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    schemaReady = false;
  }
}