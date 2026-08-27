'use strict';
const { json, parseBody, preflight } = require('./_shared');

exports.handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'OpenAI speech is not configured.' });
  const body = parseBody(event);
  if (!body) return json(400, { error: 'Invalid JSON body.' });
  body.voice = body.voice || process.env.OPENAI_VOICE || 'nova';
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) return json(response.status, { error: await response.text() });
    const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
    return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }, body: audio };
  } catch (error) { return json(502, { error: 'Speech request failed.', detail: error.message }); }
};
