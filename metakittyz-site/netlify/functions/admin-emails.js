const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  };

  // Check password — set ADMIN_PASSWORD env var in Netlify dashboard
  const provided = event.queryStringParameters?.password || '';
  const expected = process.env.ADMIN_PASSWORD || '';

  if (!expected) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'ADMIN_PASSWORD env var not configured' }),
    };
  }

  if (provided !== expected) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const store = getStore('email-submissions');
    const { blobs } = await store.list();

    const entries = (
      await Promise.all(
        blobs.map(async (blob) => {
          try {
            return await store.get(blob.key, { type: 'json' });
          } catch {
            return null;
          }
        })
      )
    ).filter(Boolean);

    // Sort newest first
    entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Product summary
    const byProduct = {};
    for (const e of entries) {
      const p = e.product || 'unknown';
      byProduct[p] = (byProduct[p] || 0) + 1;
    }

    // Unique emails
    const unique = new Set(entries.map((e) => e.email)).size;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total: entries.length,
        unique,
        byProduct,
        entries,
      }),
    };
  } catch (err) {
    console.error('[admin-emails] error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch entries', detail: err.message }),
    };
  }
};
