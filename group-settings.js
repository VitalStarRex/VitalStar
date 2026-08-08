// ============================================================
// VITALSTAR — group-settings.js
// Group settings tab for group.html
// ============================================================

import {
  doc,
  getDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const STYLE_ID = 'vs-group-settings-styles';
let ctx = null;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .group-settings { display:flex; flex-direction:column; gap:14px; }
    .settings-card {
      background:var(--bg-surface); border:1px solid var(--border-subtle);
      border-radius:16px; padding:16px;
    }
    .settings-title {
      color:var(--text-primary); font-weight:700;
      font-size:15px; margin-bottom:12px;
    }
    .settings-field { margin-bottom:12px; }
    .settings-field:last-child { margin-bottom:0; }
    .settings-label {
      display:block; color:var(--text-secondary);
      font-size:12px; margin-bottom:6px;
    }
    .settings-input, .settings-textarea, .settings-select {
      width:100%; padding:11px 12px;
      border:1px solid var(--border-subtle);
      border-radius:10px; background:var(--bg-surface-raised);
      color:var(--text-primary); outline:none;
      font:inherit;
    }
    .settings-textarea { min-height:90px; resize:vertical; }
    .settings-save {
      padding:10px 16px; border:0; border-radius:999px;
      background:linear-gradient(135deg,var(--electric-blue),var(--violet-accent));
      color:#fff; font-weight:600;
    }
    .settings-note { color:var(--text-muted); font-size:12px; line-height:1.5; }
    .settings-denied {
      text-align:center; padding:45px 20px; color:var(--text-muted);
    }
  `;
  document.head.appendChild(style);
}

function canEditSettings() {
  const role = ctx.membership?.role;
  return role === 'owner' || role === 'admin';
}

export async function init(context) {
  ctx = context;
  injectStyles();

  if (!canEditSettings()) {
    ctx.panelEl.innerHTML = `
      <div class="settings-denied">
        <i class="fa-solid fa-lock" style="font-size:28px;margin-bottom:12px;"></i>
        <p>Only the group owner or admins can change group settings.</p>
      </div>
    `;
    return;
  }

  ctx.panelEl.innerHTML = `
    <div class="group-settings">
      <div class="settings-card">
        <div class="settings-title">General</div>

        <div class="settings-field">
          <label class="settings-label">Group name</label>
          <input class="settings-input" id="groupSettingName" maxlength="80">
        </div>

        <div class="settings-field">
          <label class="settings-label">Description</label>
          <textarea class="settings-textarea" id="groupSettingDescription"
                    maxlength="1000"></textarea>
        </div>

        <div class="settings-field">
          <label class="settings-label">Privacy</label>
          <select class="settings-select" id="groupSettingPrivacy">
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>

        <button class="settings-save" id="groupSettingsSave">
          Save changes
        </button>
      </div>

      <div class="settings-card">
        <div class="settings-title">Group rules</div>
        <p class="settings-note">
          Group rules are currently managed through the group's existing rules
          system. We will connect the rules editor here next.
        </p>
      </div>
    </div>
  `;

  await loadSettings();

  document.getElementById('groupSettingsSave')
    .addEventListener('click', saveSettings);
}

async function loadSettings() {
  try {
    const snap = await getDoc(ctx.groupRef);
    if (!snap.exists()) return;

    const group = snap.data();

    document.getElementById('groupSettingName').value = group.name || '';
    document.getElementById('groupSettingDescription').value =
      group.description || '';
    document.getElementById('groupSettingPrivacy').value =
      group.privacy || 'public';
  } catch (error) {
    console.error('Error loading group settings:', error);
    ctx.showToast?.('Could not load settings.', 'error');
  }
}

async function saveSettings() {
  const button = document.getElementById('groupSettingsSave');

  const name = document.getElementById('groupSettingName').value.trim();
  const description = document.getElementById('groupSettingDescription').value.trim();
  const privacy = document.getElementById('groupSettingPrivacy').value;

  if (!name) {
    ctx.showToast?.('Group name is required.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    await updateDoc(ctx.groupRef, {
      name,
      description,
      privacy,
      updatedAt: new Date()
    });

    if (ctx.groupData) {
      ctx.groupData.name = name;
      ctx.groupData.description = description;
      ctx.groupData.privacy = privacy;
    }

    ctx.showToast?.('Group settings saved.', 'success');
    ctx.refreshHeaderStats?.();
  } catch (error) {
    console.error('Error saving group settings:', error);
    ctx.showToast?.('Could not save group settings.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Save changes';
  }
}
