// Nexus Admin — Dashboard
async function loadDashboard() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.id = 'screen-dashboard';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Dashboard</div><div class="a-sub">Welcome back, ${ADMIN_NAME}. Here's what's happening.</div></div>
      <div class="a-actions">
        <button class="btn btn-ghost" onclick="exportReport()">Export Report</button>
        <button class="btn btn-primary" onclick="broadcastModal()">📢 Broadcast</button>
      </div>
    </div>
    <div class="a-body">
      <div class="stat-grid" id="statGrid">
        ${[1,2,3,4].map(() => `<div class="stat-card" style="height:100px;background:var(--panel2);animation:pulse 1.5s infinite;"></div>`).join('')}
      </div>
      <div class="dash-grid">
        <div class="a-panel">
          <div class="a-panel-header">
            <div class="a-panel-title">📈 User Growth — Last 7 Days</div>
            <span id="growthPct" style="font-size:10px;color:var(--text3);font-family:var(--mono);">—</span>
          </div>
          <div class="a-panel-body">
            <div class="chart-bars" id="chartBars" style="height:90px;"></div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);" id="chartSummary"></div>
          </div>
        </div>
        <div class="a-panel">
          <div class="a-panel-header">
            <div class="a-panel-title">⚡ Live Activity</div>
            <div class="live-pill"><div class="live-dot"></div>Live</div>
          </div>
          <div class="a-panel-body" style="padding:0 14px;" id="activityFeed">
            <div style="padding:16px;text-align:center;color:var(--text3);font-size:11px;">Loading…</div>
          </div>
        </div>
      </div>
    </div>
  `;
  main.appendChild(screen);
  await Promise.all([loadStats(), loadActivity()]);
}

async function loadStats() {
  try {
    const s = await aGet('/api/stats');
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card sc-p">
        <div class="stat-icon">👤</div>
        <div class="stat-val sv-p">${s.total_users.toLocaleString()}</div>
        <div class="stat-label">Total Users</div>
        <div class="stat-change">↑ +${s.new_this_week} this week</div>
      </div>
      <div class="stat-card sc-pk">
        <div class="stat-icon">💬</div>
        <div class="stat-val sv-pk">${s.total_messages.toLocaleString()}</div>
        <div class="stat-label">Messages Sent</div>
      </div>
      <div class="stat-card sc-g">
        <div class="stat-icon">👥</div>
        <div class="stat-val sv-g">${s.total_groups}</div>
        <div class="stat-label">Groups Created</div>
      </div>
      <div class="stat-card sc-r">
        <div class="stat-icon">🚨</div>
        <div class="stat-val sv-r">${s.pending_reports}</div>
        <div class="stat-label">Pending Reports</div>
        ${s.pending_reports > 0 ? '<div class="stat-change down">Needs review</div>' : '<div class="stat-change">All clear</div>'}
      </div>
    `;
    // Update nav badges
    document.getElementById('navUserCount').textContent = s.total_users;
    document.getElementById('navReportCount').textContent = s.pending_reports;

    // Chart
    const daily = s.daily_signups || [];
    const maxVal = Math.max(...daily, 1);
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    document.getElementById('chartBars').innerHTML = daily.map((v, i) => `
      <div class="bar-col">
        <div class="bar" style="height:${Math.max((v/maxVal)*80, 4)}px;" title="${v} signups"></div>
        <div class="bar-lbl">${days[i]||''}</div>
      </div>
    `).join('');
    const total = daily.reduce((a,b) => a+b, 0);
    document.getElementById('chartSummary').innerHTML = `
      <div style="text-align:center;"><div style="font-family:'Syne';font-weight:800;font-size:16px;color:var(--accent);">${Math.round(total/7)}</div><div style="font-size:10px;color:var(--text3);">Daily Avg</div></div>
      <div style="text-align:center;"><div style="font-family:'Syne';font-weight:800;font-size:16px;color:var(--accent2);">${total}</div><div style="font-size:10px;color:var(--text3);">This Week</div></div>
      <div style="text-align:center;"><div style="font-family:'Syne';font-weight:800;font-size:16px;color:var(--accent3);">${s.total_users}</div><div style="font-size:10px;color:var(--text3);">Total</div></div>
    `;
  } catch(e) { console.error(e); }
}

async function loadActivity() {
  try {
    const data = await aGet('/api/activity');
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    let html = '';
    data.recent_signups?.forEach(u => {
      html += `<div class="act-item">
        <div class="act-icon ai-join">🆕</div>
        <div style="flex:1;">
          <div class="act-text"><strong>@${u.username}</strong> joined — ID #${u.nexus_id} ${countryFlag(u.country)}</div>
          <div class="act-time">${timeAgo(u.created_at)}</div>
        </div>
        <div class="act-tag at-new">NEW</div>
      </div>`;
    });
    data.recent_reports?.forEach(r => {
      html += `<div class="act-item">
        <div class="act-icon ai-report">🚨</div>
        <div style="flex:1;">
          <div class="act-text"><strong>@${r.reported?.username||'user'}</strong> was reported by <strong>@${r.reporter?.username||'user'}</strong></div>
          <div class="act-time">${timeAgo(r.created_at)}</div>
        </div>
        <div class="act-tag at-alert">REPORT</div>
      </div>`;
    });
    feed.innerHTML = html || '<div style="padding:12px;text-align:center;color:var(--text3);font-size:11px;">No recent activity</div>';
  } catch(e) {}
}

function broadcastModal() {
  openAModal(`
    <div class="a-modal-title">📢 Broadcast Message <span class="a-modal-close" onclick="closeAModal()">×</span></div>
    <p style="color:var(--text2);font-size:12px;margin-bottom:12px;line-height:1.6;">This message will be sent as a notification to ALL active users on the platform.</p>
    <div class="fg" style="margin-bottom:14px;">
      <label class="fl">Message</label>
      <textarea class="fi" id="bcastMsg" placeholder="Write your announcement…" style="height:80px;resize:none;"></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeAModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="submitBroadcast()" style="flex:1;">Send to All ✦</button>
    </div>
  `);
}

async function submitBroadcast() {
  const msg = document.getElementById('bcastMsg').value.trim();
  if (!msg) { aToast('Message cannot be empty', 'error'); return; }
  try {
    const data = await aPost('/api/broadcast', { message: msg });
    aToast(`Sent to ${data.sent_to} users ✦`, 'success');
    closeAModal();
  } catch(e) { aToast(e.message, 'error'); }
}

function exportReport() { aToast('Export feature coming soon', 'info'); }
