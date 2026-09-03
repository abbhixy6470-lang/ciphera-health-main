// POST /api/wearable — analyze smart wearable vitals + medication adherence
// to detect potential health risks (e.g. high glucose + missed insulin doses).
//
// Request body: { metrics: [{ metric, value, unit, readingTime }], medicines, logs, patient }
// Response:   { risk, summary, signals }

import { corsHeaders, sendOptions, ok, err } from './db/helpers.js';

// ── clinical reference ranges ─────────────────────────────────────────────
const RANGES = {
  heart_rate:      { low: 60, high: 100, unit: 'bpm' },
  resting_heart:   { low: 60, high: 100, unit: 'bpm' },
  spo2:            { low: 95, high: 100, unit: '%' },
  glucose:         { low: 70, high: 180, unit: 'mg/dL' },
  blood_glucose:   { low: 70, high: 180, unit: 'mg/dL' },
  systolic_bp:     { low: 90, high: 140, unit: 'mmHg' },
  diastolic_bp:    { low: 60, high: 90, unit: 'mmHg' },
  sleep_hours:     { low: 7,  high: 9,  unit: 'h' },
  sleep:           { low: 7,  high: 9,  unit: 'h' }
};

// Map a metric name to a canonical category
function classify(metric) {
  const m = String(metric || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (m.includes('heart') || m.includes('hr') || m === 'pulse') return 'heart_rate';
  if (m.includes('spo2') || m.includes('oxygen') || m.includes('saturation')) return 'spo2';
  if (m.includes('glucose') || m.includes('sugar') || m.includes('hba1c')) return 'glucose';
  if (m.includes('systolic') || m === 'bp' || m === 'bloodpressure') return 'systolic_bp';
  if (m.includes('diastolic')) return 'diastolic_bp';
  if (m.includes('sleep')) return 'sleep';
  return null;
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return err(res, 'Invalid JSON body', 400);
  }

  const metrics = Array.isArray(body.metrics) ? body.metrics : [];
  const medicines = Array.isArray(body.medicines) ? body.medicines : [];
  const logs = Array.isArray(body.logs) ? body.logs : [];
  const patient = body.patient || {};

  const analysis = analyze(metrics, medicines, logs, patient);
  return ok(res, analysis);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 4e6) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function analyze(metrics, medicines, logs, patient) {
  const signals = [];
  let risk = 0; // 0-100
  const latest = {};
  const thresholds = {}; // metric category -> { value, unit, label }

  // 1. Gather latest reading per canonical metric
  const grouped = {};
  for (const m of metrics) {
    if (m.value === undefined || m.value === null) continue;
    const cat = classify(m.metric);
    if (!cat) continue;
    if (!grouped[cat] || grouped[cat].readingTime < (m.readingTime || 0)) {
      grouped[cat] = m;
    }
  }
  for (const cat of Object.keys(grouped)) {
    const reading = grouped[cat];
    latest[cat] = reading.value;
    const label = reading.label || reading.metric || cat;
    const range = RANGES[cat];
    thresholds[cat] = { value: reading.value, unit: reading.unit || (range ? range.unit : ''), label };
    if (!range) continue;

    if (reading.value < range.low) {
      const severity = reading.value < range.low * 0.85 ? 'high' : 'moderate';
      risk += severity === 'high' ? 18 : 10;
      signals.push({
        level: severity,
        metric: cat,
        label,
        message: `${label} is LOW (${reading.value} ${reading.unit || range.unit}). Reference range: ${range.low}–${range.high}.`
      });
    } else if (reading.value > range.high) {
      const severity = reading.value > range.high * 1.15 ? 'high' : 'moderate';
      risk += severity === 'high' ? 18 : 10;
      signals.push({
        level: severity,
        metric: cat,
        label,
        message: `${label} is HIGH (${reading.value} ${reading.unit || range.unit}). Reference range: ${range.low}–${range.high}.`
      });
    }
  }

  // 2. Detect missed doses today
  const today = new Date().toISOString().split('T')[0];
  let scheduledTotal = 0;
  let takenCount = 0;
  const missed = [];
  const todayLogs = logs.filter(l => l.date === today);

  for (const med of medicines) {
    if (!med.schedule || !med.schedule.enabled) continue;
    const times = Array.isArray(med.schedule.times) ? med.schedule.times : [];
    for (const t of times) {
      scheduledTotal++;
      const log = todayLogs.find(l => l.medicine_id === med.id && l.scheduled_time === t);
      if (log && log.status === 'TAKEN') takenCount++;
      else if (log && log.status === 'SKIPPED') {
        missed.push({ medicine: med.name, time: t, reason: 'skipped' });
      } else {
        missed.push({ medicine: med.name, time: t, reason: 'not recorded' });
      }
    }
  }

  const adherence = scheduledTotal > 0 ? Math.round((takenCount / scheduledTotal) * 100) : 100;
  if (scheduledTotal > 0 && adherence < 80) {
    risk += Math.round((100 - adherence) / 10) * 4;
    signals.push({
      level: adherence < 50 ? 'high' : 'moderate',
      metric: 'adherence',
      label: 'Medication Adherence',
      message: `Only ${adherence}% of today's ${scheduledTotal} scheduled dose(s) recorded taken. Missed: ${missed.map(m => m.medicine + '@' + m.time).join(', ') || 'none'}.`
    });
  }

  // 3. Cross-signal: high glucose + skipped/missed antidiabetic meds
  const bg = latest['glucose'];
  const antidiabetics = medicines.filter(m =>
    /diabet|insulin|glucose|metformin|glipizide|gliclazide/i.test((m.name || '') + ' ' + (m.category || '')));
  const hasMissedAntiDiabetic = antidiabetics.length > 0 && missed.filter(m => antidiabetics.some(ad => m.medicine && ad.name === m.medicine)).length > 0;

  if (bg !== undefined && hasMissedAntiDiabetic) {
    risk += 15;
    signals.push({
      level: 'high',
      metric: 'cross-signal',
      label: 'Glucose + Adherence',
      message: `CRITICAL PATTERN: Blood glucose is ${bg} and a diabetes-related medicine dose was missed/skipped. This combination raises risk of hyperglycemic complications.`
    });
  }

  // 4. High heart rate + missed cardiovascular meds
  const hr = latest['heart_rate'];
  const cvMeds = medicines.filter(m =>
    /cardi|blood pressure|hypertension|amlodipine|beta|atorvastatin|losartan|metoprolol/i.test((m.name || '') + ' ' + (m.category || '')));
  const hasMissedCV = cvMeds.length > 0 && missed.filter(m => cvMeds.some(cm => m.medicine && cm.name === m.medicine)).length > 0;

  if (hr !== undefined && hr > RANGES.heart_rate.high && hasMissedCV) {
    risk += 15;
    signals.push({
      level: 'high',
      metric: 'cross-signal',
      label: 'Heart Rate + Adherence',
      message: `Elevated heart rate (${hr} bpm) combined with a missed cardiovascular dose. Monitored by wearable should be paired with medication adherence.`
    });
  }

  // 5. Low spo2 independent risk
  if (latest['spo2'] !== undefined && latest['spo2'] < 92) {
    risk += 12;
    signals.push({
      level: 'high',
      metric: 'spo2',
      label: 'Blood Oxygen',
      message: `Oxygen saturation is critically low (${latest['spo2']}%). Seek medical attention if persists.`
    });
  }

  risk = Math.max(0, Math.min(100, risk));

  let riskLabel = 'Low';
  let advice = 'Your vitals look within healthy ranges and adherence is on track. Keep it up.';
  if (risk >= 60) {
    riskLabel = 'High';
    advice = 'Immediate attention recommended. Multiple risk signals detected — review with your healthcare provider, take scheduled doses, and monitor vitals closely.';
  } else if (risk >= 30) {
    riskLabel = 'Elevated';
    advice = 'Some risk signals detected. Consider taking missed doses and monitoring your vitals. A follow-up with your doctor is advised for persistent abnormal readings.';
  } else if (risk >= 10) {
    riskLabel = 'Moderate';
    advice = 'Minor deviations noted. Pay attention to your medication schedule and wearable readings for the next few days.';
  }

  return {
    risk,
    riskLabel,
    summary: advice,
    signals,
    thresholds,
    adherence,
    readingWindow: Math.max(0, metrics.length)
  };
}
