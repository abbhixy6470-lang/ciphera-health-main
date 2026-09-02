// GET /api/health — verifies the serverless function and DB connectivity.
import { query } from '../db/client.js';

export default async function handler(req, res) {
  // CORS for local static testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const t0 = Date.now();
    const db = await query('SELECT NOW() as now, current_database() as db', []);
    const elapsed = Date.now() - t0;
    res.status(200).json({
      ok: true,
      service: 'ciphera-health-api',
      databaseConnected: true,
      database: db.rows[0]?.db || null,
      serverTime: db.rows[0]?.now || null,
      latencyMs: elapsed,
    });
  } catch (e) {
    console.error('DB health check failed:', e.message);
    res.status(500).json({ ok: false, databaseConnected: false, error: e.message });
  }
}