// Database schema for Ciphera Health+ (Vercel Postgres / Neon).
// Run: `node api/db/schema.js apply` after setting your DATABASE_URL.

import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SCHEMA_UP } from './schema-sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal dotenv loader (no external dep needed for local dev .env)
try {
  const envPath = path.join(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (e) { /* ignore */ }

const { Pool } = pg;

async function run() {
  const cs = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!cs) {
    console.error('No DATABASE_URL / POSTGRES_URL set. Provide it in .env first.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(SCHEMA_UP);
    console.log('✓ Schema applied successfully.');
  } catch (e) {
    console.error('Schema apply failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

const cmd = process.argv[2];
if (cmd === 'apply') run();
else if (cmd === 'test') {
  const cs = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  console.log(cs ? 'DATABASE_URL is set (' + cs.split('@')[1] + ')' : 'DATABASE_URL NOT set');
}
else {
  console.log('Usage: node api/db/schema.js [apply|test]');
}