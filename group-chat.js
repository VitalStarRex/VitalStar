// ============================================================
// VITALSTAR — group-chat.js
// Group chat for group.html
// Features: text messages, real user identity (fullName + photo
// from users/{uid}), clickable profile links, image attachments
// (Cloudinary), and voice notes (MediaRecorder + Cloudinary).
// ============================================================

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const STYLE_ID = 'vs-group-chat-styles';
const MESSAGE_LIMIT = 50;

// Cloudinary config (same account used elsewhere in VitalStar)
const CLOUDINARY_CLOUD_NAME = 'm0scmqqv';
const CLOUDINARY_UPLOAD_PRESET = 'vitalstar_upload';
const CLOUDINARY_IMAGE_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const CLOUDINARY_AUDIO_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`; // Cloudinary stores audio under the "video" resource type

let ctx = null;

// Cached copy of the current user's Firestore profile (users/{uid}),
// so we don't re-fetch it on every single message send.
let senderProfileCache = null;
let senderProfileCacheUid = null;

// Pending image attachment (selected but not yet sent)
let pendingImageFile = null;
let pendingImagePreviewUrl = null;

// Voice recording state
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let recordingTimerInterval = null;
let recordingSeconds = 0;
let isUploadingVoice = false;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .group-chat {
      display:flex; flex-direction:column; height:520px;
      border:1px solid var(--border-subtle);
      border-radius:16px; overflow:hidden;
      background:var(--bg-surface);
    }
    .group-chat-messages {
      flex:1; overflow-y:auto; padding:14px;
      display:flex; flex-direction:column; gap:10px;
    }
    .group-chat-empty { margin:auto; color:var(--text-muted); text-align:center; }
    .group-message { display:flex; gap:9px; max-width:85%; }
    .group-message.mine { margin-left:auto; flex-direction:row-reverse; }
    .group-message-avatar-link { flex-shrink:0; display:block; text-decoration:none; }
    .group-message-avatar {
      width:34px; height:34px; border-radius:10px; flex-shrink:0;
      background:linear-gradient(135deg,var(--electric-blue),var(--violet-accent))
        center/cover;
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-size:11px; font-weight:700;
    }
    .group-message-bubble {
      padding:9px 12px; border-radius:13px;
      background:var(--bg-surface-raised);
      color:var(--text-primary); font-size:13px;
      line-height:1.45; word-break:break-word;
    }
    .group-message.mine .group-message-bubble {
      background:rgba(47,111,255,.18);
    }
    .group-message-name {
      font-size:10.5px; color:var(--text-muted);
      margin-bottom:3px; font-weight:600;
      text-decoration:none; display:inline-block;
    }
    .group-message-name:hover { text-decoration:underline; }
    .group-message-image {
      max-width:220px; max-height:220px; border-radius:10px;
      display:block; margin-top:4px; cursor:pointer; object-fit:cover;
    }
    .group-message-audio { margin-top:4px; max-width:230px; }
    .group-message-audio audio { width:100%; height:36px; }

    .group-chat-composer {
      display:flex; align-items:center; gap:8px; padding:10px;
      border-top:1px solid var(--border-subtle); flex-wrap:wrap;
    }
    .group-chat-input {
      flex:1; min-width:0; border:1px solid var(--border-subtle);
      background:var(--bg-surface-raised); color:var(--text-primary);
      border-radius:999px; padding:10px 14px; outline:none;
    }
    .group-chat-send,
    .group-chat-attach-btn,
    .group-chat-mic-btn {
      width:40px; height:40px; border:0; border-radius:50%;
      color:#fff; flex-shrink:0; display:flex; align-items:center;
      justify-content:center; cursor:pointer;
    }
    .group-chat-send { background:var(--electric-blue); }
    .group-chat-attach-btn,
    .group-chat-mic-btn {
      background:var(--bg-surface-raised); color:var(--text-primary);
      border:1px solid var(--border-subtle);
    }
    .group-chat-mic-btn.recording { background:#e0333f; color:#fff; border-color:#e0333f; }
    .group-chat-attach-btn:disabled,
    .group-chat-mic-btn:disabled,
    .group-chat-send:disabled { opacity:.5; cursor:not-allowed; }

    .group-chat-image-preview {
      display:flex; align-items:center; gap:8px;
      padding:0 10px 8px 10px; width:100%;
    }
    .group-chat-image-preview img {
      width:52px; height:52px; object-fit:cover; border-radius:10px;
      border:1px solid var(--border-subtle);
    }
    .group-chat-image-preview-remove {
      border:0; background:var(--bg-surface-raised); color:var(--text-primary);
      width:26px; height:26px; border-radius:50%; cursor:pointer;
    }
    .group-chat-image-preview-label { font-size:12px; color:var(--text-muted); }

    .group-chat-recording-bar {
      display:flex; align-items:center; gap:10px;
      width:100%; padding:6px 4px;
    }
    .group-chat-recording-dot {
      width:10px; height:10px; border-radius:50%; background:#e0333f;
      animation: vs-pulse 1s infinite;
    }
    @keyframes vs-pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
    .group-chat-recording-time { font-size:13px; color:var(--text-primary); flex:1; }
    .group-chat-recording-cancel,
    .group-chat-recording-stop {
      border:0; border-radius:50%; width:36px; height:36px; cursor:pointer;
      display:flex; align-items:center; justify-content:center; color:#fff;
    }
    .group-chat-recording-cancel { background:var(--bg-surface-raised); color:var(--text-primary); }
    .group-chat-recording-stop { background:var(--electric-blue); }

    .composer-join-notice {
      display:flex; align-items:center; gap:8px; padding:16px;
      color:var(--text-muted); font-size:13px;
    }
  `;
  document.head.appendChild(style);
}

function isActiveMember() {
  return ctx.membership?.status === 'active';
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}

function escapeHtml(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ------------------------------------------------------------
// Real user identity: fetch the current user's profile document
// from users/{uid} so messages carry their actual name & photo.
// ------------------------------------------------------------
async function getSenderProfile() {
  const uid = ctx.currentUser.uid;

  if (senderProfileCache && senderProfileCacheUid === uid) {
    return senderProfileCache;
  }

  let fullName = ctx.currentUser.displayName || 'VitalStar Member';
  let photoURL = ctx.currentUser.photoURL || '';

  try {
    const userSnap = await getDoc(doc(ctx.db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.fullName) fullName = data.fullName;
      if (data.photoURL) photoURL = data.photoURL;
    }
  } catch (error) {
    console.error('Error fetching sender profile:', error);
    // Fall back silently to auth-provided name/photo above.
  }

  senderProfileCache = { uid, fullName, photoURL };
  senderProfileCacheUid = uid;
  return senderProfileCache;
}

export async function init(context) {
  ctx = context;
  injectStyles();

  // Reset any per-session state from a previous group/init
  senderProfileCache = null;
  senderProfileCacheUid = null;
  clearPendingImage();
  cancelRecording(true);

  if (!isActiveMember()) {
    ctx.panelEl.innerHTML = `
      <div class="composer-join-notice">
        <i class="fa-solid fa-circle-info"></i>
        <span>Join this group to use the group chat.</span>
      </div>
    `;
    return;
  }

  const canRecordAudio = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  ctx.panelEl.innerHTML = `
    <div class="group-chat">
      <div class="group-chat-messages" id="groupChatMessages">
        <div class="group-chat-empty">Loading chat...</div>
      </div>

      <div id="groupChatImagePreview"></div>
      <div id="groupChatRecordingBar"></div>

      <div class="group-chat-composer" id="groupChatComposer">
        <input type="file" id="groupChatImageInput" accept="image/*" style="display:none">
        <button class="group-chat-attach-btn" id="groupChatAttachBtn" type="button" title="Attach image">
          <i class="fa-solid fa-image"></i>
        </button>
        <button class="group-chat-mic-btn" id="groupChatMicBtn" type="button" title="Record voice note"
          ${canRecordAudio ? '' : 'disabled'}>
          <i class="fa-solid fa-microphone"></i>
        </button>
        <input class="group-chat-input" id="groupChatInput"
               maxlength="2000" placeholder="Write a message...">
        <button class="group-chat-send" id="groupChatSend" type="button">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;

  if (!canRecordAudio) {
    document.getElementById('groupChatMicBtn').title = 'Voice notes are not supported in this browser';
  }

  await loadMessages();

  const input = document.getElementById('groupChatInput');
  const send = document.getElementById('groupChatSend');
  const attachBtn = document.getElementById('groupChatAttachBtn');
  const imageInput = document.getElementById('groupChatImageInput');
  const micBtn = document.getElementById('groupChatMicBtn');

  attachBtn.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', onImageSelected);
  micBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') return; // already recording
    startRecording();
  });

  const submit = async () => {
    // If a voice note is currently being recorded, ignore text-send clicks.
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    const text = input.value.trim();

    if (pendingImageFile) {
      await sendImageMessage(text);
      return;
    }

    if (!text) return;

    setComposerBusy(true);
    try {
      const profile = await getSenderProfile();
      await addDoc(collection(ctx.db, 'groups', ctx.groupId, 'messages'), {
        senderId: ctx.currentUser.uid,
        senderName: profile.fullName,
        senderPhotoURL: profile.photoURL,
        text,
        imageURL: '',
        audioURL: '',
        createdAt: serverTimestamp()
      });

      input.value = '';
      await loadMessages();
    } catch (error) {
      console.error('Error sending group message:', error);
      ctx.showToast?.('Could not send message.', 'error');
    } finally {
      setComposerBusy(false);
      input.focus();
    }
  };

  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
}

function setComposerBusy(busy) {
  const send = document.getElementById('groupChatSend');
  const attachBtn = document.getElementById('groupChatAttachBtn');
  const micBtn = document.getElementById('groupChatMicBtn');
  if (send) send.disabled = busy;
  if (attachBtn) attachBtn.disabled = busy;
  if (micBtn && !mediaRecorder) micBtn.disabled = busy || micBtn.disabled;
}

// ------------------------------------------------------------
// Image attachment flow
// ------------------------------------------------------------
function onImageSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // allow re-selecting the same file later
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    ctx.showToast?.('Please select an image file.', 'error');
    return;
  }

  pendingImageFile = file;
  pendingImagePreviewUrl = URL.createObjectURL(file);
  renderImagePreview();
}

function renderImagePreview() {
  const box = document.getElementById('groupChatImagePreview');
  if (!box) return;

  if (!pendingImageFile) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    <div class="group-chat-image-preview">
      <img src="${pendingImagePreviewUrl}" alt="Selected image">
      <span class="group-chat-image-preview-label">Image ready to send</span>
      <button class="group-chat-image-preview-remove" id="groupChatRemoveImage" type="button" title="Remove image">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  document.getElementById('groupChatRemoveImage').addEventListener('click', clearPendingImage);
}

function clearPendingImage() {
  if (pendingImagePreviewUrl) URL.revokeObjectURL(pendingImagePreviewUrl);
  pendingImageFile = null;
  pendingImagePreviewUrl = null;
  const box = document.getElementById('groupChatImagePreview');
  if (box) box.innerHTML = '';
}

async function uploadToCloudinary(file, url) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(url, { method: 'POST', body: formData });
  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Upload failed');
  }

  return data.secure_url;
}

async function sendImageMessage(caption) {
  if (!pendingImageFile) return;

  const file = pendingImageFile;
  setComposerBusy(true);

  try {
    const secureUrl = await uploadToCloudinary(file, CLOUDINARY_IMAGE_URL);
    const profile = await getSenderProfile();

    await addDoc(collection(ctx.db, 'groups', ctx.groupId, 'messages'), {
      senderId: ctx.currentUser.uid,
      senderName: profile.fullName,
      senderPhotoURL: profile.photoURL,
      text: caption || '',
      imageURL: secureUrl,
      audioURL: '',
      createdAt: serverTimestamp()
    });

    clearPendingImage();
    const input = document.getElementById('groupChatInput');
    if (input) input.value = '';
    await loadMessages();
  } catch (error) {
    console.error('Error sending image message:', error);
    ctx.showToast?.('Could not upload image. Message was not sent.', 'error');
    // Do not clear pendingImageFile so the user can retry.
  } finally {
    setComposerBusy(false);
  }
}

// ------------------------------------------------------------
// Voice note flow
// ------------------------------------------------------------
async function startRecording() {
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) {
    ctx.showToast?.('Voice notes are not supported in this browser.', 'error');
    return;
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error('Microphone access error:', error);
    ctx.showToast?.('Could not access the microphone.', 'error');
    return;
  }

  recordedChunks = [];
  const mimeType = window.MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

  try {
    mediaRecorder = mimeType ? new MediaRecorder(recordingStream, { mimeType }) : new MediaRecorder(recordingStream);
  } catch (error) {
    console.error('MediaRecorder init error:', error);
    ctx.showToast?.('Could not start voice recording.', 'error');
    stopStreamTracks();
    return;
  }

  mediaRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  });

  mediaRecorder.addEventListener('stop', onRecordingStopped);

  mediaRecorder.start();
  recordingSeconds = 0;
  showRecordingBar();
  recordingTimerInterval = setInterval(() => {
    recordingSeconds += 1;
    updateRecordingTime();
  }, 1000);

  // Hide the normal composer controls while recording.
  const composer = document.getElementById('groupChatComposer');
  if (composer) composer.style.display = 'none';
}

function showRecordingBar() {
  const box = document.getElementById('groupChatRecordingBar');
  if (!box) return;

  box.innerHTML = `
    <div class="group-chat-recording-bar">
      <span class="group-chat-recording-dot"></span>
      <span class="group-chat-recording-time" id="groupChatRecordingTime">Recording... 0:00</span>
      <button class="group-chat-recording-cancel" id="groupChatCancelRecording" type="button" title="Cancel">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button class="group-chat-recording-stop" id="groupChatStopRecording" type="button" title="Send voice note">
        <i class="fa-solid fa-check"></i>
      </button>
    </div>
  `;

  document.getElementById('groupChatCancelRecording').addEventListener('click', () => cancelRecording(false));
  document.getElementById('groupChatStopRecording').addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop(); // triggers onRecordingStopped -> uploads & sends
    }
  });
}

function updateRecordingTime() {
  const el = document.getElementById('groupChatRecordingTime');
  if (!el) return;
  const mins = Math.floor(recordingSeconds / 60);
  const secs = recordingSeconds % 60;
  el.textContent = `Recording... ${mins}:${String(secs).padStart(2, '0')}`;
}

function stopStreamTracks() {
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }
}

function resetRecordingUI() {
  clearInterval(recordingTimerInterval);
  recordingTimerInterval = null;
  recordingSeconds = 0;

  const box = document.getElementById('groupChatRecordingBar');
  if (box) box.innerHTML = '';

  const composer = document.getElementById('groupChatComposer');
  if (composer) composer.style.display = '';
}

// cancel: true = silent cleanup (e.g. on init), false = user pressed cancel
function cancelRecording(silent) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    // Detach the stop handler's send logic by marking as cancelled first.
    mediaRecorder.removeEventListener('stop', onRecordingStopped);
    mediaRecorder.stop();
  }
  stopStreamTracks();
  mediaRecorder = null;
  recordedChunks = [];
  resetRecordingUI();
  if (!silent) {
    // nothing further to do — recording discarded
  }
}

async function onRecordingStopped() {
  stopStreamTracks();
  resetRecordingUI();

  if (!recordedChunks.length) {
    mediaRecorder = null;
    return;
  }

  const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  mediaRecorder = null;
  recordedChunks = [];

  if (isUploadingVoice) return;
  isUploadingVoice = true;
  setComposerBusy(true);

  try {
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    const file = new File([blob], `voice-note.${extension}`, { type: blob.type });
    const secureUrl = await uploadToCloudinary(file, CLOUDINARY_AUDIO_URL);
    const profile = await getSenderProfile();

    await addDoc(collection(ctx.db, 'groups', ctx.groupId, 'messages'), {
      senderId: ctx.currentUser.uid,
      senderName: profile.fullName,
      senderPhotoURL: profile.photoURL,
      text: '',
      imageURL: '',
      audioURL: secureUrl,
      createdAt: serverTimestamp()
    });

    await loadMessages();
  } catch (error) {
    console.error('Error sending voice note:', error);
    ctx.showToast?.('Could not upload voice note. It was not sent.', 'error');
  } finally {
    isUploadingVoice = false;
    setComposerBusy(false);
  }
}

// ------------------------------------------------------------
// Loading & rendering messages
// ------------------------------------------------------------
async function loadMessages() {
  const box = document.getElementById('groupChatMessages');
  if (!box) return;

  try {
    const messagesRef = collection(ctx.db, 'groups', ctx.groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGE_LIMIT));
    const snap = await getDocs(q);

    box.innerHTML = '';

    if (snap.empty) {
      box.innerHTML = '<div class="group-chat-empty">No messages yet. Start the conversation!</div>';
      return;
    }

    const messages = snap.docs.reverse();

    messages.forEach(d => {
      const message = { id: d.id, ...d.data() };
      const mine = message.senderId === ctx.currentUser.uid;
      const name = message.senderName || 'VitalStar Member';
      const profileHref = `profile.html?id=${encodeURIComponent(message.senderId || '')}`;

      const row = document.createElement('div');
      row.className = `group-message${mine ? ' mine' : ''}`;

      row.innerHTML = `
        <a class="group-message-avatar-link" href="${profileHref}">
          <div class="group-message-avatar"></div>
        </a>
        <div>
          <div class="group-message-bubble">
            <a class="group-message-name" href="${profileHref}"></a>
            ${message.text ? '<div class="group-message-text"></div>' : ''}
            ${message.imageURL ? `<img class="group-message-image" src="${message.imageURL}" alt="Shared image">` : ''}
            ${message.audioURL ? `<div class="group-message-audio"><audio controls src="${message.audioURL}"></audio></div>` : ''}
          </div>
        </div>
      `;

      const avatar = row.querySelector('.group-message-avatar');
      if (ctx.applyMediaBackground) {
        ctx.applyMediaBackground(
          avatar,
          message.senderPhotoURL || '',
          ctx.initialsFrom ? ctx.initialsFrom(name) : initials(name)
        );
      } else {
        avatar.textContent = initials(name);
      }

      row.querySelector('.group-message-name').textContent = name;

      const textEl = row.querySelector('.group-message-text');
      if (textEl) textEl.textContent = message.text || '';

      const imageEl = row.querySelector('.group-message-image');
      if (imageEl) {
        imageEl.addEventListener('click', () => window.open(message.imageURL, '_blank'));
      }

      box.appendChild(row);
    });

    box.scrollTop = box.scrollHeight;
  } catch (error) {
    console.error('Error loading group chat:', error);
    box.innerHTML = '<div class="group-chat-empty">Could not load chat.</div>';
  }
}
