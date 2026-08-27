'use strict';
const { json } = require('./_shared');

exports.handler = async () => json(200, {
  ok: true,
  server: 'netlify-functions',
  commit: process.env.COMMIT_REF || 'local',
  built: process.env.DEPLOY_ID || 'development',
  openai: Boolean(process.env.OPENAI_API_KEY),
  anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  voice: process.env.OPENAI_VOICE || 'nova',
});
