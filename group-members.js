// ============================================================
// VITALSTAR — group-members.js
// Members tab for group.html
// ============================================================

import {
  collection,
  query,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const STYLE_ID = 'vs-group-members-styles';
let ctx = null;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .members-wrap { width:100%; }
    .members-search {
      width:100%; padding:12px 14px; margin-bottom:14px;
      border-radius:12px; border:1px solid var(--border-subtle);
      background:var(--bg-surface); color:var(--text-primary);
      outline:none;
    }
    .members-list { display:flex; flex-direction:column; gap:10px; }
    .member-card {
      display:flex; align-items:center; gap:12px;
      padding:12px 14px; border:1px solid var(--border-subtle);
      background:var(--bg-surface); border-radius:14px;
    }
    .member-avatar {
      width:42px; height:42px; flex-shrink:0; border-radius:12px;
      background:linear-gradient(135deg,var(--electric-blue),var(--violet-accent))
        center/cover;
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-weight:700;
    }
    .member-info { flex:1; min-width:0; }
    .member-name { color:var(--text-primary); font-weight:600; font-size:14px; }
    .member-role { color:var(--text-muted); font-size:11px; margin-top:3px; text-transform:capitalize; }
    .member-actions { display:flex; gap:6px; }
    .member-action {
      border:1px solid var(--border-subtle); background:var(--bg-surface-raised);
      color:var(--text-secondary); border-radius:9px; padding:7px 9px;
      font-size:11px;
    }
    .members-empty { text-align:center; padding:40px 20px; color:var(--text-muted); }
  `;
  document.head.appendChild(style);
}

function canManageMembers() {
  const role = ctx.membership?.role;
  return role === 'owner' || role === 'admin';
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}

export async function init(context) {
  ctx = context;
  injectStyles();

  ctx.panelEl.innerHTML = `
    <div class="members-wrap">
      <input class="members-search" id="groupMembersSearch"
             type="search" placeholder="Search members...">
      <div class="members-list" id="groupMembersList">
        <div class="members-empty">Loading members...</div>
      </div>
    </div>
  `;

  const members = await loadMembers();

  const search = document.getElementById('groupMembersSearch');
  search.addEventListener('input', () => {
    renderMembers(members, search.value.trim().toLowerCase());
  });
}

async function loadMembers() {
  try {
    const ref = collection(ctx.db, 'groups', ctx.groupId, 'members');
    const q = query(ref, orderBy('joinedAt', 'asc'));
    const snap = await getDocs(q);

    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMembers(members);
    return members;
  } catch (error) {
    console.error('Error loading group members:', error);
    document.getElementById('groupMembersList').innerHTML =
      '<div class="members-empty">Could not load members.</div>';
    ctx.showToast?.('Could not load members.', 'error');
    return [];
  }
}

function renderMembers(members, searchText = '') {
  const list = document.getElementById('groupMembersList');
  if (!list) return;

  const filtered = members.filter(member => {
    const name = (member.displayName || member.name || '').toLowerCase();
    const username = (member.username || '').toLowerCase();
    return !searchText || name.includes(searchText) || username.includes(searchText);
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="members-empty">No members found.</div>';
    return;
  }

  list.innerHTML = '';

  filtered.forEach(member => {
    const name = member.displayName || member.name || 'VitalStar Member';
    const role = member.role || 'member';

    const card = document.createElement('div');
    card.className = 'member-card';

    card.innerHTML = `
      <div class="member-avatar"></div>
      <div class="member-info">
        <div class="member-name"></div>
        <div class="member-role"></div>
      </div>
      <div class="member-actions"></div>
    `;

    const avatar = card.querySelector('.member-avatar');
    if (ctx.applyMediaBackground) {
      ctx.applyMediaBackground(
        avatar,
        member.photoURL || member.avatarURL || '',
        ctx.initialsFrom ? ctx.initialsFrom(name) : initials(name)
      );
    } else {
      avatar.textContent = initials(name);
    }

    card.querySelector('.member-name').textContent = name;
    card.querySelector('.member-role').textContent = role;

    if (canManageMembers() && member.uid !== ctx.currentUser.uid && role !== 'owner') {
      const actions = card.querySelector('.member-actions');

      const adminBtn = document.createElement('button');
      adminBtn.className = 'member-action';
      adminBtn.textContent = role === 'admin' ? 'Make member' : 'Make admin';

      adminBtn.addEventListener('click', async () => {
        try {
          const newRole = role === 'admin' ? 'member' : 'admin';
          await updateDoc(
            doc(ctx.db, 'groups', ctx.groupId, 'members', member.id),
            { role: newRole }
          );
          ctx.showToast?.(`Member role changed to ${newRole}.`, 'success');
          await init(ctx);
        } catch (error) {
          console.error('Error changing member role:', error);
          ctx.showToast?.('Could not change member role.', 'error');
        }
      });

      actions.appendChild(adminBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'member-action';
      removeBtn.textContent = 'Remove';

      removeBtn.addEventListener('click', async () => {
        if (!window.confirm(`Remove ${name} from this group?`)) return;

        try {
          await deleteDoc(
            doc(ctx.db, 'groups', ctx.groupId, 'members', member.id)
          );
          ctx.showToast?.('Member removed.', 'success');
          await init(ctx);
        } catch (error) {
          console.error('Error removing member:', error);
          ctx.showToast?.('Could not remove member.', 'error');
        }
      });

      actions.appendChild(removeBtn);
    }

    list.appendChild(card);
  });
}

