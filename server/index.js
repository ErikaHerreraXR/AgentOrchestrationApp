/**
 * Product Imagination Agents OS — Backend Proxy Server
 *
 * Keeps your API keys on the server — clients never see them.
 * Proxies requests to OpenAI and Anthropic on behalf of the portal.
 *
 * SETUP:
 *   1. cd server
 *   2. npm install
 *   3. cp .env.example .env   →  add your real API keys to .env
 *   4. npm start              →  server starts on http://localhost:3000
 *
 * DEPLOY TO RENDER (free):
 *   1. Push this folder to a GitHub repo
 *   2. Create a new Web Service on render.com → connect repo
 *   3. Build command: npm install
 *   4. Start command: npm start
 *   5. Add ANTHROPIC_API_KEY and OPENAI_API_KEY as Environment Variables
 *   6. Copy the Render URL → paste into portal's API Settings → Proxy URL
 */

'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin:  ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '2mb' }));

// Serve the portal files (HTML, icons, hero image, etc.)
app.use(express.static(path.join(__dirname, '..')));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    openai:    process.env.OPENAI_API_KEY    ? 'configured' : 'missing',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
  });
});

// ── Anthropic proxy ────────────────────────────────────────────────────────
app.post('/api/anthropic/*', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Anthropic API key not configured on server.' });

  const targetPath = req.path.replace('/api/anthropic', '');
  const url        = 'https://api.anthropic.com' + targetPath;

  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[Anthropic proxy]', err.message);
    res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
});

// ── OpenAI proxy ────────────────────────────────────────────────────────────
app.post('/api/openai/*', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OpenAI API key not configured on server.' });

  const targetPath = req.path.replace('/api/openai', '');
  const url        = 'https://api.openai.com' + targetPath;

  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + key,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('[OpenAI proxy]', err.message);
    res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
});

// ── OpenAI audio (Whisper transcription) ────────────────────────────────────
app.post('/api/openai/v1/audio/transcriptions', async (req, res) => {
  // Handled by the wildcard above — included here for clarity
  res.status(405).json({ error: 'Use multipart form upload directly to this endpoint.' });
});

// ── Fallback → serve portal ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client-portal.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✓ Product Imagination Agents OS`);
  console.log(`  Server:    http://localhost:${PORT}`);
  console.log(`  Portal:    http://localhost:${PORT}/client-portal.html`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  OpenAI:    ${process.env.OPENAI_API_KEY    ? '✓ configured' : '✗ missing — add to .env'}`);
  console.log(`  Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ missing — add to .env'}\n`);
});
