'use strict';
const { json, preflight } = require('./_shared');

exports.handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'OpenAI transcription is not configured.' });
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return json(400, { error: 'A multipart audio upload is required.' });
  }
  try {
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': contentType }, body: rawBody,
    });
    return json(response.status, await response.json());
  } catch (error) { return json(502, { error: 'Transcription request failed.', detail: error.message }); }
};
