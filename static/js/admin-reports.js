// Nexus Admin — Reports
async function loadReports() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Reports</div><div class="a-sub" id="reportSub">Loading…</div></div>
    </div>
    <div class="a-tabs">
      <div class="a-tab active" onclick="loadReportsByStatus('pending',this)">Pending</div>
      <div class="a-tab" onclick="loadReportsByStatus('resolved',this)">Resolved</div>
      <div class="a-tab" onclick="loadReportsByStatus('dismissed',this)">Dismissed</div>
    </div>
    <div class="a-body" id="reportsBody" style="overflow-y:auto;">
      <div style="text-align:center;padding:30px;color:var(--text3);">Loading…</div>
    </div>
  `;
  main.appendChild(screen);
  await loadReportsByStatus('pending');
}

async function loadReportsByStatus(status, el) {
  if (el) {
    document.querySelectorAll('.a-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }
  try {
    const reports = await aGet(`/api/reports?status=${status}`);
    document.getElementById('reportSub').textContent = `${reports.length} ${status} report${reports.length !== 1 ? 's' : ''}`;
    const body = document.getElementById('reportsBody');
    if (!reports.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);font-size:13px;">${status === 'pending' ? '✦ All clear — no pending reports!' : 'No reports here'}</div>`;
      return;
    }
    body.innerHTML = reports.map(r => renderReportCard(r, status)).join('');
  } catch(e) { document.getElementById('reportsBody').innerHTML = `<div style="color:var(--danger);padding:20px;">Could not load reports</div>`; }
}

function renderReportCard(r, status) {
  const typeMap = {
    harassment: { label: '🚨 Harassment', cls: 'critical' },
    spam: { label: '🤖 Spam / Bot', cls: 'warning' },
    inappropriate_content: { label: '📸 Inappropriate Content', cls: 'warning' },
    hate_speech: { label: '⚠️ Hate Speech', cls: 'critical' },
    other: { label: '📋 Other', cls: '' },
  };
  const { label, cls } = typeMap[r.type] || { label: r.type, cls: '' };
  const reported = r.reported || {};
  const reporter = r.reporter || {};
  const isPending = status === 'pending';

  return `
    <div class="r-card ${cls}">
      <div class="r-card-header">
        <div>
          <div class="r-type">${label}</div>
          <div class="r-meta">
            Reported: <strong style="color:var(--text);">@${reported.username||'unknown'}</strong> (${reported.nexus_id ? '#'+reported.nexus_id : '—'})
            · By: <strong style="color:var(--text);">@${reporter.username||'unknown'}</strong>
            · ${timeAgo(r.created_at)}
          </div>
        </div>
        ${reported.is_banned ? '<div class="status-pill sp-banned" style="flex-shrink:0;">✕ Already Banned</div>' : ''}
      </div>
      ${r.message ? `<div class="r-body">"${r.message}"</div>` : ''}
      ${isPending ? `
        <div class="r-actions">
          ${!reported.is_banned ? `
            <button class="btn btn-danger" onclick="reportAction('${r.id}','ban','${reported.id}','${reported.full_name||'User'}')">Ban User</button>
            <button class="btn btn-warn" onclick="reportAction('${r.id}','suspend','${reported.id}','${reported.full_name||'User'}')">Suspend</button>
          ` : ''}
          <button class="btn btn-ghost" onclick="resolveReport('${r.id}','resolved')">Mark Resolved</button>
          <button class="btn btn-ghost" onclick="resolveReport('${r.id}','dismissed')">Dismiss</button>
        </div>
      ` : `<div style="font-size:11px;color:var(--text3);">Status: ${status}</div>`}
    </div>
  `;
}

async function resolveReport(reportId, action) {
  try {
    await aPost(`/api/reports/${reportId}/resolve`, { action });
    aToast(`Report ${action}`, 'success');
    loadReportsByStatus(action === 'dismissed' ? 'dismissed' : 'resolved');
    loadReports();
  } catch(e) { aToast(e.message, 'error'); }
}

async function reportAction(reportId, action, userId, userName) {
  try {
    if (action === 'ban') {
      await banUser(userId, userName);
    } else {
      suspendModal(userId, userName);
    }
    await aPost(`/api/reports/${reportId}/resolve`, { action: 'resolved' });
    await loadReportsByStatus('pending');
  } catch(e) { aToast(e.message, 'error'); }
}
