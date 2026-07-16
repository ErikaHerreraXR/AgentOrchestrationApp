const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Expected amount in cents per pack — must match frontend PACK_PRICES
const PACK_AMOUNTS = {
  starter:  1700,
  growth:   4700,
  creator:  9700,
  business: 29700,
  ceo:      49700,
};

function issueToken(pack) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const payload = Buffer.from(JSON.stringify({
    pack,
    iat: Date.now(),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + sig;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { paymentIntentId, pack } = JSON.parse(event.body);

    if (!paymentIntentId || !pack || !PACK_AMOUNTS[pack]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    // Verify directly with Stripe — cannot be faked by the client
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return { statusCode: 402, body: JSON.stringify({ error: 'Payment not confirmed' }) };
    }

    if (pi.amount !== PACK_AMOUNTS[pack]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Amount mismatch' }) };
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
