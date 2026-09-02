// POST /api/auth — app account login gate.
// Body: { action: 'register'|'login', email, password, name? }
// Returns: { token, user: { id, email } } — `user.id` is used as the owner_key
// for scoping synced data.

import bcrypt from 'bcryptjs';
import { query } from '../db/client.js';
import { corsHeaders, sendOptions, ok, err, readBody, uid, now, signToken } from '../db/helpers.js';

const BCRYPT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  let body;
  try { body = await readBody(req); } catch (e) { return err(res, e.message, 400); }

  const email = normalizeEmail(body.email);
  const password = body.password || '';

  try {
    if (body.action === 'register') {
      const name = String(body.name || '').trim();
      if (!email || !password) return err(res, 'Please fill in email and password.');
      if (!validEmail(email)) return err(res, 'Please enter a valid email address.');
      if (password.length < 6) return err(res, 'Password must be at least 6 characters.');

      const exists = await query('SELECT 1 FROM app_users WHERE email = $1', [email]);
      if (exists.rowCount > 0) return err(res, 'An account with this email already exists. Please sign in.', 409);

      const id = uid('usr');
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await query(
        'INSERT INTO app_users (id,email,password_hash,created_at) VALUES ($1,$2,$3,$4)',
        [id, email, passwordHash, now()]
      );
      const token = signToken({ sub: id, email });
      return ok(res, { token, user: { id, email } }, 201);
    }

    if (body.action === 'login') {
      if (!email || !password) return err(res, 'Please fill in email and password.');
      const rows = await query('SELECT * FROM app_users WHERE email = $1', [email]);
      const user = rows.rows[0];
      if (!user) return err(res, 'No account found with this email.', 401);
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return err(res, 'Incorrect password.', 401);
      const token = signToken({ sub: user.id, email: user.email });
      return ok(res, { token, user: { id: user.id, email: user.email } });
    }

    return err(res, 'Unknown action. Use register or login.', 400);
  } catch (e) {
    console.error('auth error:', e.message);
    return err(res, 'Request failed: ' + e.message, 500);
  }
}