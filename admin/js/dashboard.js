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

        // Content items
        const content = await (await sb.from('site_content')).select('key').get();
        document.getElementById('contentCount').textContent = Array.isArray(content) ? content.length : '–';

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
        const qb = await sb.from('site_content');
        const rows = await qb.select('*').get();
        let order = ['Hello World!', 'Three.js', 'JavaScript', 'Python', 'Java', 'C++', 'React', 'Vue', 'Angular', 'Node.js', 'linzefei', 'Cursor', '2025'];

        if (Array.isArray(rows)) {
            const row = rows.find(r => r.key === 'display_order');
            if (row?.value) {
                try { order = JSON.parse(typeof row.value === 'string' ? row.value : JSON.stringify(row.value)); } catch {}
            }
        }

        renderSortable(order);
    } catch (e) {
        console.warn('Content load error:', e);
        renderSortable(['Hello World!', 'Three.js', 'JavaScript', 'Python', 'Java', 'C++', 'React', 'Vue', 'Angular', 'Node.js', 'linzefei', 'Cursor', '2025']);
    }
}

function renderSortable(items) {
    const list = document.getElementById('sortableList');
    list.innerHTML = items.map((item, i) => `
        <li class="sortable-item" draggable="true" data-index="${i}">
            <span class="handle">⠿</span>
            <span class="label">${escHtml(item)}</span>
            <div class="actions">
                <button class="btn btn-sm btn-danger" onclick="removeContentItem(${i})">删除</button>
            </div>
        </li>
    `).join('');
    initDragSort(list);
}

function initDragSort(list) {
    let dragging = null;
    list.querySelectorAll('[draggable]').forEach(item => {
        item.addEventListener('dragstart', () => { dragging = item; item.style.opacity = '.4'; });
        item.addEventListener('dragend',   () => { item.style.opacity = ''; dragging = null; });
        item.addEventListener('dragover',  e => {
            e.preventDefault();
            if (dragging && dragging !== item) {
                const rect = item.getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                if (after) item.after(dragging);
                else item.before(dragging);
            }
        });
    });
}

function getContentOrder() {
    return [...document.querySelectorAll('#sortableList .sortable-item .label')].map(el => el.textContent);
}

function removeContentItem(idx) {
    const items = getContentOrder();
    items.splice(idx, 1);
    renderSortable(items);
}

function addContentItem() {
    const inp = document.getElementById('newContentItem');
    const val = inp.value.trim();
    if (!val) return;
    const items = getContentOrder();
    items.push(val);
    renderSortable(items);
    inp.value = '';
}

async function saveContent() {
    const order = getContentOrder();
    try {
        const qb = await sb.from('site_content');
        await qb.upsert({ key: 'display_order', value: JSON.stringify(order), updated_at: new Date().toISOString() });
        toast('内容已保存', 'ok');
    } catch (e) {
        toast('保存失败: ' + e.message, 'fail');
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

/* ─── Settings ─────────────────────────────────────────────── */
async function changePassword() {
    const np = document.getElementById('newPass').value;
    const cp = document.getElementById('confirmPass').value;
    if (!np) { toast('请输入新密码', 'fail'); return; }
    if (np !== cp) { toast('两次密码不一致', 'fail'); return; }
    if (np.length < 8) { toast('密码至少8位', 'fail'); return; }
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON,
                'Authorization': 'Bearer ' + sb._session.access_token
            },
            body: JSON.stringify({ password: np })
        });
        if (!res.ok) throw new Error((await res.json()).msg || 'Failed');
        document.getElementById('newPass').value = '';
        document.getElementById('confirmPass').value = '';
        toast('密码已修改', 'ok');
    } catch (e) {
        toast('修改失败: ' + e.message, 'fail');
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
