// Nexus Admin — Groups
async function loadAdminGroups() {
  const main = document.getElementById('aMain');
  main.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'a-screen active';
  screen.innerHTML = `
    <div class="a-header">
      <div><div class="a-title">Groups</div><div class="a-sub" id="groupSub">Loading…</div></div>
    </div>
    <div style="flex:1;overflow:hidden;">
      <div class="a-table-wrap" style="height:100%;overflow-y:auto;">
        <table>
          <thead>
            <tr><th>Group</th><th>Code</th><th>Owner</th><th>Members</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody id="groupsTableBody">
            <tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">Loading…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  main.appendChild(screen);
  try {
    const groups = await aGet('/api/groups');
    document.getElementById('groupSub').textContent = `${groups.length} groups · ${groups.reduce((s,g) => s+g.member_count, 0).toLocaleString()} total members`;
    const tbody = document.getElementById('groupsTableBody');
    if (!groups.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No groups yet</td></tr>`;
      return;
    }
    tbody.innerHTML = groups.map(g => {
      const owner = g.owner || {};
      return `<tr>
        <td><div class="u-cell">
          <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,rgba(124,111,255,0.3),rgba(255,107,157,0.2));display:flex;align-items:center;justify-content:center;font-size:14px;">${g.banner_emoji||'💬'}</div>
          <div><div class="u-name">${g.name}</div></div>
        </div></td>
        <td><div class="uid-chip">${g.group_code}</div></td>
        <td style="color:var(--text2);font-size:12px;">@${owner.username||'—'} <span class="uid-chip" style="font-size:9px;">#${owner.nexus_id||'—'}</span></td>
        <td style="font-family:var(--mono);font-size:11px;">${g.member_count}</td>
        <td style="font-family:var(--mono);font-size:10px;color:var(--text3);">${formatDate(g.created_at)}</td>
        <td onclick="event.stopPropagation()">
          <div class="t-btns">
            <button class="t-btn danger" onclick="deleteGroup('${g.id}','${g.name}')">Remove</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {}
}

async function deleteGroup(groupId, name) {
  if (!confirm(`Remove group "${name}"? All messages will be lost.`)) return;
  try {
    await aDel(`/api/groups/${groupId}/delete`);
    aToast(`Group "${name}" removed`, 'success');
    loadAdminGroups();
  } catch(e) { aToast(e.message, 'error'); }
}
