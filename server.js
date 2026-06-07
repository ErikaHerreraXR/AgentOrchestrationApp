// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Product Imagination Agents OS — Proxy Server
//
// Serves all static files AND proxies OpenAI + Anthropic so
// API keys never appear in the browser.
//
// Usage:
//   1. Fill in .env  (OPENAI_API_KEY, ANTHROPIC_API_KEY)
//   2. npm install
//   3. npm start
//   4. Open  http://localhost:3000
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

// ── Load .env ─────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

// Simple .env loader (no extra dependency needed)
try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && key.trim() && !key.trim().startsWith('#')) {
      const val = rest.join('=').trim();
      if (val && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
} catch (_) { /* .env optional */ }

// ── Express ───────────────────────────────────────────────────────
const express = require('express');
const app     = express();

app.use(express.json({ limit: '4mb' }));

// ── Static files (serves index.html, client-portal.html, etc.) ───
app.use(express.static(__dirname, {
  index: 'index.html',
  setHeaders(res, filePath) {
    // Never cache HTML so refreshes always get latest
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// ── Version + health check ────────────────────────────────────────
const BUILD_TIME = new Date().toISOString();
const GIT_COMMIT = process.env.RENDER_GIT_COMMIT || 'local';

app.get('/api/version', (req, res) => {
  res.json({ commit: GIT_COMMIT, built: BUILD_TIME, server: 'pi-agents-os' });
});

// ── API status ────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    ok:        true,
    commit:    GIT_COMMIT,
    openai:    !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-...'),
    anthropic: !!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-...'),
    qwen:      !!process.env.QWEN_API_URL,
    voice:     process.env.OPENAI_VOICE || 'nova',
  });
});

// ── Qwen / Ollama Chat proxy ──────────────────────────────────────
app.post('/api/qwen/chat', async (req, res) => {
  const url = process.env.QWEN_API_URL;
  if (!url) {
    return res.status(503).json({ error: 'QWEN_API_URL not set in Render environment variables.' });
  }
  const body = Object.assign({}, req.body, {
    model: process.env.QWEN_MODEL || 'hf.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive',
  });
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.QWEN_API_KEY) headers['Authorization'] = `Bearer ${process.env.QWEN_API_KEY}`;
  try {
    const upstream = await fetch(`${url.replace(/\/$/, '')}/v1/chat/completions`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[Qwen]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Qwen connectivity test ────────────────────────────────────────
app.get('/api/qwen/test', async (req, res) => {
  const url = process.env.QWEN_API_URL;
  const model = process.env.QWEN_MODEL || 'hf.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive';
  if (!url) {
    return res.json({ ok: false, reason: 'QWEN_API_URL not set in Render environment variables.' });
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.QWEN_API_KEY) headers['Authorization'] = `Bearer ${process.env.QWEN_API_KEY}`;
  try {
    const upstream = await fetch(`${url.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 30,
        messages: [{ role: 'user', content: 'Reply with only the word READY.' }],
      }),
    });
    const data = await upstream.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    res.json({ ok: !!reply, model, url, reply: reply || null, raw: data });
  } catch (err) {
    res.json({ ok: false, model, url, reason: err.message });
  }
});

// ── OpenAI Chat proxy ─────────────────────────────────────────────
app.post('/api/openai', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-...')) {
    return res.status(503).json({ error: 'OpenAI API key not configured on server.' });
  }
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body:    JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[OpenAI]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── OpenAI TTS (speech) proxy ─────────────────────────────────────
app.post('/api/openai/speech', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-...')) {
    return res.status(503).json({ error: 'OpenAI API key not configured.' });
  }
  // Inject the server-side voice preference if client didn't specify
  const body = Object.assign({ voice: process.env.OPENAI_VOICE || 'nova' }, req.body);
  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body:    JSON.stringify(body),
    });
    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(upstream.status).send(err);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    // Stream audio directly to client
    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[TTS]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Anthropic Chat proxy ──────────────────────────────────────────
app.post('/api/anthropic', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith('sk-ant-...')) {
    return res.status(503).json({ error: 'Anthropic API key not configured on server.' });
  }
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[Anthropic]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── OpenAI Whisper (transcription) proxy ─────────────────────────
app.post('/api/openai/transcribe', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-...')) {
    return res.status(503).json({ error: 'OpenAI API key not configured.' });
  }
  // The client sends a FormData body — forward it as-is
  const contentType = req.headers['content-type'] || '';
  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': contentType },
      body:    req,  // pipe raw body
      duplex:  'half',
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[Whisper]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Catch-all → index.html (SPA fallback) ────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0'; // Required for Render and other cloud hosts

app.listen(PORT, HOST, () => {
  const oai = process.env.OPENAI_API_KEY    && !process.env.OPENAI_API_KEY.startsWith('sk-...');
  const ant = process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-...');
  const env = process.env.NODE_ENV || 'development';
  console.log(`\n✅  Product Imagination Agents OS [${env}]`);
  if (env === 'production') {
    console.log(`    Listening on port ${PORT}`);
  } else {
    console.log(`    http://localhost:${PORT}          ← Orchestration app`);
    console.log(`    http://localhost:${PORT}/client-portal.html  ← Client portal`);
  }
  console.log(`\n    OpenAI:    ${oai ? '✓ connected' : '✗ key missing — add to .env or Render dashboard'}`);
  console.log(`    Anthropic: ${ant ? '✓ connected' : '✗ key missing — add to .env or Render dashboard'}`);
  console.log();
});
