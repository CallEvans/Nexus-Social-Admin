// Nexus Admin — UI Utilities
function aToast(msg, type = 'info') {
  const tc = document.getElementById('aToasts');
  const t = document.createElement('div');
  t.className = `a-toast ${type}`;
  const icons = { success: '✓', error: '✕', info: '✦' };
  t.innerHTML = `<span>${icons[type]||'✦'}</span>${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function openAModal(html) {
  const m = document.getElementById('aModal');
  const o = document.getElementById('aOverlay');
  m.innerHTML = html;
  m.classList.add('open');
  o.classList.add('open');
}

function closeAModal() {
  document.getElementById('aModal').classList.remove('open');
  document.getElementById('aOverlay').classList.remove('open');
}

function gradientForStr(str) {
  const gs = ['g1','g2','g3','g4','g5','g6','g7','g8'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h<<5)-h);
  return gs[Math.abs(h) % gs.length];
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

async function aGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function aPost(url, data) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || 'Request failed');
  return json;
}

async function aDel(url) {
  const r = await fetch(url, { method: 'DELETE' });
  return r.json();
}

function countryFlag(code) {
  const flags = {MU:'🇲🇺',US:'🇺🇸',GB:'🇬🇧',FR:'🇫🇷',BR:'🇧🇷',IN:'🇮🇳',AU:'🇦🇺',CA:'🇨🇦',DE:'🇩🇪',JP:'🇯🇵',KR:'🇰🇷',IT:'🇮🇹',ZA:'🇿🇦',NG:'🇳🇬',GH:'🇬🇭'};
  return flags[code] || '';
}

function statusPill(user) {
  if (user.is_banned) return '<div class="status-pill sp-banned">✕ Banned</div>';
  if (user.is_suspended) return '<div class="status-pill sp-suspended">⚠ Suspended</div>';
  return '<div class="status-pill sp-active">● Active</div>';
}
