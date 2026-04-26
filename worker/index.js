/**
 * Cloudflare Worker — 词提交网关
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim());
    const isAllowed = allowed.includes(origin);
    const allowHeader = isAllowed ? origin : allowed[0];

    // 处理预检请求 (Preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowHeader,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), { 
        status: 405, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowHeader } 
      });
    }

    const url = new URL(request.url);
    let response;

    if (url.pathname === '/submit-word') {
      response = await handleSubmitWord(request, env);
    } else {
      response = new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    }

    // 为所有响应添加 CORS 头
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', allowHeader);
    newHeaders.set('Content-Type', 'application/json');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};

async function handleSubmitWord(request, env) {
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 }); }

  const { word, visitor_id, turnstile_token } = body;
  const trimmed = (word || '').trim();

  if (!trimmed || trimmed.length > 20) return new Response(JSON.stringify({ error: 'invalid word' }), { status: 400 });
  if (!visitor_id) return new Response(JSON.stringify({ error: 'missing visitor_id' }), { status: 400 });
  if (!turnstile_token) return new Response(JSON.stringify({ error: 'captcha required' }), { status: 400 });

  // 1. 验证 Turnstile
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', turnstile_token);
  form.append('remoteip', ip);

  const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const tsData = await tsRes.json();
  if (!tsData.success) return new Response(JSON.stringify({ error: 'captcha failed', detail: tsData['error-codes'] }), { status: 403 });

  // 2. 写入 Supabase
  const sbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/visitor_words`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ word: trimmed, visitor_id, source: 'visitor' })
  });

  if (!sbRes.ok) {
    const detail = await sbRes.text();
    return new Response(JSON.stringify({ error: 'db error', detail }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
