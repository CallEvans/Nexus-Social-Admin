// Nexus Admin — Users
let currentUserFilter = 'all';

async function loadUsers() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Users</div><div class="a-sub" id="userSubtitle">Loading…</div></div>
      <div class="a-actions">
        <div class="a-search"><span style="color:var(--text3);">🔍</span><input id="userSearch" placeholder="Search name, username, ID…" oninput="searchUsers(this.value)"/></div>
        <button class="btn btn-ghost" onclick="loadUsersData()">↻ Refresh</button>
      </div>
    </div>
    <div class="a-tabs">
      <div class="a-tab active" onclick="filterUsers('all',this)">All Users</div>
      <div class="a-tab" onclick="filterUsers('active',this)">Active</div>
      <div class="a-tab" onclick="filterUsers('suspended',this)">Suspended</div>
      <div class="a-tab" onclick="filterUsers('banned',this)">Banned</div>
    </div>
    <div style="flex:1;overflow:hidden;">
      <div class="a-table-wrap" style="height:100%;overflow-y:auto;">
        <table>
          <thead>
            <tr>
              <th>User</th><th>Nexus ID</th><th>Country</th>
              <th>Age</th><th>Joined</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text3);">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  main.appendChild(screen);
  await loadUsersData();
}

async function loadUsersData(q = '', status = currentUserFilter) {
  try {
    const url = `/api/users?q=${encodeURIComponent(q)}&status=${status}`;
    const users = await aGet(url);
    document.getElementById('userSubtitle').textContent = `${users.length} users`;
    renderUsersTable(users);
  } catch(e) {
    document.getElementById('usersTableBody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:20px;">Failed to load users</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text3);">No users found</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => {
    const g = gradientForStr(u.username || 'u');
    const init = (u.full_name || 'U')[0];
    const flag = u.country ? countryFlag(u.country) : '';
    const avImg = u.avatar_url
      ? `<div class="u-av" style="overflow:hidden;"><img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;"/></div>`
      : `<div class="u-av ${g}">${init}</div>`;
    const canBan = u.nexus_id !== '000001';
    return `
      <tr onclick="viewUserDetail('${u.id}')">
        <td><div class="u-cell">${avImg}<div><div class="u-name">${u.full_name}${u.nexus_id==='000001'?'  ⭐':''}</div><div class="u-handle">@${u.username}</div></div></div></td>
        <td><div class="uid-chip">#${u.nexus_id}</div></td>
        <td>${flag}</td>
        <td style="color:var(--text2);">${u.age || '—'}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text3);">${formatDate(u.created_at)}</td>
        <td>${statusPill(u)}</td>
        <td onclick="event.stopPropagation()">
          <div class="t-btns">
            <button class="t-btn primary" onclick="viewUserDetail('${u.id}')">View</button>
            ${canBan && !u.is_suspended && !u.is_banned ? `<button class="t-btn warn" onclick="suspendModal('${u.id}','${u.full_name}')">Suspend</button>` : ''}
            ${canBan && u.is_suspended ? `<button class="t-btn success" onclick="unsuspendUser('${u.id}')">Unsuspend</button>` : ''}
            ${canBan && !u.is_banned ? `<button class="t-btn danger" onclick="banUser('${u.id}','${u.full_name}')">Ban</button>` : ''}
            ${canBan && u.is_banned ? `<button class="t-btn" onclick="unbanUser('${u.id}')">Unban</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

let searchTimeout;
function searchUsers(q) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadUsersData(q, currentUserFilter), 350);
}

function filterUsers(status, el) {
  currentUserFilter = status;
  document.querySelectorAll('.a-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const q = document.getElementById('userSearch')?.value || '';
  loadUsersData(q, status);
}

async function viewUserDetail(userId) {
  try {
    const data = await aGet(`/api/users/${userId}`);
    const u = data.user;
    const g = gradientForStr(u.username || 'u');
    const init = (u.full_name || 'U')[0];
    const flag = u.country ? countryFlag(u.country) : '';
    const avContent = u.avatar_url
      ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"/>`
      : init;
    const canAction = u.nexus_id !== '000001';

    openAModal(`
      <div class="a-modal-title">User Details <span class="a-modal-close" onclick="closeAModal()">×</span></div>
      <div style="display:flex;flex-direction:column;gap:12px;max-height:55vh;overflow-y:auto;padding-right:4px;">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div class="${g}" style="width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;font-family:'Syne';flex-shrink:0;overflow:hidden;">${avContent}</div>
          <div>
            <div style="font-family:'Syne';font-weight:800;font-size:16px;">${u.full_name} ${flag}</div>
            <div style="color:var(--text2);font-size:12px;margin-top:2px;">@${u.username} · <span class="uid-chip">#${u.nexus_id}</span></div>
            <div style="margin-top:6px;">${statusPill(u)}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${infoRow('Email', u.email)}
          ${infoRow('Age', u.age || '—')}
          ${infoRow('Gender', u.gender || '—')}
          ${infoRow('Pronouns', u.pronouns || '—')}
          ${infoRow('Sexuality', u.sexuality || '—')}
          ${infoRow('Joined', formatDate(u.created_at))}
          ${infoRow('Reports Against', data.report_count)}
          ${infoRow('Groups', data.groups.length)}
          ${infoRow('Can Create Groups', u.can_create_groups ? 'Yes' : 'No')}
        </div>
        ${canAction ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--border);">
            ${!u.is_suspended && !u.is_banned ? `<button class="btn btn-warn" onclick="closeAModal();suspendModal('${u.id}','${u.full_name}')">Suspend</button>` : ''}
            ${u.is_suspended ? `<button class="btn btn-success" onclick="unsuspendUser('${u.id}');closeAModal()">Unsuspend</button>` : ''}
            ${!u.is_banned ? `<button class="btn btn-danger" onclick="banUser('${u.id}','${u.full_name}');closeAModal()">Permanent Ban</button>` : ''}
            ${u.is_banned ? `<button class="btn btn-ghost" onclick="unbanUser('${u.id}');closeAModal()">Unban</button>` : ''}
            <button class="btn btn-ghost" onclick="toggleGroupAccess('${u.id}',${!u.can_create_groups})">
              ${u.can_create_groups ? '🚫 Revoke Group Access' : '✓ Grant Group Access'}
            </button>
          </div>
        ` : '<div style="font-size:11px;color:var(--gold);padding-top:8px;border-top:1px solid var(--border);">⭐ Super Admin — protected account</div>'}
      </div>
    `);
  } catch(e) { aToast('Could not load user', 'error'); }
}

function infoRow(key, val) {
  return `<div class="info-row"><span class="info-key">${key}</span><span class="info-val">${val}</span></div>`;
}

function suspendModal(userId, name) {
  openAModal(`
    <div class="a-modal-title">Suspend User <span class="a-modal-close" onclick="closeAModal()">×</span></div>
    <p style="color:var(--text2);font-size:12px;margin-bottom:14px;">Suspending <strong style="color:var(--text);">${name}</strong>. They won't be able to log in during this period.</p>
    <div class="fg" style="margin-bottom:14px;">
      <label class="fl">Duration (days)</label>
      <select class="fi" id="suspendDays">
        <option value="1">1 day</option>
        <option value="3">3 days</option>
        <option value="7" selected>7 days</option>
        <option value="14">14 days</option>
        <option value="30">30 days</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-ghost" onclick="closeAModal()" style="flex:1;">Cancel</button>
      <button class="btn btn-warn" onclick="doSuspend('${userId}')" style="flex:1;">Suspend</button>
    </div>
  `);
}

async function doSuspend(userId) {
  const days = document.getElementById('suspendDays').value;
  try {
    await aPost(`/api/users/${userId}/suspend`, { days: parseInt(days) });
    aToast(`User suspended for ${days} days`, 'success');
    closeAModal();
    loadUsersData();
  } catch(e) { aToast(e.message, 'error'); }
}

async function unsuspendUser(userId) {
  try {
    await aPost(`/api/users/${userId}/unsuspend`, {});
    aToast('User unsuspended', 'success');
    loadUsersData();
  } catch(e) { aToast(e.message, 'error'); }
}

async function banUser(userId, name) {
  if (!confirm(`Permanently ban ${name}? This cannot be easily undone.`)) return;
  try {
    await aPost(`/api/users/${userId}/ban`, {});
    aToast(`${name} has been permanently banned`, 'success');
    loadUsersData();
  } catch(e) { aToast(e.message, 'error'); }
}

async function unbanUser(userId) {
  try {
    await aPost(`/api/users/${userId}/unban`, {});
    aToast('User unbanned', 'success');
    loadUsersData();
  } catch(e) { aToast(e.message, 'error'); }
}

async function toggleGroupAccess(userId, grant) {
  try {
    await aPost(`/api/users/${userId}/toggle-groups`, { can_create_groups: grant });
    aToast(grant ? 'Group access granted' : 'Group access revoked', 'success');
    closeAModal();
  } catch(e) { aToast(e.message, 'error'); }
}
