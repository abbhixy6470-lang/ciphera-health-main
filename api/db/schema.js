// Database schema for Ciphera Health+ (Vercel Postgres / Neon).
// Run: `node api/db/schema.js apply` after setting your DATABASE_URL.

import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// Every row is scoped to an `owner_key` (the device/patient bundle key) so the
// app can sync one self-contained dataset. Logs/medicines keep their own id.
const SCHEMA_UP = `
CREATE TABLE IF NOT EXISTS caregivers (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at   BIGINT,
  created_at   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id           TEXT PRIMARY KEY,
  owner_key    TEXT NOT NULL,
  name         TEXT,
  age          TEXT,
  blood        TEXT,
  relation     TEXT DEFAULT 'Self',
  allergies    TEXT DEFAULT '',
  conditions    TEXT DEFAULT '',
  contact      TEXT DEFAULT '',
  created_at   BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients (owner_key);

CREATE TABLE IF NOT EXISTS medicines (
  id         TEXT PRIMARY KEY,
  owner_key  TEXT NOT NULL,
  name       TEXT NOT NULL,
  generic    TEXT DEFAULT '',
  category   TEXT DEFAULT 'General / Other',
  form       TEXT DEFAULT 'Tablet',
  expiry_date TEXT DEFAULT '',
  batch_no   TEXT DEFAULT '',
  opened_date TEXT DEFAULT '',
  dosage     TEXT DEFAULT '',
  stock      INTEGER DEFAULT 0,
  storage_location TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  schedule   JSONB DEFAULT '{}'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medicines_owner ON medicines (owner_key);

CREATE TABLE IF NOT EXISTS dose_logs (
  id            TEXT PRIMARY KEY,
  owner_key     TEXT NOT NULL,
  medicine_id   TEXT NOT NULL,
  date          TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status        TEXT NOT NULL,
  timestamp     BIGINT NOT NULL,
  notes         TEXT DEFAULT '',
  actor         TEXT DEFAULT 'Patient'
);
CREATE INDEX IF NOT EXISTS idx_dose_logs_owner ON dose_logs (owner_key);
CREATE INDEX IF NOT EXISTS idx_dose_logs_medicine ON dose_logs (medicine_id, date);

CREATE TABLE IF NOT EXISTS app_settings (
  owner_key TEXT NOT NULL,
  key       TEXT NOT NULL,
  value     TEXT,
  PRIMARY KEY (owner_key, key)
);

CREATE TABLE IF NOT EXISTS doctor_history (
  id          TEXT PRIMARY KEY,
  owner_key   TEXT NOT NULL,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  warnings    JSONB DEFAULT '[]'::jsonb,
  ts          BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doctor_history_owner ON doctor_history (owner_key);
`;

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