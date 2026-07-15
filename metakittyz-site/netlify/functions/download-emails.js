/**
 * download-emails — GET /.netlify/functions/download-emails?password=xxx
 *
 * Returns the complete email list as a downloadable CSV file.
 * Hitting this URL from a browser immediately triggers a file download.
 *
 * Optional query params:
 *   ?format=csv   (default) — comma-separated
 *   ?format=json  — raw JSON array
 *
 * Requires ADMIN_PASSWORD env var in Netlify → Site settings → Environment variables.
 */

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'email-submissions';
const BLOB_KEY   = 'all-emails';

function toCSV(list) {
  const esc = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
  const header = ['Email', 'Product', 'Source', 'Date (UTC)', 'Timestamp'].join(',');
  const rows = list.map(e =>
    [e.email, e.product, e.source, e.date, e.timestamp].map(esc).join(',')
  );
  return [header, ...rows].join('\r\n');
}

exports.handler = async (event) => {
  // ── Auth ──────────────────────────────────────────────────────
  const qs       = event.queryStringParameters || {};
  const provided = qs.password || '';
  const expected = process.env.ADMIN_PASSWORD || '';

  if (!expected) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'text/plain' },
      body: 'ADMIN_PASSWORD env var not configured.',
    };
  }
  if (provided !== expected) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Unauthorized.',
    };
  }

  // ── Read blob ─────────────────────────────────────────────────
  try {
    const store = getStore(STORE_NAME);
    const data  = await store.get(BLOB_KEY, { type: 'json' });
    const list  = Array.isArray(data) ? data : [];

    // Sort oldest first for the file (chronological reading order)
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const dateStr = new Date().toISOString().slice(0, 10);
    const format  = (qs.format || 'csv').toLowerCase();

    if (format === 'json') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="metakittyz-emails-${dateStr}.json"`,
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify(list, null, 2),
      };
    }

    // Default: CSV
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="metakittyz-emails-${dateStr}.csv"`,
        'Cache-Control': 'no-store',
      },
      body: toCSV(list),
    };
  } catch (err) {
    console.error('[download-emails]', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Failed to read email list: ' + err.message,
    };
  }
};
