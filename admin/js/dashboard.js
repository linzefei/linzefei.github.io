/* ─── Dashboard logic ──────────────────────────────────────── */

let currentUser = null;

async function init() {
    currentUser = await requireAuth();
    if (!currentUser) return;
    document.getElementById('userEmail').textContent = currentUser.email;

    // Tab routing
    const params = new URLSearchParams(location.search);
    switchTab(params.get('tab') || 'overview');

    // Load all data
    loadOverview();
}

/* ─── Tab switching ────────────────────────────────────────── */
function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    const panel = document.getElementById(`tab-${name}`);
    if (btn)   btn.classList.add('active');
    if (panel) panel.classList.add('active');
    history.replaceState(null, '', `?tab=${name}`);

    // Lazy load
    if (name === 'stats')   loadStats();
    if (name === 'content') loadContent();
    if (name === 'tags')    loadTags();
}

/* ─── Overview ─────────────────────────────────────────────── */
async function loadOverview() {
    try {
        // Total visits
        const visits = await (await sb.from('page_visits')).select('id').get();
        document.getElementById('totalVisits').textContent = Array.isArray(visits) ? visits.length : '–';

        // Today
        const today = new Date().toISOString().slice(0, 10);
        const todayVisits = await (await sb.from('page_visits')).select('id').eq('date', today).get();
        document.getElementById('todayVisits').textContent = Array.isArray(todayVisits) ? todayVisits.length : '–';

        // Tags count
        const tags = await (await sb.from('site_tags')).select('id').get();
        document.getElementById('tagsCount').textContent = Array.isArray(tags) ? tags.length : '–';

        // Word count
        const words = await (await sb.from('visitor_words')).select('id').get();
        document.getElementById('contentCount').textContent = Array.isArray(words) ? words.length : '–';

        // Recent visits table
        await loadRecentVisits();
    } catch (e) {
        console.warn('Overview load error:', e);
    }
}

async function loadRecentVisits() {
    try {
        const qb = await sb.from('page_visits');
        const data = await qb.select('visited_at,referrer,user_agent').order('visited_at', { ascending: false }).limit(10).get();
        const tbody = document.getElementById('recentTbody');
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state">暂无访问记录</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${formatTime(r.visited_at)}</td>
                <td>${r.referrer ? `<span style="color:var(--muted)">${r.referrer.slice(0,50)}</span>` : '<span style="color:var(--muted)">直接访问</span>'}</td>
                <td><span style="color:var(--muted);font-size:11px">${(r.user_agent||'').slice(0,40)}…</span></td>
            </tr>
        `).join('');
    } catch (e) {
        document.getElementById('recentTbody').innerHTML = '<tr><td colspan="3" class="empty-state">加载失败</td></tr>';
    }
}

/* ─── Stats tab ────────────────────────────────────────────── */
async function loadStats() {
    try {
        // Fetch all visits grouped by date
        const qb = await sb.from('page_visits');
        const data = await qb.select('date,count').get();

        // Build chart data for last 14 days
        const days = 14;
        const map = {};
        if (Array.isArray(data)) {
            data.forEach(r => { map[r.date] = (map[r.date] || 0) + 1; });
        }
        const labels = [], counts = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            labels.push(key.slice(5)); // MM-DD
            counts.push(map[key] || 0);
        }

        renderChart('chartBars', 'chartLabels', labels, counts);

        // Total unique visitors (by visitor_id)
        const uvQb = await sb.from('page_visits');
        const allVisits = await uvQb.select('visitor_id,date').get();
        if (Array.isArray(allVisits)) {
            const uvSet = new Set(allVisits.map(r => r.visitor_id).filter(Boolean));
            document.getElementById('totalUV').textContent = uvSet.size;
            document.getElementById('totalPV').textContent = allVisits.length;
            // Top referrers
            const refMap = {};
            allVisits.forEach(r => {
                const ref = r.referrer || '直接访问';
                refMap[ref] = (refMap[ref] || 0) + 1;
            });
            const sorted = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
            document.getElementById('refTbody').innerHTML = sorted.map(([ref, cnt]) => `
                <tr>
                    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ref}</td>
                    <td>${cnt}</td>
                    <td>${Math.round(cnt / allVisits.length * 100)}%</td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="empty-state">暂无数据</td></tr>';
        }
    } catch (e) {
        console.warn('Stats load error:', e);
    }
}

function renderChart(barsId, labelsId, labels, counts) {
    const max = Math.max(...counts, 1);
    const barsEl = document.getElementById(barsId);
    const labelsEl = document.getElementById(labelsId);
    barsEl.innerHTML = counts.map((c, i) => `
        <div class="chart-bar" style="height:${Math.max(c / max * 100, 2)}%">
            <div class="tip">${labels[i]}: ${c} 次</div>
        </div>
    `).join('');
    labelsEl.innerHTML = labels.map(l => `<div class="chart-label">${l}</div>`).join('');
}

/* ─── Content tab ──────────────────────────────────────────── */
async function loadContent() {
    try {
        const qb = await sb.from('visitor_words');
        const rows = await qb.select('id,word,approved,source,created_at').order('created_at', { ascending: false }).limit(200).get();
        const words = Array.isArray(rows) ? rows : [];
        const pending  = words.filter(w => !w.approved);
        const approved = words.filter(w =>  w.approved);
        renderPendingWords(pending);
        renderApprovedWords(approved);
    } catch (e) {
        console.warn('Content load error:', e);
        document.getElementById('pendingWordList').innerHTML  = '<div class="empty-state">加载失败</div>';
        document.getElementById('approvedWordList').innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

function renderPendingWords(words) {
    const el = document.getElementById('pendingWordList');
    if (!words.length) { el.innerHTML = '<div class="empty-state">暂无待审核词</div>'; return; }
    el.innerHTML = words.map(w => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border);cursor:default">
            <span style="flex:1;font-size:13px">${escHtml(w.word)}</span>
            <span style="font-size:11px;color:var(--muted)">${w.source || ''}</span>
            <button class="btn btn-sm btn-success" onclick="approveWord('${w.id}')">通过</button>
            <button class="btn btn-sm btn-danger"  onclick="deleteWord('${w.id}')">删除</button>
        </div>
    `).join('');
}

function renderApprovedWords(words) {
    const el = document.getElementById('approvedWordList');
    if (!words.length) { el.innerHTML = '<div class="empty-state">暂无已通过词</div>'; return; }
    el.innerHTML = words.map(w => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border);cursor:default">
            <span style="flex:1;font-size:13px">${escHtml(w.word)}</span>
            <span style="font-size:11px;color:var(--muted)">${w.source || ''}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteWord('${w.id}')">删除</button>
        </div>
    `).join('');
}

async function approveWord(id) {
    try {
        const qb = await sb.from('visitor_words');
        await qb.eq('id', id).update({ approved: true });
        toast('已通过', 'ok');
        loadContent();
    } catch (e) {
        toast('操作失败: ' + e.message, 'fail');
    }
}

async function deleteWord(id) {
    if (!confirm('确认删除这个词？')) return;
    try {
        const qb = await sb.from('visitor_words');
        await qb.eq('id', id).delete();
        toast('已删除', 'ok');
        loadContent();
    } catch (e) {
        toast('删除失败: ' + e.message, 'fail');
    }
}

async function addContentItem() {
    const inp = document.getElementById('newContentItem');
    const val = inp.value.trim();
    if (!val) return;
    try {
        const qb = await sb.from('visitor_words');
        await qb.insert({ word: val, approved: true, source: 'admin' });
        inp.value = '';
        toast('词已添加', 'ok');
        loadContent();
    } catch (e) {
        toast('添加失败: ' + e.message, 'fail');
    }
}

/* ─── Tags tab ─────────────────────────────────────────────── */
async function loadTags() {
    try {
        const qb = await sb.from('site_tags');
        const data = await qb.select('*').order('sort_order').get();
        renderTags(Array.isArray(data) ? data : []);
    } catch (e) {
        console.warn('Tags load error:', e);
        renderTags([]);
    }
}

function renderTags(tags) {
    const wrap = document.getElementById('tagList');
    if (!tags.length) {
        wrap.innerHTML = '<div class="empty-state">还没有标签，添加第一个吧</div>';
        return;
    }
    wrap.innerHTML = tags.map(t => `
        <span class="tag-chip">
            ${t.url ? `<a href="${escHtml(t.url)}" target="_blank" style="color:inherit;text-decoration:none">${escHtml(t.name)}</a>` : escHtml(t.name)}
            <span class="del" onclick="deleteTag('${t.id}')">×</span>
        </span>
    `).join('');
}

async function addTag() {
    const nameEl = document.getElementById('tagName');
    const urlEl  = document.getElementById('tagUrl');
    const name = nameEl.value.trim();
    const url  = urlEl.value.trim();
    if (!name) { toast('标签名不能为空', 'fail'); return; }
    try {
        const qb = await sb.from('site_tags');
        await qb.insert({ name, url: url || null, sort_order: Date.now() });
        nameEl.value = '';
        urlEl.value  = '';
        toast('标签已添加', 'ok');
        loadTags();
    } catch (e) {
        toast('添加失败: ' + e.message, 'fail');
    }
}

async function deleteTag(id) {
    if (!confirm('确认删除这个标签？')) return;
    try {
        const qb = await sb.from('site_tags');
        await qb.eq('id', id).delete();
        toast('已删除', 'ok');
        loadTags();
    } catch (e) {
        toast('删除失败: ' + e.message, 'fail');
    }
}

async function doLogout() {
    await sb.signOut();
    location.href = '/admin/index.html';
}

/* ─── Helpers ──────────────────────────────────────────────── */
function formatTime(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Boot ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
