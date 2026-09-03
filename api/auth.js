// POST /api/auth — optional Login / Registration for Ciphera Health+.
//
// Login is NOT required to use the app (anonymous device-key sync still
// works). Registering an account gives the user a stable `owner_key` so their
// synced health data follows them across devices, while login authenticates
// an existing account and returns its `owner_key`.
//
//   POST /api/auth/register  { email, password, name? }  -> { owner_key, email, name }
//   POST /api/auth/login     { email, password }         -> { owner_key, email, name }
//
// Passwords are never stored in plain text — they are hashed with Node's
// built-in crypto.scrypt using a per-account random salt.

import crypto from 'crypto';
import { query } from './db/client.js';
import { corsHeaders, sendOptions, ok, err, uid, now } from './db/helpers.js';

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) resolve(null); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

// scrypt hash stored as: salt_hex:hash_hex
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(':');
    const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    return false;
  }
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);

  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '');
  const action = path.split('/').pop();

  if (!['register', 'login'].includes(action)) {
    return err(res, 'Unknown auth action. Use /api/auth/register or /api/auth/login', 404);
  }
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  try {
    const body = await readBody(req);
    if (!body) return err(res, 'Invalid JSON body', 400);

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;

    if (!validEmail(email)) return err(res, 'Please enter a valid email address', 400);
    if (!validPassword(password)) return err(res, 'Password must be at least 6 characters', 400);

    if (action === 'register') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
      const existing = await query('SELECT owner_key FROM accounts WHERE email = $1', [email]);
      if (existing.rows.length) {
        return err(res, 'An account with this email already exists. Try logging in instead.', 409);
      }
      const id = uid('acc');
      const ownerKey = 'acct_' + crypto.randomBytes(16).toString('hex');
      await query(
        `INSERT INTO accounts (id, email, name, password_hash, owner_key, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, email, name, hashPassword(password), ownerKey, now()]
      );
      return ok(res, { owner_key: ownerKey, email, name }, 201);
    }

    // login
    const row = (await query('SELECT owner_key, name, password_hash FROM accounts WHERE email = $1', [email])).rows[0];
    if (!row) return err(res, 'No account found for this email. Please register first.', 401);
    if (!verifyPassword(password, row.password_hash)) return err(res, 'Incorrect password. Please try again.', 401);
    return ok(res, { owner_key: row.owner_key, email, name: row.name || '' });
  } catch (e) {
    console.error('auth error:', e.message);
    return err(res, 'Auth failed: ' + e.message, 500);
  }
}
