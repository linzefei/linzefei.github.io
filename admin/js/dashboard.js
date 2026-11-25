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
        // 5 路查询互不依赖，并行发只花一个往返（原来串行要 5 个）
        const today = new Date().toISOString().slice(0, 10);
        const [visits, todayVisits, tags, words, recent] = await Promise.all([
            (await sb.from('page_visits')).select('id').get(),
            (await sb.from('page_visits')).select('id').eq('date', today).get(),
            (await sb.from('site_tags')).select('id').get(),
            (await sb.from('visitor_words')).select('id').get(),
            (await sb.from('visitor_words')).select('word,created_at').eq('approved', true).order('created_at', { ascending: false }).limit(3).get()
        ]);
        // Total visits
        document.getElementById('totalVisits').textContent = Array.isArray(visits) ? visits.length : '–';

        // Today
        document.getElementById('todayVisits').textContent = Array.isArray(todayVisits) ? todayVisits.length : '–';

        // Tags count
        document.getElementById('tagsCount').textContent = Array.isArray(tags) ? tags.length : '–';

        // Word count
        document.getElementById('contentCount').textContent = Array.isArray(words) ? words.length : '–';

        // 最近添加的 3 个词（已通过，按添加时间倒序）
        const rw = document.getElementById('recentWords');
        if (rw) {
            rw.innerHTML = (Array.isArray(recent) && recent.length) ? recent.map(w => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border)">
                    <span style="flex:1;font-size:13px">${escHtml(w.word)}</span>
                    <span style="font-size:11px;color:var(--muted)">${formatTime(w.created_at)}</span>
                </div>
            `).join('') : '<div class="empty-state">暂无词</div>';
        }

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
        // 一次取回所需的三列。旧代码查了不存在的 count 列，接口直接报错，
        // 整个统计页因此一片空白；来源统计还漏查了 referrer 列（全显示直接访问）
        const qb = await sb.from('page_visits');
        const data = await qb.select('date,visitor_id,referrer').get();
        const rows = Array.isArray(data) ? data : [];

        // Build chart data for last 14 days
        const days = 14;
        const map = {};
        rows.forEach(r => { map[r.date] = (map[r.date] || 0) + 1; });
        const labels = [], counts = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            labels.push(key.slice(5)); // MM-DD
            counts.push(map[key] || 0);
        }

        renderChart('chartBars', 'chartLabels', labels, counts);

        // Totals + Top referrers
        const uvSet = new Set(rows.map(r => r.visitor_id).filter(Boolean));
        document.getElementById('totalUV').textContent = uvSet.size;
        document.getElementById('totalPV').textContent = rows.length;
        const refMap = {};
        rows.forEach(r => {
            const ref = r.referrer || '直接访问';
            refMap[ref] = (refMap[ref] || 0) + 1;
        });
        const sorted = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        document.getElementById('refTbody').innerHTML = sorted.map(([ref, cnt]) => `
            <tr>
                <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(ref)}</td>
                <td>${cnt}</td>
                <td>${rows.length ? Math.round(cnt / rows.length * 100) : 0}%</td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="empty-state">暂无数据</td></tr>';
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
            <div style="flex:1;min-width:0">
                <div style="font-size:13px">${escHtml(w.word)}</div>
                <div style="font-size:11px;color:var(--muted)">${formatTime(w.created_at)} 添加${w.source ? ' · ' + escHtml(w.source) : ''}</div>
            </div>
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
            <div style="flex:1;min-width:0">
                <div style="font-size:13px">${escHtml(w.word)}</div>
                <div style="font-size:11px;color:var(--muted)">${formatTime(w.created_at)} 添加${w.source ? ' · ' + escHtml(w.source) : ''}</div>
            </div>
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

async function insertWord(val, force = false) {
    // 防重复分三档：
    // - 完全相同（大小写也一样）→ 拒绝，返回 { type:'exact', created_at }
    // - 只有大小写不同 → 返回 { type:'case', matches }，由调用方弹窗问用户
    // - 无冲突（或 force=true）→ 直接添加，返回 { type:'added' }
    if (!force) {
        // 查重不再全表拉取：精确匹配走 word 唯一索引，大小写变体走 ilike，两路并行只花一个往返
        const [exactRows, ciRows] = await Promise.all([
            (await sb.from('visitor_words')).select('word,created_at').eq('word', val).limit(1).get(),
            (await sb.from('visitor_words')).select('word,created_at').ilike('word', val).limit(5).get()
        ]);
        if (Array.isArray(exactRows) && exactRows.length) {
            return { type: 'exact', created_at: exactRows[0].created_at || '' };
        }
        const ci = (Array.isArray(ciRows) ? ciRows : []).filter(r => (r.word || '').trim().toLowerCase() === val.toLowerCase());
        if (ci.length) return { type: 'case', matches: ci };
    }
    const qb2 = await sb.from('visitor_words');
    await qb2.insert({ word: val, approved: true, source: 'admin' });
    return { type: 'added' };
}

function dupToast(createdAt) {
    if (!createdAt) { toast('这个词已经有了', 'fail'); return; }
    const d = new Date(createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    toast(`这个词已经有了（${d} 添加）`, 'fail');
}

// 加词总入口：处理三档结果，返回 true 表示已添加
async function tryAddWord(val) {
    const res = await insertWord(val);
    if (res.type === 'added') return true;
    if (res.type === 'exact') { dupToast(res.created_at); return false; }
    // 只有大小写不同：大小写可能改变词义，列出已有词让用户决定
    const list = res.matches.map(m => `「${m.word}」`).join('、');
    const first = res.matches[0];
    const d = first.created_at
        ? new Date(first.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '';
    const ok = confirm(`已有 ${list}${d ? `（${d} 添加）` : ''}，你输入的是「${val}」，只是大小写不同。\n大小写不同意思可能不同，仍要作为新词添加吗？`);
    if (!ok) return false;
    await insertWord(val, true);
    return true;
}

// 加词进行时：按钮立刻变“添加中…”并禁用，输入框也锁住，避免用户对着没反应的界面干等
function setAddBusy(inp, busy) {
    const row = inp.closest('.input-row');
    const btn = row ? row.querySelector('button') : null;
    if (btn) { btn.disabled = busy; btn.textContent = busy ? '添加中…' : '添加'; }
    inp.disabled = busy;
}

async function addContentItem() {
    const inp = document.getElementById('newContentItem');
    const val = inp.value.trim();
    if (!val) return;
    setAddBusy(inp, true);
    try {
        if (!await tryAddWord(val)) return;
        inp.value = '';
        toast('词已添加', 'ok');
        loadContent();
    } catch (e) {
        toast('添加失败: ' + e.message, 'fail');
    } finally {
        setAddBusy(inp, false);
    }
}

async function addQuickWord() {
    const inp = document.getElementById('quickWord');
    const val = inp.value.trim();
    if (!val) return;
    setAddBusy(inp, true);
    try {
        if (!await tryAddWord(val)) return;
        inp.value = '';
        toast('词已添加', 'ok');
        loadOverview();
    } catch (e) {
        toast('添加失败: ' + e.message, 'fail');
    } finally {
        setAddBusy(inp, false);
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
