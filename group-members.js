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

// ============================================================
// CLOUDINARY
// ============================================================

async function uploadToCloudinary(file) {

  if (!file) return '';

  const type = file.type.startsWith('video')
    ? 'video'
    : 'image';

  const formData = new FormData();

  formData.append('file', file);

  formData.append(
    'upload_preset',
    'vitalstar_upload'
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/m0scmqqv/${type}/upload`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error('Cloudinary upload failed.');
  }

  const data = await response.json();

  return data.secure_url || '';
}


// ============================================================
// STYLES
// ============================================================

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;

  style.textContent = `
    .group-settings {
      display:flex;
      flex-direction:column;
      gap:14px;
    }

    .settings-card {
      background:var(--bg-surface);
      border:1px solid var(--border-subtle);
      border-radius:16px;
      padding:16px;
    }

    .settings-title {
      color:var(--text-primary);
      font-weight:700;
      font-size:15px;
      margin-bottom:12px;
    }

    .settings-field {
      margin-bottom:12px;
    }

    .settings-field:last-child {
      margin-bottom:0;
    }

    .settings-label {
      display:block;
      color:var(--text-secondary);
      font-size:12px;
      margin-bottom:6px;
    }

    .settings-input,
    .settings-textarea,
    .settings-select {
      width:100%;
      padding:11px 12px;
      border:1px solid var(--border-subtle);
      border-radius:10px;
      background:var(--bg-surface-raised);
      color:var(--text-primary);
      outline:none;
      font:inherit;
    }

    .settings-textarea {
      min-height:90px;
      resize:vertical;
    }

    .settings-save {
      padding:10px 16px;
      border:0;
      border-radius:999px;
      background:linear-gradient(
        135deg,
        var(--electric-blue),
        var(--violet-accent)
      );
      color:#fff;
      font-weight:600;
    }

    .settings-save:disabled {
      opacity:.6;
    }

    .settings-note {
      color:var(--text-muted);
      font-size:12px;
      line-height:1.5;
    }

    .settings-denied {
      text-align:center;
      padding:45px 20px;
      color:var(--text-muted);
    }


    /* ========================================================
       GROUP MEDIA
       ======================================================== */

    .group-media-grid {
      display:grid;
      grid-template-columns:1fr;
      gap:16px;
    }

    .group-media-box {
      position:relative;
    }

    .group-cover-preview {
      width:100%;
      height:150px;
      border-radius:14px;
      border:1px solid var(--border-subtle);
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        );
      background-size:cover;
      background-position:center;
      overflow:hidden;
    }

    .group-cover-preview::after {
      content:'';
      position:absolute;
      inset:0;
      background:linear-gradient(
        to bottom,
        transparent,
        rgba(0,0,0,.25)
      );
      pointer-events:none;
    }

    .group-avatar-preview-wrap {
      display:flex;
      align-items:center;
      gap:14px;
    }

    .group-avatar-preview {
      width:82px;
      height:82px;
      flex-shrink:0;
      border-radius:20px;
      border:2px solid var(--border-subtle);
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        );
      background-size:cover;
      background-position:center;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-size:26px;
      font-weight:700;
      overflow:hidden;
    }

    .media-upload-button {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      padding:9px 13px;
      border-radius:10px;
      border:1px solid var(--border-subtle);
      background:var(--bg-surface-raised);
      color:var(--text-primary);
      font-size:12px;
      font-weight:600;
      cursor:pointer;
    }

    .media-upload-button:active {
      transform:scale(.98);
    }

    .media-upload-input {
      display:none;
    }

    .media-upload-status {
      margin-top:8px;
      color:var(--text-muted);
      font-size:11px;
    }

    .media-section-label {
      display:block;
      color:var(--text-secondary);
      font-size:12px;
      margin-bottom:7px;
    }
  `;

  document.head.appendChild(style);
}


// ============================================================
// PERMISSION
// ============================================================

function canEditSettings() {
  const role = ctx.membership?.role;

  return role === 'owner' || role === 'admin';
}


// ============================================================
// INITIALIZE
// ============================================================

export async function init(context) {

  ctx = context;

  injectStyles();

  if (!canEditSettings()) {

    ctx.panelEl.innerHTML = `
      <div class="settings-denied">
        <i
          class="fa-solid fa-lock"
          style="font-size:28px;margin-bottom:12px;"
        ></i>

        <p>
          Only the group owner or admins can change group settings.
        </p>
      </div>
    `;

    return;
  }


  ctx.panelEl.innerHTML = `

    <div class="group-settings">


      <!-- ==================================================
           GROUP MEDIA
           ================================================== -->

      <div class="settings-card">

        <div class="settings-title">
          Group appearance
        </div>


        <div class="group-media-grid">


          <!-- COVER -->

          <div class="group-media-box">

            <span class="media-section-label">
              Cover photo
            </span>

            <div
              class="group-cover-preview"
              id="groupCoverPreview"
            ></div>

            <div style="margin-top:10px;">

              <label
                class="media-upload-button"
                for="groupCoverInput"
              >
                <i class="fa-solid fa-camera"></i>
                Change cover photo
              </label>

              <input
                type="file"
                id="groupCoverInput"
                class="media-upload-input"
                accept="image/*"
              >

            </div>

            <div
              class="media-upload-status"
              id="groupCoverStatus"
            ></div>

          </div>


          <!-- AVATAR -->

          <div class="group-media-box">

            <span class="media-section-label">
              Profile picture
            </span>

            <div class="group-avatar-preview-wrap">

              <div
                class="group-avatar-preview"
                id="groupAvatarPreview"
              ></div>

              <div>

                <label
                  class="media-upload-button"
                  for="groupAvatarInput"
                >
                  <i class="fa-solid fa-camera"></i>
                  Change picture
                </label>

                <input
                  type="file"
                  id="groupAvatarInput"
                  class="media-upload-input"
                  accept="image/*"
                >

                <div
                  class="media-upload-status"
                  id="groupAvatarStatus"
                ></div>

              </div>

            </div>

          </div>


        </div>

      </div>


      <!-- ==================================================
           GENERAL
           ================================================== -->

      <div class="settings-card">

        <div class="settings-title">
          General
        </div>


        <div class="settings-field">

          <label class="settings-label">
            Group name
          </label>

          <input
            class="settings-input"
            id="groupSettingName"
            maxlength="80"
          >

        </div>


        <div class="settings-field">

          <label class="settings-label">
            Description
          </label>

          <textarea
            class="settings-textarea"
            id="groupSettingDescription"
            maxlength="1000"
          ></textarea>

        </div>


        <div class="settings-field">

          <label class="settings-label">
            Privacy
          </label>

          <select
            class="settings-select"
            id="groupSettingPrivacy"
          >
            <option value="public">
              Public
            </option>

            <option value="private">
              Private
            </option>
          </select>

        </div>


        <button
          class="settings-save"
          id="groupSettingsSave"
        >
          Save changes
        </button>

      </div>


      <!-- ==================================================
           RULES
           ================================================== -->

      <div class="settings-card">

        <div class="settings-title">
          Group rules
        </div>

        <p class="settings-note">
          Group rules are currently managed through the group's
          existing rules system. We will connect the rules editor here next.
        </p>

      </div>


    </div>

  `;


  await loadSettings();


  // General settings

  document
    .getElementById('groupSettingsSave')
    .addEventListener('click', saveSettings);


  // Cover upload

  document
    .getElementById('groupCoverInput')
    .addEventListener('change', handleCoverUpload);


  // Avatar upload

  document
    .getElementById('groupAvatarInput')
    .addEventListener('change', handleAvatarUpload);
}


// ============================================================
// LOAD SETTINGS
// ============================================================

async function loadSettings() {

  try {

    const snap = await getDoc(ctx.groupRef);

    if (!snap.exists()) return;

    const group = snap.data();


    document.getElementById('groupSettingName').value =
      group.name || '';


    document.getElementById('groupSettingDescription').value =
      group.description || '';


    document.getElementById('groupSettingPrivacy').value =
      group.privacy || 'public';


    // Cover preview

    const coverPreview =
      document.getElementById('groupCoverPreview');

    if (group.coverURL) {

      coverPreview.style.backgroundImage =
        `url("${group.coverURL}")`;

    }


    // Avatar preview

    const avatarPreview =
      document.getElementById('groupAvatarPreview');

    if (group.avatarURL) {

      avatarPreview.style.backgroundImage =
        `url("${group.avatarURL}")`;

      avatarPreview.textContent = '';

    } else {

      avatarPreview.textContent =
        ctx.initialsFrom
          ? ctx.initialsFrom(group.name)
          : (group.name || '?').charAt(0).toUpperCase();

    }

  } catch (error) {

    console.error(
      'Error loading group settings:',
      error
    );

    ctx.showToast?.(
      'Could not load settings.',
      'error'
    );
  }
}


// ============================================================
// COVER UPLOAD
// ============================================================

async function handleCoverUpload(event) {

  const file = event.target.files?.[0];

  if (!file) return;


  const status =
    document.getElementById('groupCoverStatus');

  const preview =
    document.getElementById('groupCoverPreview');


  if (!file.type.startsWith('image/')) {

    ctx.showToast?.(
      'Please choose an image for the cover.',
      'error'
    );

    event.target.value = '';

    return;
  }


  status.textContent = 'Uploading cover photo...';


  try {

    const coverURL =
      await uploadToCloudinary(file);


    if (!coverURL) {
      throw new Error('No Cloudinary URL returned.');
    }


    await updateDoc(ctx.groupRef, {
      coverURL,
      updatedAt: new Date()
    });


    preview.style.backgroundImage =
      `url("${coverURL}")`;


    if (ctx.groupData) {
      ctx.groupData.coverURL = coverURL;
    }


    status.textContent =
      'Cover photo updated successfully.';


    ctx.showToast?.(
      'Group cover photo updated.',
      'success'
    );

  } catch (error) {

    console.error(
      'Error uploading group cover:',
      error
    );

    status.textContent = '';

    ctx.showToast?.(
      'Could not upload the cover photo.',
      'error'
    );

  } finally {

    event.target.value = '';

  }
}


// ============================================================
// AVATAR UPLOAD
// ============================================================

async function handleAvatarUpload(event) {

  const file = event.target.files?.[0];

  if (!file) return;


  const status =
    document.getElementById('groupAvatarStatus');

  const preview =
    document.getElementById('groupAvatarPreview');


  if (!file.type.startsWith('image/')) {

    ctx.showToast?.(
      'Please choose an image for the profile picture.',
      'error'
    );

    event.target.value = '';

    return;
  }


  status.textContent =
    'Uploading profile picture...';


  try {

    const avatarURL =
      await uploadToCloudinary(file);


    if (!avatarURL) {
      throw new Error('No Cloudinary URL returned.');
    }


    await updateDoc(ctx.groupRef, {
      avatarURL,
      updatedAt: new Date()
    });


    preview.style.backgroundImage =
      `url("${avatarURL}")`;

    preview.textContent = '';


    if (ctx.groupData) {
      ctx.groupData.avatarURL = avatarURL;
    }


    status.textContent =
      'Profile picture updated successfully.';


    ctx.showToast?.(
      'Group profile picture updated.',
      'success'
    );

  } catch (error) {

    console.error(
      'Error uploading group avatar:',
      error
    );

    status.textContent = '';

    ctx.showToast?.(
      'Could not upload the profile picture.',
      'error'
    );

  } finally {

    event.target.value = '';

  }
}


// ============================================================
// SAVE GENERAL SETTINGS
// ============================================================

async function saveSettings() {

  const button =
    document.getElementById('groupSettingsSave');


  const name =
    document
      .getElementById('groupSettingName')
      .value
      .trim();


  const description =
    document
      .getElementById('groupSettingDescription')
      .value
      .trim();


  const privacy =
    document
      .getElementById('groupSettingPrivacy')
      .value;


  if (!name) {

    ctx.showToast?.(
      'Group name is required.',
      'error'
    );

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


    ctx.showToast?.(
      'Group settings saved.',
      'success'
    );


    ctx.refreshHeaderStats?.();


  } catch (error) {

    console.error(
      'Error saving group settings:',
      error
    );

    ctx.showToast?.(
      'Could not save group settings.',
      'error'
    );

  } finally {

    button.disabled = false;
    button.textContent = 'Save changes';

  }
}