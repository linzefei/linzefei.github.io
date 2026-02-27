/**
 * Cloudflare Worker — 词提交网关
 *
 * 环境变量（在 CF 控制台 / wrangler secret put 设置，不写进代码）：
 *   TURNSTILE_SECRET     — Cloudflare Turnstile secret key
 *   SUPABASE_SERVICE_ROLE — Supabase service_role key
 *
 * 公开变量（wrangler.toml [vars] 里设置即可）：
 *   SUPABASE_URL         — https://xxxxx.supabase.co
 *   ALLOWED_ORIGIN       — https://linzefei.github.io （或自定义域名）
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return corsResponse('', 204, origin, env);
    }

    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'method not allowed' }), 405, origin, env);
    }

    const url = new URL(request.url);

    if (url.pathname === '/submit-word') {
      return handleSubmitWord(request, env, origin);
    }

    return corsResponse(JSON.stringify({ error: 'not found' }), 404, origin, env);
  }
};

async function handleSubmitWord(request, env, origin) {
  // ── 解析请求体 ──────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: 'invalid json' }), 400, origin, env);
  }

  const { word, visitor_id, turnstile_token } = body;

  // ── 基本校验 ────────────────────────────────────────────────────────────
  const trimmed = (word || '').trim();
  if (!trimmed || trimmed.length > 20) {
    return corsResponse(JSON.stringify({ error: 'invalid word' }), 400, origin, env);
  }
  if (!visitor_id || typeof visitor_id !== 'string') {
    return corsResponse(JSON.stringify({ error: 'missing visitor_id' }), 400, origin, env);
  }
  if (!turnstile_token) {
    return corsResponse(JSON.stringify({ error: 'captcha required' }), 400, origin, env);
  }

  // ── 验证 Turnstile CAPTCHA ───────────────────────────────────────────────
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const form = new FormData();
  form.append('secret',   env.TURNSTILE_SECRET);
  form.append('response', turnstile_token);
  form.append('remoteip', ip);

  const tsRes  = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form
  });
  const tsData = await tsRes.json();

  if (!tsData.success) {
    return corsResponse(JSON.stringify({ error: 'captcha failed', codes: tsData['error-codes'] }), 403, origin, env);
  }

  // ── 写入 Supabase（service_role，绕过 RLS 限制但有代码层校验）─────────────
  const sbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/visitor_words`, {
    method: 'POST',
    headers: {
      'apikey':        env.SUPABASE_SERVICE_ROLE,
      'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify({ word: trimmed, visitor_id, source: 'visitor' })
  });

  if (!sbRes.ok) {
    const errText = await sbRes.text();
    return corsResponse(JSON.stringify({ error: 'db error', detail: errText }), 500, origin, env);
  }

  return corsResponse(JSON.stringify({ ok: true }), 200, origin, env);
}

function corsResponse(body, status, origin, env) {
  // 只允许配置的来源，防止跨站滥用
  const allowedOrigin = (env && env.ALLOWED_ORIGIN) ? env.ALLOWED_ORIGIN : '*';
  const allow = (allowedOrigin === '*' || origin === allowedOrigin) ? allowedOrigin : 'null';

  return new Response(body, {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    }
  });
}
