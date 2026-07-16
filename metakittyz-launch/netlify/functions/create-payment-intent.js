const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const VALID_AMOUNTS = { 17: true, 47: true, 97: true, 297: true, 497: true };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, pack } = JSON.parse(event.body);
    const cents = parseInt(amount, 10);

    if (!cents || !VALID_AMOUNTS[cents / 100]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cents,
      currency: 'usd',
      metadata: { pack },
      automatic_payment_methods: { enabled: true },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
