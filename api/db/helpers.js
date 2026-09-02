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