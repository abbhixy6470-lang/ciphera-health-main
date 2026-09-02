// GET/POST /api/sync — full cloud sync of patient data.
//
// GET  -> returns the current full dataset (patients, medicines, logs,
//         settings, doctor history, records) for this owner key.
// POST -> replaces/merges the full dataset for this owner key.
//
// Uses a lightweight owner key (in Authorization header or ?key=) derived
// from the device, so no heavy account ceremony is required.

import { query } from '../db/client.js';
import { corsHeaders, sendOptions, ok, err, uid, now } from '../db/helpers.js';

// The owner_key scopes each device's dataset. Accept it in the Authorization
// header (Bearer) or as a ?key= query parameter.
function ownerKey(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const u = new URL(req.url, 'http://x');
  return u.searchParams.get('key') || '';
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);

  const key = ownerKey(req);
  if (!key) return err(res, 'Missing owner key (Authorization: Bearer <key> or ?key=)', 401);

  try {
    if (req.method === 'GET') {
      const bundle = await loadBundle(key);
      return ok(res, { bundle, time: now() });
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await readBodySafe(req);
      if (!body) return err(res, 'Invalid JSON body', 400);
      const saved = await saveBundle(key, body);
      return ok(res, { saved, time: now() });
    }
    return err(res, 'Method not allowed', 405);
  } catch (e) {
    console.error('sync error:', e.message);
    return err(res, 'Sync failed: ' + e.message, 500);
  }
}

function readBodySafe(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8e6) { resolve(null); } });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

const PAT = ['name','age','blood','relation','allergies','conditions','contact'];
const MED = ['name','generic','category','form','expiry_date','batch_no','opened_date','dosage','stock','storage_location','notes'];
const LOG = ['date','scheduled_time','status','timestamp','notes','actor'];
const HIS = ['question','answer','warnings','ts'];

async function loadBundle(key) {
  const patients = (await query('SELECT * FROM patients WHERE owner_key = $1 ORDER BY created_at', [key])).rows.map(r => pick(r, PAT));
  const medicines = (await query('SELECT * FROM medicines WHERE owner_key = $1 ORDER BY created_at', [key])).rows.map(r => ({ id: r.id, ...pick(r, MED), schedule: r.schedule }));
  const logRows = (await query('SELECT * FROM dose_logs WHERE owner_key = $1 ORDER BY timestamp', [key])).rows;
  const logs = logRows.map(r => ({ id: r.id, medicine_id: r.medicine_id, ...pick(r, LOG) }));
  const settingsRs = await query('SELECT key, value FROM app_settings WHERE owner_key = $1', [key]);
  let settings = {};
  for (const row of settingsRs.rows) settings[row.key] = row.value;
  const history = (await query('SELECT * FROM doctor_history WHERE owner_key = $1 ORDER BY ts DESC LIMIT 500', [key])).rows.map(r => ({ id: r.id, ...pick(r, HIS), warnings: r.warnings }));
  const records = (await query('SELECT * FROM medical_records WHERE owner_key = $1 ORDER BY created_at DESC', [key])).rows.map(r => ({
    id: r.id, title: r.title, type: r.type, recordDate: r.record_date, patientId: r.patient_id,
    facility: r.facility, doctor: r.doctor, resultSummary: r.result_summary, notes: r.notes,
    fields: r.fields, createdAt: r.created_at, updatedAt: r.updated_at
  }));
  return { key, patients, medicines, logs, settings, doctorHistory: history, records };
}

function pick(row, fields) {
  const o = {};
  for (const f of fields) if (row[f] !== undefined && row[f] !== null) o[f] = row[f];
  return o;
}

async function saveBundle(key, body) {
  const ts = now();

  const patients = Array.isArray(body.patients) ? body.patients : [];
  await query('DELETE FROM patients WHERE owner_key = $1', [key]);
  for (const p of patients) {
    await query(
      `INSERT INTO patients (id,owner_key,name,age,blood,relation,allergies,conditions,contact,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [p.id || uid('p'), key, p.name || '', p.age || '', p.blood || '', p.relation || 'Self',
       p.allergies || '', p.conditions || '', p.contact || '', ts]
    );
  }

  const medicines = Array.isArray(body.medicines) ? body.medicines : [];
  await query('DELETE FROM medicines WHERE owner_key = $1', [key]);
  for (const m of medicines) {
    const schedule = m.schedule && typeof m.schedule === 'object' ? JSON.stringify(m.schedule) : '{}';
    await query(
      `INSERT INTO medicines (id,owner_key,name,generic,category,form,expiry_date,batch_no,opened_date,dosage,stock,storage_location,notes,schedule,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$15)`,
      [m.id || uid('m'), key, m.name || '', m.generic || '', m.category || 'General / Other', m.form || 'Tablet',
       m.expiry_date || '', m.batch_no || '', m.opened_date || '', m.dosage || '',
       Number(m.stock) || 0, m.storage_location || '', m.notes || '', schedule, ts]
    );
  }

  const logs = Array.isArray(body.logs) ? body.logs : [];
  await query('DELETE FROM dose_logs WHERE owner_key = $1', [key]);
  for (const l of logs) {
    await query(
      `INSERT INTO dose_logs (id,owner_key,medicine_id,date,scheduled_time,status,timestamp,notes,actor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [l.id || uid('log'), key, l.medicine_id || '', l.date || '', l.scheduled_time || '',
       l.status || 'TAKEN', Number(l.timestamp) || ts, l.notes || '', l.actor || 'Patient']
    );
  }

  if (body.settings && typeof body.settings === 'object') {
    await query('DELETE FROM app_settings WHERE owner_key = $1', [key]);
    for (const [k, v] of Object.entries(body.settings)) {
      await query(
        `INSERT INTO app_settings (owner_key,key,value) VALUES ($1,$2,$3)`,
        [key, k, typeof v === 'string' ? v : JSON.stringify(v)]
      );
    }
  }

  const history = Array.isArray(body.doctorHistory) ? body.doctorHistory : [];
  await query('DELETE FROM doctor_history WHERE owner_key = $1', [key]);
  for (const h of history) {
    if (!h || !h.question) continue;
    await query(
      `INSERT INTO doctor_history (id,owner_key,question,answer,warnings,ts)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      [h.id || uid('q'), key, h.question, h.answer || '',
       JSON.stringify(Array.isArray(h.warnings) ? h.warnings : []), Number(h.ts) || ts]
    );
  }

  const records = Array.isArray(body.records) ? body.records : [];
  await query('DELETE FROM medical_records WHERE owner_key = $1', [key]);
  for (const r of records) {
    if (!r.title) continue;
    await query(
      `INSERT INTO medical_records (id,owner_key,title,type,record_date,patient_id,facility,doctor,result_summary,notes,fields,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$12)`,
      [r.id || uid('rec'), key, r.title, r.type || 'Report', r.recordDate || '',
       r.patientId || '', r.facility || '', r.doctor || '', r.resultSummary || '', r.notes || '',
       JSON.stringify(Array.isArray(r.fields) ? r.fields : []), Number(r.createdAt) || ts]
    );
  }

  return true;
}