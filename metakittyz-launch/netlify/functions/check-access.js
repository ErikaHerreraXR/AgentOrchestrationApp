const crypto = require('crypto');

function verifyToken(token) {
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig     = token.slice(dot + 1);

    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig,      'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null; // expired
    return data;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { tokens } = JSON.parse(event.body);
    if (!Array.isArray(tokens)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'tokens must be an array' }) };
    }

    const unlockedPacks = [];
    for (const tok of tokens) {
      const data = verifyToken(String(tok));
      if (data && data.pack) unlockedPacks.push(data.pack);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlockedPacks }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
