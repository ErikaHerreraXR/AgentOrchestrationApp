/**
 * collect-email — POST /.netlify/functions/collect-email
 *
 * Appends one email entry to a single consolidated Blob ('all-emails')
 * stored in the 'email-submissions' Blob store.
 *
 * Blob structure: JSON array of entry objects, newest last.
 * Each entry: { email, product, source, timestamp, date }
 *
 * On concurrent writes the last writer wins (acceptable at this scale).
 * We retry up to 3x on transient errors before giving up silently so the
 * user is never blocked from their download.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'email-submissions';
const BLOB_KEY   = 'all-emails';
const MAX_TRIES  = 3;

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = { ...cors, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: json, body: JSON.stringify({ error: 'Method not allowed' }) };

  // ── Parse & validate ──────────────────────────────────────────
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, product, source } = body;
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!clean || !clean.includes('@') || !clean.includes('.') || clean.length > 254) {
    return { statusCode: 400, headers: json, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const entry = {
    email:     clean,
    product:   String(product || 'unknown').slice(0, 200),
    source:    String(source  || 'website').slice(0, 100),
    timestamp: Date.now(),
    date:      new Date().toISOString(),
  };

  // ── Append to consolidated blob (with retry) ──────────────────
  let stored = false;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    try {
      const store = getStore(STORE_NAME);

      // Read current list (null if first submission ever)
      const existing = await store.get(BLOB_KEY, { type: 'json' });
      const list = Array.isArray(existing) ? existing : [];

      list.push(entry);

      await store.set(BLOB_KEY, JSON.stringify(list), {
        metadata: { count: list.length, updated: new Date().toISOString() },
      });

      stored = true;
      break;
    } catch (err) {
      console.error(`[collect-email] attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_TRIES - 1) {
        // Brief back-off before retry
        await new Promise(r => setTimeout(r, 80 * (attempt + 1)));
      }
    }
  }

  // Always return success — never block the user's download over a storage issue
  return {
    statusCode: 200,
    headers: json,
    body: JSON.stringify({ success: true, stored }),
  };
};
