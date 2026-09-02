// POST /api/doctor — real AI Doctor backed by Google Gemini.
//
// Request body:
//   { question, profile, history }
//     question : the patient's question (string)
//     profile  : a compact text summary of the patient's medicines, allergies,
//                conditions, and adherence (string) — built client-side
//                by js/ai-doctor.js (Doctor.profileToText)
//     history  : optional array of { role: 'user'|'assistant', content: string }
//                prior turns for conversation context (max ~10 turns)
//
// Response: { ok: true, answer } — where answer is the generated text.
// If no GEMINI_API_KEY is configured, we return { ok: false, error: 'config' }
// so the client can fall back to its local knowledge base.

import { corsHeaders, sendOptions, ok, err } from './db/helpers.js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function generateContentUrl(model, key) {
  return `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`;
}

function buildSystemPrompt(profile) {
  return (
    'You are a compassionate, personalized AI doctor assistant for the "Ciphera Health+" medication app. ' +
    'You help a patient understand their medicines, doses, allergies, and general health in simple, clear, ' +
    'supportive language.\n\n' +
    'Rules you MUST follow:\n' +
    '- Provide educational explanations only. Do NOT diagnose, do NOT give definitive medical advice, and do NOT ' +
    'prescribe. Do NOT override a real doctor\'s instructions.\n' +
    '- If the question involves a medicine that conflicts with the patient\'s allergy list, clearly warn about it\n' +
    '- Keep answers clear and reassuring. Use short paragraphs. Answer the question directly and warmly.\n' +
    '- Always include a gentle reminder that this is educational info and the patient should consult their real ' +
    'doctor or pharmacist for any medical decision, especially urgent symptoms.\n\n' +
    'Here is the patient\'s current profile:\n' +
    '---BEGIN PROFILE---\n' +
    (profile || '(no profile data provided)') +
    '\n---END PROFILE---'
  );
}

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(corsHeaders())) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return sendOptions(res);
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    // Not configured server-side — tell the client to use its local fallback.
    return ok(res, { answer: '', source: 'local', error: 'config', hasKey: false, envPresent: ('GEMINI_API_KEY' in process.env) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return err(res, 'Invalid JSON body', 400);
  }

  const question = String(body.question || '').slice(0, 4000);
  if (!question.trim()) return err(res, 'Missing question', 400);

  const profile = String(body.profile || '').slice(0, 6000);
  const history = Array.isArray(body.history) ? body.history.slice(-20) : [];

  const system = { role: 'user', parts: [{ text: buildSystemPrompt(profile) }] };

  // Map prior turns into Gemini conversation parts (excluding any user turns
  // that equal the system prompt, and the final user question which we add).
  const turns = [];
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user';
    turns.push({ role, parts: [{ text: String(h.content).slice(0, 3000) }] });
  }
  turns.push({ role: 'user', parts: [{ text: question }] });

  const contents = [system, ...turns];

  try {
    const resp = await fetch(generateContentUrl(GEMINI_MODEL, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Gemini HTTP ' + resp.status, detail.slice(0, 500));
      if (resp.status === 429 || resp.status >= 500) {
        return ok(res, { answer: '', source: 'local', error: 'upstream' });
      }
      return err(res, 'Gemini request failed: ' + resp.status, 502);
    }

    const data = await resp.json();
    const answer = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();

    if (!answer) {
      return ok(res, { answer: '', source: 'local', error: 'empty' });
    }
    return ok(res, { answer, source: 'gemini' });
  } catch (e) {
    console.error('doctor error:', e.message);
    return ok(res, { answer: '', source: 'local', error: 'upstream' });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}