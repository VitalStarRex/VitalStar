// ============================================================
// VITALSTAR — group-chat.js
// Basic group chat for group.html
// ============================================================

import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const STYLE_ID = 'vs-group-chat-styles';
const MESSAGE_LIMIT = 50;
let ctx = null;

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
    }
    .group-chat-composer {
      display:flex; gap:8px; padding:10px;
      border-top:1px solid var(--border-subtle);
    }
    .group-chat-input {
      flex:1; min-width:0; border:1px solid var(--border-subtle);
      background:var(--bg-surface-raised); color:var(--text-primary);
      border-radius:999px; padding:10px 14px; outline:none;
    }
    .group-chat-send {
      width:40px; height:40px; border:0; border-radius:50%;
      background:var(--electric-blue); color:#fff;
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

export async function init(context) {
  ctx = context;
  injectStyles();

  if (!isActiveMember()) {
    ctx.panelEl.innerHTML = `
      <div class="composer-join-notice">
        <i class="fa-solid fa-circle-info"></i>
        <span>Join this group to use the group chat.</span>
      </div>
    `;
    return;
  }

  ctx.panelEl.innerHTML = `
    <div class="group-chat">
      <div class="group-chat-messages" id="groupChatMessages">
        <div class="group-chat-empty">Loading chat...</div>
      </div>
      <div class="group-chat-composer">
        <input class="group-chat-input" id="groupChatInput"
               maxlength="2000" placeholder="Write a message...">
        <button class="group-chat-send" id="groupChatSend" type="button">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;

  await loadMessages();

  const input = document.getElementById('groupChatInput');
  const send = document.getElementById('groupChatSend');

  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;

    send.disabled = true;

    try {
      await addDoc(collection(ctx.db, 'groups', ctx.groupId, 'messages'), {
        senderId: ctx.currentUser.uid,
        senderName: ctx.currentUser.displayName || 'VitalStar Member',
        senderPhotoURL: ctx.currentUser.photoURL || '',
        text,
        createdAt: serverTimestamp()
      });

      input.value = '';
      await loadMessages();
    } catch (error) {
      console.error('Error sending group message:', error);
      ctx.showToast?.('Could not send message.', 'error');
    } finally {
      send.disabled = false;
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

      const row = document.createElement('div');
      row.className = `group-message${mine ? ' mine' : ''}`;

      row.innerHTML = `
        <div class="group-message-avatar"></div>
        <div>
          <div class="group-message-bubble">
            <div class="group-message-name"></div>
            <div class="group-message-text"></div>
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
      row.querySelector('.group-message-text').textContent = message.text || '';

      box.appendChild(row);
    });

    box.scrollTop = box.scrollHeight;
  } catch (error) {
    console.error('Error loading group chat:', error);
    box.innerHTML = '<div class="group-chat-empty">Could not load chat.</div>';
  }
}

