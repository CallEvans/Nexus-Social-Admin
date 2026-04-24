// Nexus Admin — Officials
async function loadOfficials() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Officials</div><div class="a-sub">Team members with admin panel access</div></div>
      <div class="a-actions">
        ${ADMIN_ROLE === 'super_admin' ? `<button class="btn btn-primary" onclick="addOfficialModal()">+ Add Official</button>` : ''}
      </div>
    </div>
    <div class="a-body">
      <div style="background:rgba(124,111,255,0.07);border:1px solid rgba(124,111,255,0.18);border-radius:11px;padding:12px 15px;margin-bottom:16px;font-size:12px;color:rgba(232,235,255,0.7);line-height:1.6;">
        ℹ️ Officials sign in using their <strong style="color:var(--text);">existing Nexus Social credentials</strong>. You can grant or revoke access at any time. Officials only see what their role allows.
      </div>
      <div class="a-panel">
        <div class="a-panel-header"><div class="a-panel-title">👥 Current Officials</div></div>
        <div class="a-table-wrap" id="officialsTable">
          <div style="padding:20px;text-align:center;color:var(--text3);">Loading…</div>
        </div>
      </div>
    </div>
  `;
  main.appendChild(screen);
  await fetchOfficials();
}

async function fetchOfficials() {
  try {
    const officials = await aGet('/api/officials');
    const table = document.getElementById('officialsTable');
    if (!officials.length) {
      table.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);">No officials added yet</div>';
      return;
    }
    const roleColors = { super_admin: 'var(--gold)', admin: 'var(--accent)', moderator: 'var(--accent2)' };
    const accessMap = { super_admin: 'Full Access', admin: 'Users, Reports, Groups', moderator: 'Reports Only' };
    table.innerHTML = `
      <table>
        <thead><tr><th>User</th><th>Nexus ID</th><th>Role</th><th>Access</th><th>Added</th><th>Actions</th></tr></thead>
        <tbody>
          ${officials.map(o => {
            const u = o.user || {};
            const g = gradientForStr(u.username || 'u');
            const init = (u.full_name || 'A')[0];
            const isSuper = o.role === 'super_admin';
            const isMe = o.user_id === ADMIN_USER_ID;
            return `<tr>
              <td><div class="u-cell">
                <div class="u-av ${g}">${init}</div>
                <div><div class="u-name">${u.full_name||'User'}${isSuper?' ⭐':''}</div><div class="u-handle">@${u.username||'—'}</div></div>
              </div></td>
              <td><div class="uid-chip">#${u.nexus_id||'—'}</div></td>
              <td><span style="color:${roleColors[o.role]||'var(--text2)'};font-size:11px;font-weight:700;font-family:'Syne';">${o.role.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
              <td style="color:var(--text2);font-size:11px;">${accessMap[o.role]||'—'}</td>
              <td style="font-family:var(--mono);font-size:10px;color:var(--text3);">${isSuper ? 'Founder' : formatDate(o.created_at)}</td>
              <td onclick="event.stopPropagation()">
                ${!isSuper && !isMe && ADMIN_ROLE === 'super_admin' ? `
                  <div class="t-btns">
                    <button class="t-btn primary" onclick="editRoleModal('${o.id}','${o.role}','${u.full_name||'User'}')">Edit Role</button>
                    <button class="t-btn danger" onclick="revokeOfficial('${o.id}','${u.full_name||'User'}')">Revoke</button>
                  </div>
                ` : `<span style="font-size:11px;color:var(--text3);">${isMe ? 'You' : 'Protected'}</span>`}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch(e) { aToast('Could not load officials', 'error'); }
}

function addOfficialModal() {
  openAModal(`
    <div class="a-modal-title">Add Official <span class="a-modal-close" onclick="closeAModal()">×</span></div>
    <p style="color:var(--text2);font-size:12px;margin-bottom:14px;line-height:1.6;">The user must already have a Nexus Social account. They will receive a notification and can access the admin panel using their own login.</p>
    <div class="fg" style="margin-bottom:12px;">
      <label class="fl">Username (without @)</label>
      <input class="fi" id="newOfficialUser" placeholder="e.g. ken_username"/>
    </div>
    <div class="fg" style="margin-bottom:16px;">
      <label class="fl">Role</label>
      <select class="fi" id="newOfficialRole">
        <option value="moderator">Moderator — Reports only</option>
        <option value="admin">Admin — Users, Reports, Groups</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeAModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="submitAddOfficial()" style="flex:1;">Add Official ✦</button>
    </div>
  `);
}

async function submitAddOfficial() {
  const username = document.getElementById('newOfficialUser').value.trim().toLowerCase();
  const role = document.getElementById('newOfficialRole').value;
  if (!username) { aToast('Username required', 'error'); return; }
  try {
    await aPost('/api/officials/add', { username, role });
    aToast(`@${username} added as ${role.replace('_',' ')} ✦`, 'success');
    closeAModal();
    fetchOfficials();
  } catch(e) { aToast(e.message, 'error'); }
}

function editRoleModal(officialId, currentRole, name) {
  openAModal(`
    <div class="a-modal-title">Edit Role — ${name} <span class="a-modal-close" onclick="closeAModal()">×</span></div>
    <div class="fg" style="margin-bottom:16px;">
      <label class="fl">New Role</label>
      <select class="fi" id="editRole">
        <option value="moderator" ${currentRole==='moderator'?'selected':''}>Moderator — Reports only</option>
        <option value="admin" ${currentRole==='admin'?'selected':''}>Admin — Users, Reports, Groups</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeAModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-primary" onclick="submitEditRole('${officialId}')" style="flex:1;">Update</button>
    </div>
  `);
}

async function submitEditRole(officialId) {
  const role = document.getElementById('editRole').value;
  try {
    await aPost(`/api/officials/${officialId}/update-role`, { role });
    aToast('Role updated ✦', 'success');
    closeAModal();
    fetchOfficials();
  } catch(e) { aToast(e.message, 'error'); }
}

async function revokeOfficial(officialId, name) {
  if (!confirm(`Revoke admin access for ${name}?`)) return;
  try {
    await aDel(`/api/officials/${officialId}/revoke`);
    aToast(`Access revoked for ${name}`, 'success');
    fetchOfficials();
  } catch(e) { aToast(e.message, 'error'); }
}
