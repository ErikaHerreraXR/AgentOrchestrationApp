const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { email, product, source } = body;

  // Validate email
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!clean || !clean.includes('@') || !clean.includes('.') || clean.length > 254) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  try {
    const store = getStore('email-submissions');

    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 9);
    const key = `sub_${ts}_${rand}`;

    await store.setJSON(key, {
      email: clean,
      product: String(product || 'unknown').slice(0, 200),
      source: String(source || 'website').slice(0, 100),
      timestamp: ts,
      date: new Date(ts).toISOString(),
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[collect-email] storage error:', err.message);
    // Still return success to the user — don't block downloads over a storage error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, warn: 'storage_error' }),
    };
  }
};
