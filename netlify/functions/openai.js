'use strict';
const { json, parseBody, preflight } = require('./_shared');

exports.handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'OpenAI is not configured.' });
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON body.' });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    return json(response.status, await response.json());
  } catch (error) { return json(502, { error: 'OpenAI request failed.', detail: error.message }); }
};
