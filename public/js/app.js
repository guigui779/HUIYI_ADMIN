// 管理后台主模块
(function (window) {
'use strict';

// ── 状态 ──────────────────────────────────────────────────────────────────
var state = {
db: { stats: null, codes: [], connected: false },
api: { base: '', secret: '', backups: [], health: null, rooms: [] },
ui: { apiReady: false, apiReachable: false }
};

// ── 工具 ──────────────────────────────────────────────────────────────────
function token() { return window.HuiyiLogin ? window.HuiyiLogin.getToken() : ''; }

function authedFetch(url, opts) {
opts = opts || {};
opts.headers = Object.assign({ 'Authorization': 'Bearer ' + token() }, opts.headers || {});
return fetch(url, opts);
}

async function authedJson(url, opts) {
var resp = await authedFetch(url, opts);
var data = await resp.json().catch(function () { return {}; });
if (!resp.ok) throw new Error(data.error || 'HTTP ' + resp.status);
return data;
}

function apiRequest(path, opts) {
return window.HuiyiApi.request(state.api.base, state.api.secret, path, opts);
}

function toast(msg, type) {
var el = document.createElement('div');
el.className = 'toast ' + (type || 'info');
el.textContent = msg;
document.getElementById('toastStack').appendChild(el);
setTimeout(function () { el.remove(); }, 3200);
}

function setResult(v) {
var el = document.getElementById('resultBox');
if (!el) return;
el.textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}

function pill(id, text, tone) {
var el = document.getElementById(id);
if (!el) return;
el.textContent = text;
el.className = 'pill' + (tone ? ' ' + tone : '');
}

function setApiCardsEnabled(on) {
document.querySelectorAll('.card[data-type="api"]').forEach(function (card) {
card.setAttribute('data-enabled', String(on));
card.querySelectorAll('button,input,select,textarea').forEach(function (el) {
on ? el.removeAttribute('disabled') : el.setAttribute('disabled', 'disabled');
});
card.querySelectorAll('.badge-warning').forEach(function (badge) {
badge.style.display = on ? 'none' : '';
});
card.querySelectorAll('.badge-api-connected').forEach(function (badge) {
badge.style.display = on ? '' : 'none';
});
});
}

function maskSecret(v) {
if (!v) return '未配置';
return v.length <= 8 ? '*'.repeat(v.length) : v.slice(0, 4) + '****' + v.slice(-4);
}

function formatCountdown(expiresAt) {
if (!expiresAt) return '-';
var diff = new Date(expiresAt).getTime() - Date.now();
if (isNaN(diff) || diff <= 0) return '已过期';
var s = Math.floor(diff / 1000);
var parts = [];
var d = Math.floor(s / 86400); if (d) { parts.push(d + '天'); s %= 86400; }
var h = Math.floor(s / 3600); if (h || d) { parts.push(h + '时'); s %= 3600; }
parts.push(Math.floor(s / 60) + '分');
parts.push(s % 60 + '秒');
return parts.join(' ');
}

function updateCountdowns() {
document.querySelectorAll('[data-expires-at]').forEach(function (el) {
el.textContent = formatCountdown(el.dataset.expiresAt || '');
});
}

function getAssigneeName(row) {
var parts = [row.assigned_name, row.assigned_to].filter(function (v) {
return v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';
});
return parts.length ? parts.join(' / ') : '未分配';
}

// ── 数据加载 ──────────────────────────────────────────────────────────────
async function loadStats() {
var data = await authedJson('/console/codes/stats');
state.db.stats = data;
}

async function loadCodes() {
var data = await authedJson('/console/codes');
state.db.codes = data.codes || [];
}

async function loadDatabaseData() {
pill('dbState', '数据库: 加载中...', 'warn');
try {
await Promise.all([loadStats(), loadCodes()]);
state.db.connected = true;
pill('dbState', '数据库: 已连接', 'ok');
} catch (e) {
state.db.connected = false;
pill('dbState', '数据库: 连接失败', 'danger');
console.warn('数据库加载失败:', e);
}
}

async function loadApiData() {
var healthResult = await authedJson('/console/health');
state.api.health = (healthResult && healthResult.external) || healthResult;
state.ui.apiReady = !!(healthResult && healthResult.ok);
state.ui.apiReachable = !!(healthResult && healthResult.reachable);
setApiCardsEnabled(state.ui.apiReady);
try {
var roomsResult = await authedJson('/console/rooms');
state.api.rooms = (roomsResult && roomsResult.rooms) || [];
} catch (e) {
state.api.rooms = [];
console.warn('房间列表加载失败:', e);
}
}

async function syncConfigFromBackend() {
try {
var data = await authedJson('/console/api-urls');
var url = window.HuiyiApi.normalizeBase(data.mainUrl || data.currentUrl || '');
if (url) state.api.base = url;
if (data.apiSecret) state.api.secret = data.apiSecret;
saveState();
await loadBackupUrls();
} catch (e) {
console.warn('后端配置同步失败:', e);
}
}

async function loadBackupUrls() {
try {
var data = await authedJson('/console/settings');
state.api.backups = data.apiUrlBackups || [];
} catch (e) {
console.warn('备用接口加载失败:', e);
}
}

function loadState() {
try {
var raw = JSON.parse(localStorage.getItem(window.HuiyiConfig.STORAGE_KEY) || '{}');
state.api.base = window.HuiyiApi.normalizeBase((raw.api && raw.api.base) || '');
state.api.secret = (raw.api && raw.api.secret) || '';
} catch (e) { /* ignore */ }
}

function saveState() {
localStorage.setItem(window.HuiyiConfig.STORAGE_KEY, JSON.stringify({ api: { base: state.api.base, secret: state.api.secret } }));
}

// ── 渲染 ──────────────────────────────────────────────────────────────────
function renderState() {
var stats = state.db.stats || {};
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

setText('totalCount', stats.total != null ? stats.total : '-');
setText('assignedCount', stats.assigned != null ? stats.assigned : '-');
setText('inUseCount', stats.in_use != null ? stats.in_use : '-');
setText('expiredCount', stats.expired != null ? stats.expired : '-');

		var apiOk = state.ui.apiReady;
		var apiReachable = state.ui.apiReachable;
pill('apiState', state.api.base ? ('API: ' + state.api.base) : 'API: 未配置', apiOk ? 'ok' : (apiReachable ? 'warn' : 'danger'));

		setText('currentSecretDisplay', maskSecret(state.api.secret));
		var statusDot = document.getElementById('currentStatusDot');
		var statusText = document.getElementById('connectionStatusText');
		if (statusDot) statusDot.className = 'status-dot ' + (apiOk ? 'ok' : (apiReachable ? 'warn' : 'danger'));
		if (statusText) statusText.textContent = apiOk ? '已连接' : (apiReachable ? '可达·密钥错误' : '未连接');

		renderCodes();
		renderApiUrls();
updateApiFormButtons();
}

function renderCodes() {
var tbody = document.getElementById('codesTable');
if (!tbody) return;
var rows = state.db.codes || [];
if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无数据</td></tr>'; return; }

var groups = {};
rows.forEach(function (r) {
var name = getAssigneeName(r);
(groups[name] = groups[name] || []).push(r);
});

tbody.innerHTML = Object.entries(groups).map(function (entry) {
var name = entry[0], list = entry[1];
var used = list.filter(function (c) { return c.status === 'in_use' || c.in_use; }).length;
var expired = list.filter(function (c) { return c.status === 'expired'; }).length;
var avail = list.length - used - expired;
var enc = encodeURIComponent(name);
return '<tr><td>' + name + '</td><td>' + list.length + '</td><td>' + used + '</td><td>' + avail + '</td><td>' + expired + '</td>' +
'<td><div class="row-actions"><button class="btn-inline btn-danger" data-action="delete-assignee" data-assignee="' + enc + '">删除该组</button><button class="btn-inline" data-action="show-detail" data-assignee="' + enc + '">查看详情</button></div></td></tr>';
}).join('');
}

function showAssigneeDetail(name) {
var codes = (state.db.codes || []).filter(function (r) { return getAssigneeName(r) === name; });
document.getElementById('detailModalTitle').textContent = name + ' 的授权码';
var tbody = document.getElementById('detailTable');
tbody.innerHTML = codes.map(function (row) {
var code = row.code || '-';
var status = row.status || (row.in_use ? 'in_use' : 'available');
var tone = (status === 'expired' || status === 'in_use') ? 'danger' : 'ok';
var room = row.bound_room || row.room_name || '-';
var canRelease = status !== 'expired' && room !== '-';
var actions = [];
if (canRelease) actions.push('<button class="btn-inline" data-action="release-code" data-code="' + code + '">释放</button>');
actions.push('<button class="btn-inline btn-danger" data-action="delete-code" data-code="' + code + '">删除</button>');
return '<tr>' +
'<td><code>' + code + '</code></td>' +
'<td><span class="status-dot ' + tone + '"></span></td>' +
'<td>' + room + '</td>' +
'<td>' + (row.expires_at ? new Date(row.expires_at).toLocaleString('zh-CN') : '-') +
'<div class="countdown" data-expires-at="' + (row.expires_at || '') + '">' + formatCountdown(row.expires_at || '') + '</div></td>' +
'<td><div class="row-actions">' + actions.join('') + '</div></td></tr>';
}).join('') || '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
updateCountdowns();
document.getElementById('detailModal').classList.remove('is-hidden');
}

function renderApiUrls() {
		var grid = document.getElementById('apiUrlsGrid');
		if (!grid) return;
		var cards = [];
		if (state.api.base) {
			cards.push('<div class="api-url-card">' +
				'<span class="badge">使用中</span>' +
				'<span class="card-check-dot" data-check-url="' + state.api.base + '"></span>' +
				'<span class="url-text">' + state.api.base + '</span>' +
				'<a class="btn-inline btn-link" href="' + state.api.base + '" target="_blank" rel="noopener">外链</a>' +
				'<button class="btn-inline btn-secondary" data-action="check-url" data-url="' + state.api.base + '">检测</button>' +
				'<button class="btn-inline btn-danger" id="clearApiBtn" type="button">删除</button>' +
				'</div>');
		}
		(state.api.backups || []).forEach(function (b) {
			cards.push('<div class="api-url-card is-backup">' +
				'<span class="badge">备用</span>' +
				'<span class="card-check-dot" data-check-url="' + b.value + '"></span>' +
				'<span class="url-text">' + b.value + '</span>' +
				'<a class="btn-inline btn-link" href="' + b.value + '" target="_blank" rel="noopener">外链</a>' +
				'<button class="btn-inline btn-secondary" data-action="check-url" data-url="' + b.value + '">检测</button>' +
				'<button class="btn-inline btn-promote" data-action="promote-backup" data-key="' + b.key + '">设为主</button>' +
				'<button class="btn-inline btn-danger" data-action="delete-backup" data-key="' + b.key + '">删除</button>' +
				'</div>');
		});
		if (!cards.length) {
			grid.innerHTML = '<div class="api-url-card" style="grid-column:1/-1;color:var(--muted)">暂无接口配置</div>';
		} else {
			grid.innerHTML = cards.join('');
			// 重新绑定 clearApiBtn（每次 render 后重新生成）
			var clearBtn = document.getElementById('clearApiBtn');
			if (clearBtn) clearBtn.addEventListener('click', function () { clearApiConfig().catch(function (e) { toast(e.message, 'error'); }); });
		}
}

function updateApiFormButtons() {
var hasMain = !!state.api.base;
var submitBtn = document.getElementById('apiSubmitBtn');
var hintEl = document.getElementById('apiUrlHint');
var secretField = document.getElementById('apiSecretField');
if (submitBtn) submitBtn.textContent = hasMain ? '添加接口' : '保存并连接';
if (hintEl) hintEl.textContent = hasMain ? '已有使用中 — 新地址将自动添加为备用接口' : '首次填写将保存为使用中';
if (secretField) secretField.style.display = hasMain ? 'none' : '';
}

// ── 业务操作 ──────────────────────────────────────────────────────────────
async function saveApiConfig(url, secret) {
return authedJson('/console/api-urls/main', {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: url, secret: secret })
});
}

async function addBackupUrl(url) {
return authedJson('/console/api-urls/backups', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: url })
});
}

async function deleteBackupUrl(key) {
return authedJson('/console/api-urls/backups/' + encodeURIComponent(key), { method: 'DELETE' });
}

async function clearApiConfig() {
if (!confirm('确定要清空 API 配置？')) return;
await saveApiConfig('', '');
state.api.base = '';
state.api.secret = '';
state.api.backups = [];
state.api.rooms = [];
state.ui.apiReady = false;
saveState();
setApiCardsEnabled(false);
renderState();
pill('syncState', '接口已清空', 'warn');
toast('接口配置已清空', 'ok');
}

async function createCodes(form) {
var data = Object.fromEntries(new FormData(form).entries());
if (!data.assigned || !String(data.assigned).trim()) throw new Error('请填写分配对象');
data.count = Number(data.count);
data.expire_minutes = Number(data.expire_minutes);
var assigned = String(data.assigned).trim();
delete data.assigned;
if (/^\d+$/.test(assigned)) data.assigned_to = Number(assigned);
else data.assigned_name = assigned;
var result = await authedJson('/console/codes/create', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(data)
});
toast('创建了 ' + (result.created || 0) + ' 个授权码', 'ok');
setResult(result);
await refreshAll();
}

async function releaseCode(code) {
await authedJson('/console/codes/' + encodeURIComponent(code) + '/release', { method: 'POST' });
toast('已释放授权码 ' + code, 'ok');
await refreshAll();
}

async function deleteCode(code) {
await authedJson('/console/codes', {
method: 'DELETE',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codes: [code] })
});
toast('已删除授权码 ' + code, 'ok');
await refreshAll();
}

async function deleteAssigneeCodes(name) {
if (!confirm('确定要删除「' + name + '」的全部授权码？')) return;
var codes = (state.db.codes || []).filter(function (r) { return getAssigneeName(r) === name; }).map(function (r) { return r.code; });
if (!codes.length) { toast('没有可删除的授权码', 'info'); return; }
await authedJson('/console/codes', {
method: 'DELETE',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codes: codes })
});
toast('已删除 ' + codes.length + ' 个授权码', 'ok');
await refreshAll();
document.getElementById('detailModal').classList.add('is-hidden');
}

async function cleanup() {
var result = await authedJson('/console/cleanup', { method: 'POST' });
toast('已清理 ' + (result.expired_sessions || 0) + ' 个过期会话', 'ok');
setResult(result);
await refreshAll();
}

async function refreshAll() {
await loadDatabaseData();
await syncConfigFromBackend();
if (state.api.base && state.api.secret) {
try { await loadApiData(); } catch (e) { console.warn('API刷新失败:', e); }
}
renderState();
}

async function checkSingleUrl(url) {
var dot = Array.from(document.querySelectorAll('.card-check-dot')).filter(function (el) {
return el.dataset.checkUrl === url;
})[0];
if (dot) dot.className = 'card-check-dot checking';
try {
var result = await authedJson('/console/api-urls/check-single', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: url })
});
if (dot) dot.className = 'card-check-dot ' + (result.healthy ? 'ok' : 'fail');
setResult(result);
toast(url + (result.healthy ? ' 连接正常' : ' 连接失败'), result.healthy ? 'ok' : 'error');
return result;
} catch (e) {
if (dot) dot.className = 'card-check-dot fail';
throw e;
}
}

async function checkAllUrls() {
var urls = [];
if (state.api.base) urls.push(state.api.base);
(state.api.backups || []).forEach(function (b) { if (b.value) urls.push(b.value); });
if (!urls.length) { toast('没有配置任何接口', 'info'); return; }
toast('正在检测 ' + urls.length + ' 个接口...', 'info');
var results = await Promise.all(urls.map(function (u) {
return checkSingleUrl(u).then(function (result) { return !!result.healthy; }).catch(function (e) {
toast('检测失败: ' + e.message, 'error');
return false;
});
}));
var healthyCount = results.filter(Boolean).length;
toast('检测完成：' + healthyCount + ' / ' + urls.length + ' 个接口可用', healthyCount ? 'ok' : 'error');
}

async function promoteBackup(key) {
if (!confirm('确定将此备用接口设为使用中？')) return;
await authedJson('/console/api-urls/promote', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ key: key })
});
toast('已切换使用中', 'ok');
await refreshAll();
}

// ── 事件绑定 ──────────────────────────────────────────────────────────────
function bindEvents() {
// API 配置表单
document.getElementById('apiConfigForm').addEventListener('submit', async function (e) {
e.preventDefault();
var newUrl = window.HuiyiApi.normalizeBase(this.base.value);
var newSecret = (document.getElementById('apiSecretInput') || {}).value;
if (!newUrl) { toast('请填写有效的接口地址', 'error'); return; }
try {
if (state.api.base) {
await addBackupUrl(newUrl);
this.base.value = '';
toast('备用接口已添加', 'ok');
await loadBackupUrls();
renderApiUrls();
} else {
if (!newSecret || !newSecret.trim()) { toast('请填写 API Secret', 'error'); return; }
state.api.base = newUrl;
state.api.secret = newSecret.trim();
saveState();
await saveApiConfig(newUrl, newSecret.trim());
await refreshAll();
toast('API 配置已保存', 'ok');
}
} catch (err) {
toast(err.message, 'error');
}
});

// 创建授权码
document.getElementById('createForm').addEventListener('submit', async function (e) {
e.preventDefault();
try { await createCodes(this); }
catch (err) { toast(err.message, 'error'); }
});

// 刷新 / 清理 / 清空
var btnMap = {
refreshAllBtn: function () { return refreshAll().then(function () { toast('数据已刷新', 'ok'); }); },
refreshInlineBtn: refreshAll,
cleanupBtn: cleanup,
checkAllUrlsBtn: checkAllUrls
};
Object.keys(btnMap).forEach(function (id) {
var el = document.getElementById(id);
if (el) el.addEventListener('click', function () { btnMap[id]().catch(function (e) { toast(e.message, 'error'); }); });
});

// 退出登录
document.getElementById('logoutBtn').addEventListener('click', function () {
localStorage.removeItem('huiyi_console_token');
localStorage.removeItem(window.HuiyiConfig.LOGIN_KEY);
window.location.reload();
});

// 修改密码
document.getElementById('changePasswordBtn').addEventListener('click', function () {
['oldPassword', 'newPassword', 'confirmPassword'].forEach(function (id) { document.getElementById(id).value = ''; });
document.getElementById('passwordError').style.display = 'none';
document.getElementById('passwordModal').classList.remove('is-hidden');
});
document.getElementById('passwordModalClose').addEventListener('click', function () {
document.getElementById('passwordModal').classList.add('is-hidden');
});
document.getElementById('passwordForm').addEventListener('submit', async function (e) {
e.preventDefault();
var oldPwd = document.getElementById('oldPassword').value;
var newPwd = document.getElementById('newPassword').value;
var confirmPwd = document.getElementById('confirmPassword').value;
var errEl = document.getElementById('passwordError');
errEl.style.display = 'none';
if (!oldPwd || !newPwd || !confirmPwd) { errEl.textContent = '请填写所有字段'; errEl.style.display = 'block'; return; }
if (newPwd.length < 6) { errEl.textContent = '新密码长度至少6位'; errEl.style.display = 'block'; return; }
if (newPwd !== confirmPwd) { errEl.textContent = '两次密码不一致'; errEl.style.display = 'block'; return; }
try {
await window.HuiyiApi.changePassword(token(), oldPwd, newPwd);
document.getElementById('passwordModal').classList.add('is-hidden');
toast('密码修改成功', 'ok');
} catch (err) {
errEl.textContent = err.message || '修改失败';
errEl.style.display = 'block';
}
});

// 详情模态框
var detailModal = document.getElementById('detailModal');
document.getElementById('detailModalClose') && document.getElementById('detailModalClose').addEventListener('click', function () { detailModal.classList.add('is-hidden'); });

// ESC & 遮罩关闭
document.addEventListener('keydown', function (e) {
if (e.key !== 'Escape') return;
document.getElementById('detailModal').classList.add('is-hidden');
document.getElementById('passwordModal').classList.add('is-hidden');
});
['detailModal', 'passwordModal'].forEach(function (id) {
var el = document.getElementById(id);
if (el) el.addEventListener('click', function (e) { if (e.target === el) el.classList.add('is-hidden'); });
});

// 全局 data-action 代理
document.body.addEventListener('click', async function (e) {
var btn = e.target.closest('[data-action]');
if (!btn) return;
var action = btn.dataset.action;
var code = btn.dataset.code || '';
var assignee = btn.dataset.assignee ? decodeURIComponent(btn.dataset.assignee) : '';

try {
if (action === 'show-detail') { showAssigneeDetail(assignee); return; }
if (action === 'delete-assignee') { await deleteAssigneeCodes(assignee); return; }
if (action === 'release-code') {
await releaseCode(code);
if (!detailModal.classList.contains('is-hidden')) {
showAssigneeDetail(document.getElementById('detailModalTitle').textContent.replace(' 的授权码', ''));
}
return;
}
if (action === 'delete-code') {
await deleteCode(code);
if (!detailModal.classList.contains('is-hidden')) {
showAssigneeDetail(document.getElementById('detailModalTitle').textContent.replace(' 的授权码', ''));
}
return;
}
if (action === 'delete-backup') {
await deleteBackupUrl(btn.dataset.key || '');
toast('备用接口已删除', 'ok');
await loadBackupUrls();
renderApiUrls();
return;
}
if (action === 'check-url') {
await checkSingleUrl(btn.dataset.url || '');
return;
}
if (action === 'promote-backup') {
await promoteBackup(btn.dataset.key || '');
return;
}
} catch (err) {
toast(err.message, 'error');
setResult({ error: err.message });
}
});
}

// ── 启动 ──────────────────────────────────────────────────────────────────
function showApp() {
document.getElementById('loginOverlay').classList.add('is-hidden');
document.getElementById('appPage').style.display = '';
}

async function startApp() {
var t = token();
if (t) {
try {
var r = await authedFetch('/console/auth/me');
if (r.status === 401) {
localStorage.removeItem('huiyi_console_token');
localStorage.removeItem(window.HuiyiConfig.LOGIN_KEY);
window.location.reload();
return;
}
} catch (e) { /* 网络错误继续 */ }
}

loadState();
bindEvents();
	setApiCardsEnabled(false);
pill('syncState', '加载中...', 'warn');
await loadDatabaseData();
await loadBackupUrls();
renderState();

await syncConfigFromBackend();
if (state.api.base && state.api.secret) {
try {
await loadApiData();
if (state.ui.apiReady) {
pill('syncState', 'API 已连接', 'ok');
} else if (state.ui.apiReachable) {
pill('syncState', 'API 可达·密钥认证失败', 'warn');
} else {
pill('syncState', 'API 连接失败（仅数据库模式）', 'danger');
}
} catch (e) {
state.ui.apiReady = false;
setApiCardsEnabled(false);
pill('syncState', 'API 连接失败（仅数据库模式）', 'danger');
toast('API 连接失败，数据库功能正常', 'info');
}
} else {
setApiCardsEnabled(false);
pill('syncState', 'API 未配置（仅数据库模式）', 'warn');
}
renderState();
}

window.HuiyiApp = { showApp: showApp, startApp: startApp };

})(window);
