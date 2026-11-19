/**
 * Cloudflare Worker — linzefei.com 接口网关
 *
 * 2026-11-19 起：留词改为「只支持作者本人」——作者在 /admin 后台
 * （GitHub OAuth 登录）直接添加词，公开提交通道关闭。
 * 本 Worker 不再写入任何词，/submit-word 一律返回 403。
 * 点亮（ignite）走 Supabase RPC toggle_ignite，不经过本 Worker。
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim());
    const isAllowed = allowed.includes(origin);
    const allowHeader = isAllowed ? origin : allowed[0];

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
      return json({ error: 'method not allowed' }, 405, allowHeader);
    }

    const url = new URL(request.url);

    if (url.pathname === '/submit-word') {
      return json({
        error: 'word submission is closed',
        detail: 'This galaxy only accepts words from its owner (via admin). Visitors can ignite words instead.'
      }, 403, allowHeader);
    }

    return json({ error: 'not found' }, 404, allowHeader);
  }
};

function json(body, status, allowHeader) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowHeader,
      'Content-Type': 'application/json'
    }
  });
}
