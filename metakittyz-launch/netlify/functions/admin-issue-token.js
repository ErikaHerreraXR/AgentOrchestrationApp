const crypto = require('crypto');

const VALID_PACKS = ['starter', 'growth', 'creator', 'business', 'ceo'];

function issueToken(pack) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const payload = Buffer.from(JSON.stringify({
    pack,
    iat: Date.now(),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
    source: 'admin',
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + sig;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { adminPassword, pack } = JSON.parse(event.body);

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!VALID_PACKS.includes(pack)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid pack' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: issueToken(pack) }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
