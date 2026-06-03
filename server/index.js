/**
 * Product Imagination Agents OS — Backend Proxy Server
 * Serves all static files + proxies OpenAI & Anthropic (keys never reach the browser)
 *
 * Render setup:
 *   Root directory: server           (or leave blank and set build/start below)
 *   Build command:  npm install
 *   Start command:  node index.js
 *   Environment:    OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '4mb' }));

// ── Static files — serve everything from the REPO ROOT (one level up) ──────
const STATIC_DIR = path.join(__dirname, '..');
app.use(express.static(STATIC_DIR, {
  index: 'index.html',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

// ── Build-time info ────────────────────────────────────────────────────────
const BUILD_TIME  = new Date().toISOString();
const GIT_COMMIT  = process.env.RENDER_GIT_COMMIT || 'local';

// ── /api/version — confirms the proxy is running (not a static-file serve) ─
app.get('/api/version', (_req, res) => {
  res.json({ ok: true, server: 'pi-agents-os', commit: GIT_COMMIT, built: BUILD_TIME });
});

// ── /api/status — key presence check used by the portal ────────────────────
app.get('/api/status', (_req, res) => {
  const hasOai = !!process.env.OPENAI_API_KEY    && process.env.OPENAI_API_KEY    !== 'sk-...';
  const hasAnt = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-...';
  res.json({
    ok:        true,
    commit:    GIT_COMMIT,
    openai:    hasOai,
    anthropic: hasAnt,
    voice:     process.env.OPENAI_VOICE || 'nova',
  });
});

// ── /api/anthropic — Claude Sonnet ─────────────────────────────────────────
app.post('/api/anthropic', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'sk-ant-...') {
    return res.status(503).json({ error: 'Anthropic API key not configured on server.' });
  }
  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Anthropic]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── /api/openai/speech — OpenAI TTS-HD (returns MP3 binary) ────────────────
app.post('/api/openai/speech', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'sk-...') {
    return res.status(503).json({ error: 'OpenAI API key not configured on server.' });
  }
  const body = {
    model:           'tts-1-hd',
    input:           req.body.input || '',
    voice:           req.body.voice || process.env.OPENAI_VOICE || 'nova',
    speed:           req.body.speed || 0.92,
    response_format: 'mp3',
  };
  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body:    JSON.stringify(body),
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).send(t); }
    const buf = await r.arrayBuffer();
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
    res.status(200).send(Buffer.from(buf));
  } catch (err) {
    console.error('[TTS]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── /api/openai/transcribe — Whisper voice-to-text ─────────────────────────
app.post('/api/openai/transcribe', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'sk-...') {
    return res.status(503).json({ error: 'OpenAI API key not configured on server.' });
  }
  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': req.headers['content-type'] },
      body:    req,
      duplex:  'half',
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[Whisper]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── /api/openai — GPT-4o chat completions ──────────────────────────────────
app.post('/api/openai', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === 'sk-...') {
    return res.status(503).json({ error: 'OpenAI API key not configured on server.' });
  }
  try {
    const { default: fetch } = await import('node-fetch');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body:    JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error('[OpenAI]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Catch-all: SPA fallback → index.html ───────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  const hasOai = !!process.env.OPENAI_API_KEY    && process.env.OPENAI_API_KEY    !== 'sk-...';
  const hasAnt = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-...';
  console.log(`\n✅  Product Imagination Agents OS`);
  console.log(`    Listening on ${HOST}:${PORT}`);
  console.log(`    OpenAI:    ${hasOai ? '✓ connected' : '✗ key missing — add to Render Environment'}`);
  console.log(`    Anthropic: ${hasAnt ? '✓ connected' : '✗ key missing — add to Render Environment'}`);
  console.log(`    Commit:    ${GIT_COMMIT}\n`);
});
