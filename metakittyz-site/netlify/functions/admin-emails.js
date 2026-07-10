/**
 * admin-emails — GET /.netlify/functions/admin-emails?password=xxx
 *
 * Returns the full email list as JSON for the admin dashboard.
 * Requires ADMIN_PASSWORD env var set in Netlify → Site settings → Environment variables.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'email-submissions';
const BLOB_KEY   = 'all-emails';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };

  // ── Auth ──────────────────────────────────────────────────────
  const provided = (event.queryStringParameters || {}).password || '';
  const expected = process.env.ADMIN_PASSWORD || '';

  if (!expected) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'ADMIN_PASSWORD not configured — add it in Netlify → Site settings → Environment variables' }) };
  }
  if (provided !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // ── Read blob ─────────────────────────────────────────────────
  try {
    const store = getStore(STORE_NAME);
    const data  = await store.get(BLOB_KEY, { type: 'json' });
    const list  = Array.isArray(data) ? data : [];

    // Sort newest first
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Stats
    const unique = new Set(list.map(e => e.email)).size;
    const today  = new Date().toDateString();
    const todayCount = list.filter(e => new Date(e.date).toDateString() === today).length;

    const byProduct = {};
    for (const e of list) {
      const p = e.product || 'unknown';
      byProduct[p] = (byProduct[p] || 0) + 1;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ total: list.length, unique, todayCount, byProduct, entries: list }),
    };
  } catch (err) {
    console.error('[admin-emails]', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to read blob', detail: err.message }) };
  }
};
