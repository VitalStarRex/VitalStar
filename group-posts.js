// ============================================================
// VITALSTAR — group-posts.js
// Lazily loaded by group.js the first time the Posts tab opens.
// Exports init(ctx). Handles the composer (text/image/video),
// the feed (pin-aware, paginated), likes, comments + one level
// of replies, edit/delete/pin/report/repost/share.
// ============================================================

import {
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ============================================================
// CLOUDINARY — same unsigned upload method used across VitalStar
// ============================================================
const CLOUDINARY_CLOUD_NAME = 'm0scmqqv';
const CLOUDINARY_UPLOAD_PRESET = 'vitalstar_upload';

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
          resolve({ url: response.secure_url, resourceType: response.resource_type });
        } else {
          reject(new Error(response.error?.message || 'Upload to Cloudinary failed.'));
        }
      } catch (err) {
        reject(new Error('Unexpected response from Cloudinary.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary.'));
    xhr.send(formData);
  });
}

const POSTS_PAGE_SIZE = 10;
const POSTS_STYLE_ID = 'vs-group-posts-styles';

let ctx = null;
let state = null;

// ============================================================
// STYLES (injected once)
// ============================================================
function injectStyles() {
  if (document.getElementById(POSTS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = POSTS_STYLE_ID;
  style.textContent = `
    .composer {
      border-radius: var(--radius-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .composer__top { display: flex; gap: 12px; }
    .composer__avatar {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--electric-blue), var(--violet-accent)) center/cover;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-weight: 700; color: #fff; font-size: 15px;
    }
    .composer__input {
      flex: 1; min-height: 42px; max-height: 220px; resize: none;
      background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm); padding: 11px 14px; color: var(--text-primary);
      font-family: var(--font-body); font-size: 14px; outline: none;
      transition: border-color 0.2s var(--ease-out);
    }
    .composer__input:focus { border-color: var(--electric-blue); }
    .composer__media-preview { margin-top: 12px; position: relative; display: none; border-radius: var(--radius-md); overflow: hidden; }
    .composer__media-preview.is-visible { display: block; }
    .composer__media-preview img, .composer__media-preview video { width: 100%; max-height: 320px; object-fit: cover; display: block; }
    .composer__media-remove {
      position: absolute; top: 10px; right: 10px;
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(8,11,20,0.7); border: none; color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .composer__bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
    .composer__tools { display: flex; gap: 6px; }
    .composer__tool-btn {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
      transition: all 0.2s var(--ease-out);
    }
    .composer__tool-btn:hover { color: var(--electric-blue-bright); border-color: var(--electric-blue); }
    .composer__post-btn {
      padding: 9px 20px; border-radius: var(--radius-full); border: none;
      background: linear-gradient(135deg, var(--electric-blue), var(--violet-accent));
      color: #fff; font-weight: 600; font-size: 13.5px;
      box-shadow: var(--shadow-glow-blue); transition: opacity 0.2s;
    }
    .composer__post-btn:disabled { opacity: 0.5; cursor: default; }
    .composer-join-notice {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-radius: var(--radius-lg);
      background: rgba(47,111,255,0.07); border: 1px solid rgba(47,111,255,0.18);
      color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;
    }
    .composer-join-notice i { color: var(--electric-blue-bright); }

    .post-card {
      border-radius: var(--radius-lg); background: var(--bg-surface);
      border: 1px solid var(--border-subtle); padding: 16px 18px; margin-bottom: 16px;
      animation: rise-in 0.35s var(--ease-out);
    }
    .post-card.is-pinned { border-color: rgba(255,194,75,0.35); }
    .post-card__pin-flag {
      display: none; align-items: center; gap: 6px; font-size: 11.5px;
      color: var(--gold-accent); font-weight: 600; margin-bottom: 10px;
    }
    .post-card.is-pinned .post-card__pin-flag { display: flex; }
    .post-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .post-card__author { display: flex; gap: 10px; min-width: 0; }
    .post-card__avatar {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--electric-blue), var(--violet-accent)) center/cover;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-weight: 700; color: #fff; font-size: 15px;
    }
    .post-card__author-info { min-width: 0; }
    .post-card__author-name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .post-card__author-name { font-weight: 600; font-size: 13.5px; color: var(--text-primary); }
    .role-chip { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: var(--radius-full); background: rgba(139,92,255,0.14); color: var(--violet-accent); text-transform: capitalize; }
    .post-card__meta { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }

    .post-card__menu-wrap { position: relative; }
    .post-card__menu-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: none; color: var(--text-muted); display: flex; align-items: center; justify-content: center; }
    .post-card__menu-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
    .post-card__menu {
      display: none; position: absolute; top: 38px; right: 0; z-index: 10;
      background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; min-width: 160px;
    }
    .post-card__menu.is-open { display: block; }
    .post-card__menu button {
      display: flex; align-items: center; gap: 9px; width: 100%;
      padding: 10px 14px; background: none; border: none; color: var(--text-secondary);
      font-size: 13px; text-align: left;
    }
    .post-card__menu button:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
    .post-card__menu button.is-danger:hover { color: var(--danger); }

    .post-card__text { font-size: 14px; color: var(--text-primary); line-height: 1.6; margin: 12px 0 0; white-space: pre-wrap; word-break: break-word; }
    .post-card__edit-textarea {
      width: 100%; margin-top: 12px; min-height: 70px; resize: vertical;
      background: var(--bg-surface-raised); border: 1px solid var(--electric-blue);
      border-radius: var(--radius-sm); padding: 10px 12px; color: var(--text-primary); font-size: 14px; font-family: var(--font-body);
    }
    .post-card__edit-actions { display: flex; gap: 8px; margin-top: 8px; }
    .post-card__edit-actions button { padding: 7px 14px; border-radius: var(--radius-full); font-size: 12.5px; font-weight: 600; border: 1px solid var(--border-subtle); background: var(--bg-surface-raised); color: var(--text-primary); }
    .post-card__edit-actions .save-btn { background: var(--electric-blue); border: none; color: #fff; }

    .post-card__media { margin-top: 12px; border-radius: var(--radius-md); overflow: hidden; }
    .post-card__media img, .post-card__media video { width: 100%; max-height: 460px; object-fit: cover; display: block; background: #000; }

    .repost-banner { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
    .repost-banner i { color: var(--electric-blue-bright); }
    .repost-original {
      border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
      padding: 12px 14px; margin-top: 10px; background: var(--bg-surface-raised);
    }
    .repost-original__author { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
    .repost-original__text { font-size: 13px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }

    .post-card__actions { display: flex; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
    .post-action-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
      padding: 9px; border-radius: var(--radius-sm); border: none; background: none;
      color: var(--text-muted); font-size: 12.5px; font-weight: 600; transition: all 0.2s var(--ease-out);
    }
    .post-action-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
    .post-action-btn.is-liked { color: var(--danger); }
    .post-action-btn.is-liked i { font-weight: 900; }

    .comments-section { display: none; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-subtle); }
    .comments-section.is-open { display: block; }
    .comment-composer { display: flex; gap: 8px; margin-bottom: 12px; }
    .comment-input {
      flex: 1; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);
      border-radius: var(--radius-full); padding: 9px 15px; color: var(--text-primary); font-size: 13px; outline: none;
    }
    .comment-input:focus { border-color: var(--electric-blue); }
    .comment-send-btn { width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--electric-blue); color: #fff; flex-shrink: 0; }

    .comment-item { display: flex; gap: 9px; margin-bottom: 12px; }
    .comment-avatar {
      width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--electric-blue), var(--violet-accent)) center/cover;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-weight: 700; font-size: 11.5px; color: #fff;
    }
    .comment-bubble { background: var(--bg-surface-raised); border-radius: var(--radius-md); padding: 8px 12px; flex: 1; }
    .comment-author { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
    .comment-text { font-size: 13px; color: var(--text-secondary); margin-top: 2px; line-height: 1.45; word-break: break-word; }
    .comment-footer { display: flex; gap: 12px; margin-top: 5px; }
    .comment-reply-btn { font-size: 11.5px; color: var(--text-muted); background: none; border: none; font-weight: 600; }
    .comment-reply-btn:hover { color: var(--electric-blue-bright); }
    .replies-list { margin-top: 8px; margin-left: 16px; display: flex; flex-direction: column; gap: 8px; }
    .reply-composer { display: none; gap: 8px; margin-top: 8px; margin-left: 16px; }
    .reply-composer.is-open { display: flex; }

    .load-more-posts-btn {
      display: block; width: 100%; margin-top: 6px; padding: 11px; border-radius: var(--radius-md);
      background: var(--bg-surface-raised); border: 1px solid var(--border-subtle);
      color: var(--text-primary); font-weight: 600; font-size: 13px;
    }
    .load-more-posts-btn:hover { border-color: var(--electric-blue); color: var(--electric-blue-bright); }
    .posts-empty { text-align: center; padding: 50px 20px; color: var(--text-muted); }
    .posts-empty i { font-size: 30px; color: var(--electric-blue-bright); opacity: 0.7; margin-bottom: 12px; display: block; }
  `;
  document.head.appendChild(style);
}

// ============================================================
// INIT — entry point called by group.js
// ============================================================
export async function init(context) {
  ctx = context;
  injectStyles();

  state = {
    lastVisibleDoc: null,
    hasMore: false,
    isLoadingMore: false,
    pendingMediaFile: null,
    pendingMediaType: null
  };

  ctx.panelEl.innerHTML = '';
  renderComposer();

  const feedList = document.createElement('div');
  feedList.id = 'postsFeedList';
  ctx.panelEl.appendChild(feedList);

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'load-more-posts-btn';
  loadMoreBtn.id = 'loadMorePostsBtn';
  loadMoreBtn.textContent = 'Load more posts';
  loadMoreBtn.style.display = 'none';
  loadMoreBtn.addEventListener('click', () => loadPosts(false));
  ctx.panelEl.appendChild(loadMoreBtn);

  await loadPosts(true);
}

function isActiveMember() {
  return ctx.membership && ctx.membership.status === 'active';
}

function currentUserRole() {
  return ctx.membership ? ctx.membership.role : null;
}

function canModeratePosts() {
  const role = currentUserRole();
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

// ============================================================
// COMPOSER
// ============================================================
function renderComposer() {
  if (!isActiveMember()) {
    const notice = document.createElement('div');
    notice.className = 'composer-join-notice';
    notice.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>Join this group to post, like, and comment.</span>`;
    ctx.panelEl.appendChild(notice);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'composer';
  wrap.innerHTML = `
    <div class="composer__top">
      <div class="composer__avatar" id="composerAvatar"></div>
      <textarea class="composer__input" id="composerInput" placeholder="Share something with the group…" maxlength="3000" rows="1"></textarea>
    </div>
    <div class="composer__media-preview" id="composerMediaPreview"></div>
    <div class="composer__bottom">
      <div class="composer__tools">
        <button type="button" class="composer__tool-btn" id="composerImageBtn" title="Add photo"><i class="fa-solid fa-image"></i></button>
        <button type="button" class="composer__tool-btn" id="composerVideoBtn" title="Add video"><i class="fa-solid fa-video"></i></button>
        <input type="file" id="composerImageInput" accept="image/*" style="display:none;" />
        <input type="file" id="composerVideoInput" accept="video/*" style="display:none;" />
      </div>
      <button type="button" class="composer__post-btn" id="composerPostBtn" disabled>Post</button>
    </div>
  `;
  ctx.panelEl.insertBefore(wrap, ctx.panelEl.firstChild);

  const avatarEl = wrap.querySelector('#composerAvatar');
  ctx.applyMediaBackground(avatarEl, ctx.currentUser.photoURL, ctx.initialsFrom(ctx.currentUser.displayName));

  const input = wrap.querySelector('#composerInput');
  const postBtn = wrap.querySelector('#composerPostBtn');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
    postBtn.disabled = input.value.trim().length === 0 && !state.pendingMediaFile;
  });

  wrap.querySelector('#composerImageBtn').addEventListener('click', () => wrap.querySelector('#composerImageInput').click());
  wrap.querySelector('#composerVideoBtn').addEventListener('click', () => wrap.querySelector('#composerVideoInput').click());

  wrap.querySelector('#composerImageInput').addEventListener('change', (e) => handleComposerMediaSelect(e, 'image'));
  wrap.querySelector('#composerVideoInput').addEventListener('change', (e) => handleComposerMediaSelect(e, 'video'));

  postBtn.addEventListener('click', () => submitPost(wrap));
}

function handleComposerMediaSelect(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const maxSize = type === 'video' ? 60 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > maxSize) {
    ctx.showToast(`${type === 'video' ? 'Video' : 'Image'} is too large (max ${type === 'video' ? '60MB' : '8MB'}).`, 'error');
    return;
  }

  state.pendingMediaFile = file;
  state.pendingMediaType = type;

  const preview = document.getElementById('composerMediaPreview');
  const objectUrl = URL.createObjectURL(file);
  preview.innerHTML = type === 'image'
    ? `<img src="${objectUrl}" alt="Selected image" />`
    : `<video src="${objectUrl}" controls></video>`;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'composer__media-remove';
  removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  removeBtn.addEventListener('click', () => {
    state.pendingMediaFile = null;
    state.pendingMediaType = null;
    preview.innerHTML = '';
    preview.classList.remove('is-visible');
    document.getElementById('composerPostBtn').disabled = document.getElementById('composerInput').value.trim().length === 0;
  });
  preview.appendChild(removeBtn);
  preview.classList.add('is-visible');

  document.getElementById('composerPostBtn').disabled = false;
}

async function submitPost(composerEl) {
  const input = composerEl.querySelector('#composerInput');
  const postBtn = composerEl.querySelector('#composerPostBtn');
  const text = input.value.trim();

  if (!text && !state.pendingMediaFile) return;

  postBtn.disabled = true;
  postBtn.textContent = 'Posting…';

  try {
    let mediaURL = '';
    let mediaType = 'none';

    if (state.pendingMediaFile) {
      const uploadResult = await uploadToCloudinary(state.pendingMediaFile);
      mediaURL = uploadResult.url;
      mediaType = state.pendingMediaType;
    }

    const postsRef = collection(ctx.db, 'groups', ctx.groupId, 'posts');
    await addDoc(postsRef, {
      authorId: ctx.currentUser.uid,
      authorName: ctx.currentUser.displayName || 'VitalStar Member',
      authorPhotoURL: ctx.currentUser.photoURL || '',
      authorRole: currentUserRole() || 'member',
      text,
      mediaURL,
      mediaType,
      isPinned: false,
      isEdited: false,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      repostsCount: 0,
      repostOf: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(ctx.groupRef, { postCount: increment(1) });
    ctx.refreshHeaderStats();

    input.value = '';
    input.style.height = 'auto';
    state.pendingMediaFile = null;
    state.pendingMediaType = null;
    document.getElementById('composerMediaPreview').innerHTML = '';
    document.getElementById('composerMediaPreview').classList.remove('is-visible');

    ctx.showToast('Posted!', 'success');
    await loadPosts(true);
  } catch (error) {
    console.error('Error creating post:', error);
    ctx.showToast('Could not publish your post. Please try again.', 'error');
  } finally {
    postBtn.disabled = false;
    postBtn.textContent = 'Post';
  }
}

// ============================================================
// FEED LOADING
// ============================================================
async function loadPosts(reset) {
  if (state.isLoadingMore) return;
  state.isLoadingMore = true;

  const feedList = document.getElementById('postsFeedList');
  const loadMoreBtn = document.getElementById('loadMorePostsBtn');

  if (reset) {
    state.lastVisibleDoc = null;
    feedList.innerHTML = '<div class="tab-panel-placeholder"><span class="spinner-sm"></span> Loading posts…</div>';
  }

  try {
    const constraints = [orderBy('isPinned', 'desc'), orderBy('createdAt', 'desc'), limit(POSTS_PAGE_SIZE)];
    if (!reset && state.lastVisibleDoc) constraints.push(startAfter(state.lastVisibleDoc));

    const postsQuery = query(collection(ctx.db, 'groups', ctx.groupId, 'posts'), ...constraints);
    const snapshot = await getDocs(postsQuery);

    if (reset) feedList.innerHTML = '';

    state.lastVisibleDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : state.lastVisibleDoc;
    state.hasMore = snapshot.docs.length === POSTS_PAGE_SIZE;

    if (snapshot.empty && reset) {
      feedList.innerHTML = `
        <div class="posts-empty">
          <i class="fa-solid fa-note-sticky"></i>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      `;
    } else {
      snapshot.forEach((postDoc) => {
        feedList.appendChild(renderPostCard({ id: postDoc.id, ...postDoc.data() }));
      });
    }

    loadMoreBtn.style.display = state.hasMore ? 'block' : 'none';
  } catch (error) {
    console.error('Error loading posts:', error);
    if (reset) {
      feedList.innerHTML = '<div class="posts-empty"><p>Could not load posts right now.</p></div>';
    }
    ctx.showToast('Could not load posts.', 'error');
  } finally {
    state.isLoadingMore = false;
  }
}

// ============================================================
// POST CARD
// ============================================================
function renderPostCard(post) {
  const card = document.createElement('div');
  card.className = `post-card${post.isPinned ? ' is-pinned' : ''}`;
  card.dataset.postId = post.id;

  const isAuthor = post.authorId === ctx.currentUser.uid;
  const canModerate = canModeratePosts();
  const timeLabel = post.createdAt && post.createdAt.toDate ? timeAgo(post.createdAt.toDate()) : 'just now';

  card.innerHTML = `
    <div class="post-card__pin-flag"><i class="fa-solid fa-thumbtack"></i> Pinned post</div>
    <div class="post-card__head">
      <div class="post-card__author">
        <div class="post-card__avatar"></div>
        <div class="post-card__author-info">
          <div class="post-card__author-name-row">
            <span class="post-card__author-name"></span>
            ${post.authorRole && post.authorRole !== 'member' ? `<span class="role-chip">${escapeHtml(post.authorRole)}</span>` : ''}
          </div>
          <div class="post-card__meta">${timeLabel}${post.isEdited ? ' · edited' : ''}</div>
        </div>
      </div>
      <div class="post-card__menu-wrap">
        <button type="button" class="post-card__menu-btn"><i class="fa-solid fa-ellipsis"></i></button>
        <div class="post-card__menu">
          ${isAuthor ? `<button type="button" class="edit-post-btn"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
          ${(isAuthor || canModerate) ? `<button type="button" class="delete-post-btn is-danger"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
          ${canModerate ? `<button type="button" class="pin-post-btn"><i class="fa-solid fa-thumbtack"></i> ${post.isPinned ? 'Unpin' : 'Pin'} post</button>` : ''}
          ${!isAuthor ? `<button type="button" class="report-post-btn"><i class="fa-solid fa-flag"></i> Report</button>` : ''}
        </div>
      </div>
    </div>

    <div class="post-card__body"></div>

    <div class="post-card__actions">
      <button type="button" class="post-action-btn like-btn"><i class="fa-regular fa-heart"></i> <span class="like-count">${ctx.formatCount(post.likesCount)}</span></button>
      <button type="button" class="post-action-btn comment-toggle-btn"><i class="fa-regular fa-comment"></i> <span class="comment-count">${ctx.formatCount(post.commentsCount)}</span></button>
      <button type="button" class="post-action-btn repost-btn"><i class="fa-solid fa-retweet"></i> <span class="repost-count">${ctx.formatCount(post.repostsCount)}</span></button>
      <button type="button" class="post-action-btn share-btn"><i class="fa-solid fa-share"></i> Share</button>
    </div>

    <div class="comments-section" data-loaded="false"></div>
  `;

  const authorAvatar = card.querySelector('.post-card__avatar');
  ctx.applyMediaBackground(authorAvatar, post.authorPhotoURL, ctx.initialsFrom(post.authorName));
  card.querySelector('.post-card__author-name').textContent = post.authorName || 'VitalStar Member';

  renderPostBody(card, post);
  bindPostCardEvents(card, post);
  refreshLikeButtonState(card, post.id);

  return card;
}

function renderPostBody(card, post) {
  const body = card.querySelector('.post-card__body');
  body.innerHTML = '';

  if (post.repostOf) {
    const banner = document.createElement('div');
    banner.className = 'repost-banner';
    banner.innerHTML = `<i class="fa-solid fa-retweet"></i> Reposted`;
    body.appendChild(banner);
  }

  if (post.text) {
    const textEl = document.createElement('p');
    textEl.className = 'post-card__text';
    textEl.textContent = post.text;
    body.appendChild(textEl);
  }

  if (post.mediaURL) {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'post-card__media';
    mediaWrap.innerHTML = post.mediaType === 'video'
      ? `<video src="${post.mediaURL}" controls></video>`
      : `<img src="${post.mediaURL}" alt="Post image" loading="lazy" />`;
    body.appendChild(mediaWrap);
  }

  if (post.repostOf) {
    const original = document.createElement('div');
    original.className = 'repost-original';
    original.innerHTML = `
      <div class="repost-original__author"></div>
      <div class="repost-original__text"></div>
    `;
    original.querySelector('.repost-original__author').textContent = post.repostOfAuthorName || 'VitalStar Member';
    original.querySelector('.repost-original__text').textContent = post.repostOfText || '';
    body.appendChild(original);
  }
}

function bindPostCardEvents(card, post) {
  const menuBtn = card.querySelector('.post-card__menu-btn');
  const menu = card.querySelector('.post-card__menu');

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.post-card__menu.is-open').forEach((m) => { if (m !== menu) m.classList.remove('is-open'); });
    menu.classList.toggle('is-open');
  });
  document.addEventListener('click', () => menu.classList.remove('is-open'));

  const editBtn = card.querySelector('.edit-post-btn');
  if (editBtn) editBtn.addEventListener('click', () => startEditPost(card, post));

  const deleteBtn = card.querySelector('.delete-post-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => deletePost(card, post));

  const pinBtn = card.querySelector('.pin-post-btn');
  if (pinBtn) pinBtn.addEventListener('click', () => togglePinPost(post));

  const reportBtn = card.querySelector('.report-post-btn');
  if (reportBtn) reportBtn.addEventListener('click', () => reportPost(post));

  card.querySelector('.like-btn').addEventListener('click', () => toggleLike(card, post));
  card.querySelector('.comment-toggle-btn').addEventListener('click', () => toggleComments(card, post));
  card.querySelector('.repost-btn').addEventListener('click', () => repostPost(post));
  card.querySelector('.share-btn').addEventListener('click', () => sharePost(post));
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// EDIT / DELETE / PIN / REPORT
// ============================================================
function startEditPost(card, post) {
  const body = card.querySelector('.post-card__body');
  const textEl = body.querySelector('.post-card__text');
  const currentText = post.text || '';

  const editWrap = document.createElement('div');
  editWrap.innerHTML = `
    <textarea class="post-card__edit-textarea"></textarea>
    <div class="post-card__edit-actions">
      <button type="button" class="save-btn">Save</button>
      <button type="button" class="cancel-btn">Cancel</button>
    </div>
  `;
  editWrap.querySelector('textarea').value = currentText;

  if (textEl) textEl.replaceWith(editWrap); else body.insertBefore(editWrap, body.firstChild);

  editWrap.querySelector('.cancel-btn').addEventListener('click', () => renderPostBody(card, post));

  editWrap.querySelector('.save-btn').addEventListener('click', async () => {
    const newText = editWrap.querySelector('textarea').value.trim();
    try {
      const postRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id);
      await updateDoc(postRef, { text: newText, isEdited: true, updatedAt: serverTimestamp() });
      post.text = newText;
      post.isEdited = true;
      renderPostBody(card, post);
      card.querySelector('.post-card__meta').textContent += ' · edited';
      ctx.showToast('Post updated.', 'success');
    } catch (error) {
      console.error('Error updating post:', error);
      ctx.showToast('Could not update the post.', 'error');
    }
  });
}

async function deletePost(card, post) {
  if (!window.confirm('Delete this post? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id));
    await updateDoc(ctx.groupRef, { postCount: increment(-1) });
    ctx.refreshHeaderStats();
    card.remove();
    ctx.showToast('Post deleted.', 'info');
  } catch (error) {
    console.error('Error deleting post:', error);
    ctx.showToast('Could not delete the post.', 'error');
  }
}

async function togglePinPost(post) {
  try {
    const postRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id);
    await updateDoc(postRef, { isPinned: !post.isPinned });
    ctx.showToast(post.isPinned ? 'Post unpinned.' : 'Post pinned to the top.', 'success');
    await loadPosts(true);
  } catch (error) {
    console.error('Error pinning post:', error);
    ctx.showToast('Could not update the pin status.', 'error');
  }
}

async function reportPost(post) {
  const reason = window.prompt('Why are you reporting this post? (a short reason helps our team review it)');
  if (!reason || !reason.trim()) return;

  try {
    await addDoc(collection(ctx.db, 'reports'), {
      type: 'post',
      groupId: ctx.groupId,
      targetId: post.id,
      reporterId: ctx.currentUser.uid,
      reason: reason.trim(),
      status: 'pending',
      createdAt: serverTimestamp()
    });
    ctx.showToast('Thanks — this post has been reported to VitalStar moderators.', 'success');
  } catch (error) {
    console.error('Error reporting post:', error);
    ctx.showToast('Could not submit the report.', 'error');
  }
}

// ============================================================
// LIKES
// ============================================================
async function refreshLikeButtonState(card, postId) {
  try {
    const likeRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', postId, 'likes', ctx.currentUser.uid);
    const likeSnap = await getDoc(likeRef);
    const likeBtn = card.querySelector('.like-btn');
    if (likeSnap.exists()) {
      likeBtn.classList.add('is-liked');
      likeBtn.querySelector('i').className = 'fa-solid fa-heart';
    }
  } catch (error) {
    console.error('Error checking like state:', error);
  }
}

async function toggleLike(card, post) {
  if (!isActiveMember()) {
    ctx.showToast('Join this group to like posts.', 'info');
    return;
  }

  const likeBtn = card.querySelector('.like-btn');
  const countEl = likeBtn.querySelector('.like-count');
  const isLiked = likeBtn.classList.contains('is-liked');
  const postRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id);
  const likeRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id, 'likes', ctx.currentUser.uid);

  likeBtn.classList.toggle('is-liked');
  likeBtn.querySelector('i').className = isLiked ? 'fa-regular fa-heart' : 'fa-solid fa-heart';
  const newCount = Math.max(0, (post.likesCount || 0) + (isLiked ? -1 : 1));
  post.likesCount = newCount;
  countEl.textContent = ctx.formatCount(newCount);

  try {
    if (isLiked) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likesCount: increment(-1) });
    } else {
      await setDoc(likeRef, { uid: ctx.currentUser.uid, likedAt: serverTimestamp() });
      await updateDoc(postRef, { likesCount: increment(1) });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    ctx.showToast('Could not update your like.', 'error');
  }
}

// ============================================================
// COMMENTS + REPLIES
// ============================================================
function toggleComments(card, post) {
  const section = card.querySelector('.comments-section');
  const isOpen = section.classList.contains('is-open');

  if (isOpen) {
    section.classList.remove('is-open');
    return;
  }

  section.classList.add('is-open');
  if (section.dataset.loaded === 'false') {
    loadComments(section, post);
  }
}

async function loadComments(section, post) {
  section.dataset.loaded = 'true';
  section.innerHTML = '<div class="tab-panel-placeholder"><span class="spinner-sm"></span> Loading comments…</div>';

  try {
    const commentsQuery = query(
      collection(ctx.db, 'groups', ctx.groupId, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const snapshot = await getDocs(commentsQuery);

    section.innerHTML = '';

    if (isActiveMember()) {
      section.appendChild(buildCommentComposer(post, null, section));
    }

    const commentsListEl = document.createElement('div');
    commentsListEl.className = 'comments-list';
    section.appendChild(commentsListEl);

    snapshot.forEach((commentDoc) => {
      commentsListEl.appendChild(buildCommentItem({ id: commentDoc.id, ...commentDoc.data() }, post));
    });
  } catch (error) {
    console.error('Error loading comments:', error);
    section.innerHTML = '<div class="posts-empty"><p>Could not load comments.</p></div>';
  }
}

function buildCommentComposer(post, parentCommentId, container) {
  const wrap = document.createElement('div');
  wrap.className = parentCommentId ? 'reply-composer is-open' : 'comment-composer';
  wrap.innerHTML = `
    <input type="text" class="comment-input" placeholder="${parentCommentId ? 'Write a reply…' : 'Write a comment…'}" maxlength="1000" />
    <button type="button" class="comment-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
  `;
  const input = wrap.querySelector('.comment-input');
  const sendBtn = wrap.querySelector('.comment-send-btn');

  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;

    try {
      if (parentCommentId) {
        const repliesRef = collection(ctx.db, 'groups', ctx.groupId, 'posts', post.id, 'comments', parentCommentId, 'replies');
        await addDoc(repliesRef, {
          authorId: ctx.currentUser.uid,
          authorName: ctx.currentUser.displayName || 'VitalStar Member',
          authorPhotoURL: ctx.currentUser.photoURL || '',
          text,
          createdAt: serverTimestamp()
        });
        const repliesListEl = container;
        repliesListEl.appendChild(buildReplyItem({
          authorName: ctx.currentUser.displayName,
          authorPhotoURL: ctx.currentUser.photoURL,
          text
        }));
      } else {
        const commentsRef = collection(ctx.db, 'groups', ctx.groupId, 'posts', post.id, 'comments');
        await addDoc(commentsRef, {
          authorId: ctx.currentUser.uid,
          authorName: ctx.currentUser.displayName || 'VitalStar Member',
          authorPhotoURL: ctx.currentUser.photoURL || '',
          text,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id), { commentsCount: increment(1) });

        const card = document.querySelector(`.post-card[data-post-id="${post.id}"]`);
        if (card) {
          post.commentsCount = (post.commentsCount || 0) + 1;
          card.querySelector('.comment-count').textContent = ctx.formatCount(post.commentsCount);
        }

        const commentsListEl = wrap.parentElement.querySelector('.comments-list');
        if (commentsListEl) {
          commentsListEl.appendChild(buildCommentItem({
            authorId: ctx.currentUser.uid,
            authorName: ctx.currentUser.displayName,
            authorPhotoURL: ctx.currentUser.photoURL,
            text
          }, post));
        }
      }
      input.value = '';
    } catch (error) {
      console.error('Error posting comment:', error);
      ctx.showToast('Could not post your comment.', 'error');
    } finally {
      sendBtn.disabled = false;
    }
  };

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  return wrap;
}

function buildCommentItem(comment, post) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = `
    <div class="comment-avatar"></div>
    <div style="flex:1; min-width:0;">
      <div class="comment-bubble">
        <div class="comment-author"></div>
        <div class="comment-text"></div>
      </div>
      <div class="comment-footer">
        ${isActiveMember() ? '<button type="button" class="comment-reply-btn">Reply</button>' : ''}
      </div>
      <div class="replies-list"></div>
    </div>
  `;

  ctx.applyMediaBackground(item.querySelector('.comment-avatar'), comment.authorPhotoURL, ctx.initialsFrom(comment.authorName));
  item.querySelector('.comment-author').textContent = comment.authorName || 'VitalStar Member';
  item.querySelector('.comment-text').textContent = comment.text;

  const replyBtn = item.querySelector('.comment-reply-btn');
  const repliesList = item.querySelector('.replies-list');

  if (replyBtn && comment.id) {
    let replyComposerOpen = false;
    replyBtn.addEventListener('click', () => {
      if (replyComposerOpen) return;
      replyComposerOpen = true;
      const composer = buildCommentComposer(post, comment.id, repliesList);
      item.querySelector('div[style]').appendChild(composer);
      loadReplies(comment.id, post, repliesList);
    });
  }

  return item;
}

async function loadReplies(commentId, post, repliesListEl) {
  try {
    const repliesQuery = query(
      collection(ctx.db, 'groups', ctx.groupId, 'posts', post.id, 'comments', commentId, 'replies'),
      orderBy('createdAt', 'asc'),
      limit(30)
    );
    const snapshot = await getDocs(repliesQuery);
    snapshot.forEach((replyDoc) => {
      repliesListEl.appendChild(buildReplyItem(replyDoc.data()));
    });
  } catch (error) {
    console.error('Error loading replies:', error);
  }
}

function buildReplyItem(reply) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = `
    <div class="comment-avatar" style="width:26px;height:26px;"></div>
    <div class="comment-bubble" style="flex:1;">
      <div class="comment-author"></div>
      <div class="comment-text"></div>
    </div>
  `;
  ctx.applyMediaBackground(item.querySelector('.comment-avatar'), reply.authorPhotoURL, ctx.initialsFrom(reply.authorName));
  item.querySelector('.comment-author').textContent = reply.authorName || 'VitalStar Member';
  item.querySelector('.comment-text').textContent = reply.text;
  return item;
}

// ============================================================
// REPOST + SHARE
// ============================================================
async function repostPost(post) {
  if (!isActiveMember()) {
    ctx.showToast('Join this group to repost.', 'info');
    return;
  }
  if (post.repostOf) {
    ctx.showToast('You can only repost original posts.', 'info');
    return;
  }
  if (!window.confirm('Repost this to the group feed?')) return;

  try {
    const postsRef = collection(ctx.db, 'groups', ctx.groupId, 'posts');
    await addDoc(postsRef, {
      authorId: ctx.currentUser.uid,
      authorName: ctx.currentUser.displayName || 'VitalStar Member',
      authorPhotoURL: ctx.currentUser.photoURL || '',
      authorRole: currentUserRole() || 'member',
      text: '',
      mediaURL: post.mediaURL || '',
      mediaType: post.mediaType || 'none',
      isPinned: false,
      isEdited: false,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      repostsCount: 0,
      repostOf: post.id,
      repostOfAuthorName: post.authorName || 'VitalStar Member',
      repostOfText: post.text || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id), { repostsCount: increment(1) });
    await updateDoc(ctx.groupRef, { postCount: increment(1) });
    ctx.refreshHeaderStats();

    ctx.showToast('Reposted to the group feed.', 'success');
    await loadPosts(true);
  } catch (error) {
    console.error('Error reposting:', error);
    ctx.showToast('Could not repost.', 'error');
  }
}

async function sharePost(post) {
  const url = `${window.location.origin}${window.location.pathname}?id=${ctx.groupId}&post=${post.id}`;
  try {
    const postRef = doc(ctx.db, 'groups', ctx.groupId, 'posts', post.id);
    await updateDoc(postRef, { sharesCount: increment(1) });

    if (navigator.share) {
      await navigator.share({ title: 'A post on VitalStar', url });
    } else {
      await navigator.clipboard.writeText(url);
      ctx.showToast('Link copied to clipboard.', 'success');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error sharing post:', error);
    }
  }
}
