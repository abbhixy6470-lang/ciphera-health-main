// Shared helpers for Ciphera Health+ serverless functions.
import crypto from 'crypto';

// ── CORS ───────────────────────────────────────────────────────────────
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

// ── Response helpers ───────────────────────────────────────────────────
export function ok(res, data, code = 200) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, ...data }));
}

export function err(res, message, code = 400) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) reject(new Error('Body too large')); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

export function sendOptions(res) {
  res.writeHead(204, corsHeaders());
  res.end();
}

// ── Utility ────────────────────────────────────────────────────────────
export function uid(prefix = 'id') {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

export function now() {
  return Date.now();
}

// SHA-256 hashing identical to the browser module (js/caregivers.js) so
// server-side verification of browser-registered caregivers matches.
export function hashPassword(raw) {
  return crypto.createHash('sha256').update('ciphera-salt::' + raw).digest('hex');
}

let cachedSessionSecret = process.env.SESSION_SECRET || 'ciphera_dev_secret_change_me';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
export function signToken(payload, ttl = SESSION_TTL) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttl })).toString('base64url');
  const sig = crypto.createHmac('sha256', cachedSessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expect = crypto.createHmac('sha256', cachedSessionSecret).update(body).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expect)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null; // expired
    return payload;
  }
  catch { return null; }
}