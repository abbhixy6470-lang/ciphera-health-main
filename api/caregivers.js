// POST /api/caregivers — register or login a caregiver, backed by the DB.
// Body: { action: 'register'|'login', name?, email, password, consent? }

import { query } from '../db/client.js';
import { corsHeaders, sendOptions, ok, err, readBody, uid, now, hashPassword } from '../db/helpers.js';

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);

  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  let body;
  try { body = await readBody(req); } catch (e) { return err(res, e.message, 400); }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  try {
    if (body.action === 'register') {
      const name = (body.name || '').trim();
      const consent = body.consent === true;
      if (!name || !email || !password) return err(res, 'Please fill in all fields.');
      if (!consent) return err(res, 'Caregiver access requires the patient\'s consent. You must confirm it to continue.');
      if (password.length < 6) return err(res, 'Password must be at least 6 characters.');

      const exists = await query('SELECT 1 FROM caregivers WHERE email = $1', [email]);
      if (exists.rowCount > 0) return err(res, 'A caregiver account already exists for this email.', 409);

      const id = uid('cg');
      await query(
        `INSERT INTO caregivers (id,email,name,password_hash,consent_given,consent_at,created_at)
         VALUES ($1,$2,$3,$4,TRUE,$5,$5)`,
        [id, email, name, hashPassword(password), now()]
      );
      return ok(res, { caregiver: { id, email, name } }, 201);
    }

    if (body.action === 'login') {
      if (!email || !password) return err(res, 'Please fill in all fields.');
      const rows = await query('SELECT * FROM caregivers WHERE email = $1', [email]);
      const c = rows.rows[0];
      if (!c || c.password_hash !== hashPassword(password)) return err(res, 'Invalid email or password.', 401);
      return ok(res, {
        caregiver: { id: c.id, name: c.name, email: c.email, consent_given: c.consent_given },
      });
    }

    return err(res, 'Unknown action. Use register or login.', 400);
  } catch (e) {
    console.error('caregivers error:', e.message);
    return err(res, 'Request failed: ' + e.message, 500);
  }
}