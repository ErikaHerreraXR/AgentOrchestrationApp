/**
 * Product Imagination Agents OS — API Proxy Worker
 * Deploy to Cloudflare Workers (free tier: 100k requests/day)
 *
 * SETUP (5 minutes):
 * 1. npm install -g wrangler
 * 2. wrangler login
 * 3. cd proxy && wrangler deploy
 * 4. wrangler secret put OPENAI_KEY      ← paste your OpenAI key
 * 5. wrangler secret put ANTHROPIC_KEY   ← paste your Anthropic key
 * 6. Copy the deployed URL into the portal's API Settings → Proxy URL field
 *
 * Your API keys live encrypted in Cloudflare's environment.
 * They NEVER touch the browser or get stored client-side.
 */

export default {
  async fetch(request, env) {

    const CORS = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Portal-Token',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, CORS);
    }

    const url   = new URL(request.url);
    const path  = url.pathname;
    let body;

    try {
      body = await request.text();
    } catch {
      return json({ error: 'Invalid request body' }, 400, CORS);
    }

    try {
      // ── Route: /ai/openai/v1/chat/completions ─────────────────────
      if (path.startsWith('/ai/openai/')) {
        if (!env.OPENAI_KEY) return json({ error: 'OpenAI key not configured on server' }, 500, CORS);

        const target = 'https://api.openai.com' + path.replace('/ai/openai', '');
        const res = await fetch(target, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + env.OPENAI_KEY,
          },
          body,
        });

        return new Response(await res.text(), {
          status:  res.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // ── Route: /ai/anthropic/v1/messages ──────────────────────────
      if (path.startsWith('/ai/anthropic/')) {
        if (!env.ANTHROPIC_KEY) return json({ error: 'Anthropic key not configured on server' }, 500, CORS);

        const target = 'https://api.anthropic.com' + path.replace('/ai/anthropic', '');
        const res = await fetch(target, {
          method:  'POST',
          headers: {
            'Content-Type':    'application/json',
            'x-api-key':       env.ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body,
        });

        return new Response(await res.text(), {
          status:  res.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // ── Health check ──────────────────────────────────────────────
      if (path === '/health') {
        return json({
          status: 'ok',
          openai:    env.OPENAI_KEY    ? 'configured' : 'missing',
          anthropic: env.ANTHROPIC_KEY ? 'configured' : 'missing',
        }, 200, CORS);
      }

      return json({ error: 'Not found' }, 404, CORS);

    } catch (err) {
      return json({ error: 'Proxy error: ' + err.message }, 502, CORS);
    }
  },
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
