// Nexus Admin — Platform Controls
async function loadControls() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Platform Controls</div><div class="a-sub">Manage features, toggles, and announcements</div></div>
    </div>
    <div class="a-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" id="controlsGrid">
        <div style="padding:30px;text-align:center;color:var(--text3);">Loading settings…</div>
      </div>
    </div>
  `;
  main.appendChild(screen);
  await loadControlSettings();
}

async function loadControlSettings() {
  try {
    const s = await aGet('/api/settings');
    document.getElementById('controlsGrid').innerHTML = `
      <div class="a-panel">
        <div class="a-panel-header"><div class="a-panel-title">🎛️ Feature Toggles</div></div>
        <div class="a-panel-body">
          ${toggle('groups_enabled', 'Group Creation', 'Allow users to create new group chats', s.groups_enabled === 'true')}
          ${toggle('media_uploads_enabled', 'Media Uploads', 'Enable image/video uploads (max 20MB)', s.media_uploads_enabled === 'true')}
          ${toggle('dm_enabled', 'Direct Messages', 'Enable private messaging between users', s.dm_enabled === 'true')}
          ${toggle('registrations_enabled', 'New Registrations', 'Allow new users to sign up', s.registrations_enabled === 'true')}
          ${toggle('maintenance_mode', 'Maintenance Mode', 'Show maintenance page to all users', s.maintenance_mode === 'true', true)}
        </div>
      </div>

      <div class="a-panel">
        <div class="a-panel-header"><div class="a-panel-title">📢 Broadcast Announcement</div></div>
        <div class="a-panel-body">
          <textarea class="fi" id="bcastMsg" placeholder="Message to all users…" style="height:80px;resize:none;width:100%;margin-bottom:10px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" style="flex:1;" onclick="submitBroadcast()">📢 Send to All</button>
            <button class="btn btn-ghost" onclick="previewBroadcast()">Preview</button>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
            <div style="font-size:11px;color:var(--text2);margin-bottom:8px;line-height:1.6;">When Group Creation is toggled ON, users will automatically receive a notification that groups are now available.</div>
            <button class="btn btn-success" style="width:100%;font-size:11px;" onclick="notifyGroupsEnabled()">🔔 Manually Notify: Groups Now Available</button>
          </div>
        </div>
      </div>

      <div class="a-panel">
        <div class="a-panel-header"><div class="a-panel-title">📊 Platform Health</div></div>
        <div class="a-panel-body" style="display:flex;flex-direction:column;gap:8px;" id="healthPanel">
          <div style="text-align:center;color:var(--text3);font-size:11px;">Loading…</div>
        </div>
      </div>

      <div class="a-panel">
        <div class="a-panel-header"><div class="a-panel-title">🔒 Security</div></div>
        <div class="a-panel-body">
          <p style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.6;">Security controls are managed automatically. Email verification is enforced at registration. Rate limiting is always active.</p>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div class="info-row"><span class="info-key">Email Verification</span><span style="color:var(--success);font-size:11px;font-family:var(--mono);">✓ Enforced</span></div>
            <div class="info-row"><span class="info-key">Rate Limiting</span><span style="color:var(--success);font-size:11px;font-family:var(--mono);">✓ Active</span></div>
            <div class="info-row"><span class="info-key">RLS Policies</span><span style="color:var(--success);font-size:11px;font-family:var(--mono);">✓ Enabled</span></div>
            <div class="info-row"><span class="info-key">Max Upload Size</span><span class="info-val">20 MB</span></div>
          </div>
        </div>
      </div>
    `;
    loadHealthStats();
  } catch(e) { aToast('Could not load settings', 'error'); }
}

function toggle(key, title, desc, checked, isDanger = false) {
  return `
    <div class="toggle-row">
      <div>
        <div class="toggle-title" style="${isDanger && checked ? 'color:var(--danger);' : ''}">${title}</div>
        <div class="toggle-desc">${desc}</div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="updateSetting('${key}', this.checked)"/>
        <div class="toggle-track"><div class="toggle-thumb"></div></div>
      </label>
    </div>
  `;
}

async function updateSetting(key, value) {
  try {
    await aPost('/api/settings/update', { [key]: value ? 'true' : 'false' });
    aToast(`${key.replace(/_/g,' ')} updated ✦`, 'success');
  } catch(e) { aToast(e.message, 'error'); }
}

async function loadHealthStats() {
  try {
    const s = await aGet('/api/stats');
    document.getElementById('healthPanel').innerHTML = `
      <div class="info-row"><span class="info-key">Total Users</span><span class="info-val">${s.total_users.toLocaleString()}</span></div>
      <div class="info-row"><span class="info-key">Total Groups</span><span class="info-val">${s.total_groups}</span></div>
      <div class="info-row"><span class="info-key">Messages Sent</span><span class="info-val">${s.total_messages.toLocaleString()}</span></div>
      <div class="info-row"><span class="info-key">Suspended Accounts</span><span style="color:var(--warn);font-size:11px;font-family:var(--mono);">${s.suspended_users}</span></div>
      <div class="info-row"><span class="info-key">Banned Accounts</span><span style="color:var(--danger);font-size:11px;font-family:var(--mono);">${s.banned_users}</span></div>
      <div class="info-row"><span class="info-key">Pending Reports</span><span style="color:${s.pending_reports>0?'var(--danger)':'var(--success)'};font-size:11px;font-family:var(--mono);">${s.pending_reports}</span></div>
    `;
  } catch(e) {}
}

async function notifyGroupsEnabled() {
  try {
    await aPost('/api/settings/update', { groups_enabled: 'true' });
    aToast('Notification sent to all users ✦', 'success');
  } catch(e) { aToast(e.message, 'error'); }
}

function previewBroadcast() {
  const msg = document.getElementById('bcastMsg')?.value.trim();
  if (!msg) { aToast('Write a message first', 'error'); return; }
  openAModal(`
    <div class="a-modal-title">Preview <span class="a-modal-close" onclick="closeAModal()">×</span></div>
    <div style="background:var(--bg3);border-radius:10px;padding:14px;font-size:12px;color:rgba(232,235,255,0.75);line-height:1.6;">
      📢 ${msg}
    </div>
    <div style="margin-top:14px;display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeAModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="closeAModal();submitBroadcast()" style="flex:1;">Send ✦</button>
    </div>
  `);
}
