/* ─── Supabase config ─────────────────────────────────────── */
const SUPABASE_URL = 'https://dibqibhjwoogkbdqsrcc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYnFpYmhqd29vZ2tiZHFzcmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjMzNDQsImV4cCI6MjA4NzY5OTM0NH0.Wnvd9RC8kTyQQMrZcQvI2AQBoeja0nMbxKxhJwytIbI';

/* ─── Supabase lightweight client ─────────────────────────── */
class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this._session = null;
        this._loadSession();
    }

    _loadSession() {
        try {
            const raw = localStorage.getItem('sb_session');
            if (raw) this._session = JSON.parse(raw);
        } catch {}
    }

    _saveSession(session) {
        this._session = session;
        if (session) localStorage.setItem('sb_session', JSON.stringify(session));
        else localStorage.removeItem('sb_session');
    }

    _headers(extra = {}) {
        const h = {
            'Content-Type': 'application/json',
            'apikey': this.key,
            ...extra
        };
        if (this._session?.access_token) {
            h['Authorization'] = 'Bearer ' + this._session.access_token;
        } else {
            h['Authorization'] = 'Bearer ' + this.key;
        }
        return h;
    }

    /* Auth */
    /* GitHub OAuth：跳转到 GitHub 授权页 */
    signInWithGitHub() {
        const redirectTo = encodeURIComponent(location.origin + '/admin/index.html');
        location.href = `${this.url}/auth/v1/authorize?provider=github&redirect_to=${redirectTo}`;
    }

    /* OAuth 回调：从 URL hash 解析 token */
    handleOAuthCallback() {
        const hash = location.hash.slice(1);
        if (!hash) return false;
        const p = new URLSearchParams(hash);
        const accessToken  = p.get('access_token');
        const refreshToken = p.get('refresh_token');
        const expiresIn    = parseInt(p.get('expires_in') || '3600');
        if (!accessToken) return false;
        this._saveSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
            expires_at:    Math.floor(Date.now() / 1000) + expiresIn
        });
        history.replaceState(null, '', location.pathname); // 清掉 hash
        return true;
    }

    async signOut() {
        if (this._session?.access_token) {
            await fetch(`${this.url}/auth/v1/logout`, {
                method: 'POST',
                headers: this._headers()
            }).catch(() => {});
        }
        this._saveSession(null);
    }

    async getUser() {
        if (!this._session?.access_token) return null;
        const res = await fetch(`${this.url}/auth/v1/user`, {
            headers: this._headers()
        });
        if (!res.ok) { this._saveSession(null); return null; }
        return res.json();
    }

    isLoggedIn() { return !!this._session?.access_token; }

    /* REST helpers */
    async from(table) {
        return new QueryBuilder(this, table);
    }

    async _req(method, path, body, extra = {}) {
        const res = await fetch(`${this.url}/rest/v1/${path}`, {
            method,
            headers: this._headers({ 'Prefer': 'return=representation', ...extra }),
            body: body ? JSON.stringify(body) : undefined
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!res.ok) throw new Error(data?.message || data?.error || 'Request failed');
        return data;
    }
}

class QueryBuilder {
    constructor(client, table) {
        this._client = client;
        this._table  = table;
        this._params = [];
        this._headers = {};
    }

    select(cols = '*') { this._select = cols; return this; }
    eq(col, val)       { this._params.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
    order(col, { ascending = true } = {}) {
        this._params.push(`order=${col}.${ascending ? 'asc' : 'desc'}`);
        return this;
    }
    limit(n)  { this._params.push(`limit=${n}`); return this; }
    range(from, to) { this._headers['Range'] = `${from}-${to}`; return this; }

    _url() {
        const cols = this._select ? `select=${encodeURIComponent(this._select)}` : 'select=*';
        const qs = [cols, ...this._params].join('&');
        return `${this._table}?${qs}`;
    }

    async get() {
        return this._client._req('GET', this._url(), null, this._headers);
    }
    async insert(data) {
        return this._client._req('POST', this._table, data);
    }
    async update(data) {
        const url = this._url().replace(`select=*`, '');
        return this._client._req('PATCH', `${this._table}?${this._params.join('&')}`, data);
    }
    async delete() {
        return this._client._req('DELETE', `${this._table}?${this._params.join('&')}`, null);
    }
    async upsert(data) {
        return this._client._req('POST', this._table, data, {
            'Prefer': 'return=representation,resolution=merge-duplicates'
        });
    }
}

/* ─── Singleton ───────────────────────────────────────────── */
const sb = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON);

/* ─── Guard: redirect to login if not authed ─────────────── */
async function requireAuth() {
    if (!sb.isLoggedIn()) {
        location.href = '/admin/index.html';
        return false;
    }
    const user = await sb.getUser().catch(() => null);
    if (!user) {
        location.href = '/admin/index.html';
        return false;
    }
    return user;
}

/* ─── Toast ───────────────────────────────────────────────── */
function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
