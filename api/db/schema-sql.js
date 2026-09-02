// Shared SQL DDL so both the CLI (schema.js) and the serverless functions can
// apply / ensure the schema idempotently on first run.

export const SCHEMA_UP = `
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

CREATE TABLE IF NOT EXISTS medical_records (
  id          TEXT PRIMARY KEY,
  owner_key   TEXT NOT NULL,
  title       TEXT NOT NULL,
  type        TEXT DEFAULT 'Report',
  record_date TEXT DEFAULT '',
  patient_id  TEXT DEFAULT '',
  facility    TEXT DEFAULT '',
  doctor      TEXT DEFAULT '',
  result_summary TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  fields      JSONB DEFAULT '[]'::jsonb,
  created_at  BIGINT NOT NULL,
  updated_at  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medical_records_owner ON medical_records (owner_key);
`;

let ensuring = false;
export async function ensureSchema(query) {
  if (ensuring) return;            // one migration at a time per instance
  ensuring = true;
  try {
    await query(SCHEMA_UP, []);
  } finally {
    ensuring = false;
  }
}