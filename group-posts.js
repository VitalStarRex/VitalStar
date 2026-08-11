// ============================================================
// VITALSTAR — group-posts.js
// Complete Group Posts system
//
// Handles:
// - Text posts
// - Image uploads via Cloudinary
// - Video uploads via Cloudinary
// - HTML5 video playback
// - Real author full name
// - Real author profile picture
// - Author profile links
// - Likes
// - Comments
// - One-level replies
// - Edit / delete
// - Pin / unpin
// - Report
// - Repost
// - Share
// - Pagination
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
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


// ============================================================
// CLOUDINARY
// ============================================================

const CLOUDINARY_CLOUD_NAME = 'm0scmqqv';
const CLOUDINARY_UPLOAD_PRESET = 'vitalstar_upload';


// ============================================================
// CONSTANTS
// ============================================================

const POSTS_PAGE_SIZE = 10;
const POSTS_STYLE_ID = 'vs-group-posts-styles';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 60 * 1024 * 1024;


// ============================================================
// GLOBAL STATE
// ============================================================

let ctx = null;
let state = null;


// ============================================================
// AUTHOR PROFILE CACHE
//
// The post document may contain old data such as:
// authorName: "VitalStar User"
//
// We therefore load the real profile from:
//
// users/{uid}
//
// and use:
// - fullName
// - photoURL
//
// with several fallback field names for compatibility.
// ============================================================

const authorCache = new Map();

async function getAuthorProfile(uid, fallback = {}) {
  if (!uid) {
    return {
      fullName:
        fallback.fullName ||
        fallback.fullname ||
        fallback.authorName ||
        fallback.displayName ||
        'VitalStar Member',

      photoURL:
        fallback.photoURL ||
        fallback.profilePictureURL ||
        fallback.profilePicture ||
        fallback.avatarURL ||
        fallback.authorPhotoURL ||
        ''
    };
  }

  if (authorCache.has(uid)) {
    return authorCache.get(uid);
  }

  try {
    const userRef = doc(ctx.db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();

      const profile = {
        fullName:
          data.fullName ||
          data.fullname ||
          data.displayName ||
          data.name ||
          fallback.fullName ||
          fallback.fullname ||
          fallback.authorName ||
          fallback.displayName ||
          'VitalStar Member',

        photoURL:
          data.photoURL ||
          data.profilePhotoURL ||
          data.profilePictureURL ||
          data.profilePicture ||
          data.avatarURL ||
          data.avatar ||
          data.photo ||
          fallback.photoURL ||
          fallback.profilePictureURL ||
          fallback.profilePicture ||
          fallback.authorPhotoURL ||
          ''
      };

      authorCache.set(uid, profile);

      return profile;
    }
  } catch (error) {
    console.warn(
      '[Group Posts] Could not load user profile:',
      uid,
      error
    );
  }

  const fallbackProfile = {
    fullName:
      fallback.fullName ||
      fallback.fullname ||
      fallback.authorName ||
      fallback.displayName ||
      'VitalStar Member',

    photoURL:
      fallback.photoURL ||
      fallback.profilePictureURL ||
      fallback.profilePicture ||
      fallback.avatarURL ||
      fallback.authorPhotoURL ||
      ''
  };

  authorCache.set(uid, fallbackProfile);

  return fallbackProfile;
}


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

function uploadToCloudinary(file, resourceType, onProgress) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file was selected.'));
      return;
    }

    const type =
      resourceType === 'video'
        ? 'video'
        : 'image';

    const endpoint =
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`;

    const formData = new FormData();

    formData.append('file', file);
    formData.append(
      'upload_preset',
      CLOUDINARY_UPLOAD_PRESET
    );

    const xhr = new XMLHttpRequest();

    xhr.open('POST', endpoint, true);

    // 3 minutes.
    // Videos can take longer than images on mobile connections.
    xhr.timeout = 180000;

    xhr.upload.addEventListener('progress', (event) => {
      if (
        event.lengthComputable &&
        typeof onProgress === 'function'
      ) {
        const percent = Math.round(
          (event.loaded / event.total) * 100
        );

        onProgress(percent);
      }
    });

    xhr.onload = () => {
      let response = null;

      try {
        response = JSON.parse(xhr.responseText);
      } catch (error) {
        console.error(
          '[Cloudinary] Invalid JSON response:',
          xhr.responseText
        );

        reject(
          new Error(
            'Cloudinary returned an invalid response.'
          )
        );

        return;
      }

      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        response.secure_url
      ) {
        resolve({
          url: response.secure_url,
          resourceType:
            response.resource_type || type,
          publicId:
            response.public_id || ''
        });

        return;
      }

      console.error(
        '[Cloudinary] Upload rejected:',
        response
      );

      const cloudinaryMessage =
        response?.error?.message ||
        `Cloudinary upload failed (${xhr.status}).`;

      reject(
        new Error(cloudinaryMessage)
      );
    };

    xhr.onerror = () => {
      console.error(
        '[Cloudinary] Network error.',
        {
          status: xhr.status,
          readyState: xhr.readyState,
          online: navigator.onLine,
          fileName: file.name,
          fileType: file.type,
          fileSizeMB:
            (file.size / 1024 / 1024).toFixed(2)
        }
      );

      reject(
        new Error(
          'Could not connect to Cloudinary. Check your internet connection and try again.'
        )
      );
    };

    xhr.ontimeout = () => {
      console.error(
        '[Cloudinary] Upload timed out.'
      );

      reject(
        new Error(
          'The upload took too long. Try a smaller file or a stronger internet connection.'
        )
      );
    };

    try {
      xhr.send(formData);
    } catch (error) {
      console.error(
        '[Cloudinary] Could not send upload:',
        error
      );

      reject(
        new Error(
          'Could not start the Cloudinary upload.'
        )
      );
    }
  });
}


// ============================================================
// STYLES
// ============================================================

function injectStyles() {
  if (document.getElementById(POSTS_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');

  style.id = POSTS_STYLE_ID;

  style.textContent = `
    /* ========================================================
       COMPOSER
       ======================================================== */

    .composer {
      border-radius: var(--radius-lg);
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.08);
      padding: 16px 18px;
      margin-bottom: 20px;
    }

    .composer__top {
      display: flex;
      gap: 12px;
    }

    .composer__avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      flex-shrink: 0;
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        )
        center/cover;
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      color: #fff;
      font-size: 15px;
      overflow: hidden;
    }

    .composer__input {
      flex: 1;
      min-height: 42px;
      max-height: 220px;
      resize: none;
      background: #f5f6f8;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--radius-sm);
      padding: 11px 14px;
      color: #1a1d29;
      font-family: var(--font-body);
      font-size: 14px;
      outline: none;
      transition:
        border-color 0.2s var(--ease-out);
    }

    .composer__input:focus {
      border-color: var(--electric-blue);
    }

    .composer__input::placeholder {
      color: #9aa0ac;
    }

    .composer__media-preview {
      margin-top: 12px;
      position: relative;
      display: none;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: #000;
    }

    .composer__media-preview.is-visible {
      display: block;
    }

    .composer__media-preview img,
    .composer__media-preview video {
      width: 100%;
      max-height: 360px;
      object-fit: contain;
      display: block;
      background: #000;
    }

    .composer__media-remove {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 5;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(8,11,20,0.75);
      border: none;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .composer__bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
      gap: 10px;
    }

    .composer__tools {
      display: flex;
      gap: 6px;
    }

    .composer__tool-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #f5f6f8;
      border: 1px solid rgba(0,0,0,0.1);
      color: #5a6070;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .composer__tool-btn:hover {
      color: var(--electric-blue-bright);
      border-color: var(--electric-blue);
    }

    .composer__post-btn {
      padding: 9px 20px;
      border-radius: var(--radius-full);
      border: none;
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        );
      color: #fff;
      font-weight: 600;
      font-size: 13.5px;
      box-shadow: var(--shadow-glow-blue);
      transition: opacity 0.2s;
      cursor: pointer;
    }

    .composer__post-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .composer-join-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-radius: var(--radius-lg);
      background: rgba(47,111,255,0.07);
      border: 1px solid rgba(47,111,255,0.18);
      color: #4a5568;
      font-size: 13px;
      margin-bottom: 20px;
    }

    .composer-join-notice i {
      color: var(--electric-blue-bright);
    }


    /* ========================================================
       POSTS
       ======================================================== */

    .post-card {
      border-radius: var(--radius-lg);
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.08);
      padding: 16px 18px;
      margin-bottom: 16px;
      animation: rise-in 0.35s var(--ease-out);
    }

    .post-card.is-pinned {
      border-color: rgba(255,194,75,0.45);
    }

    .post-card__pin-flag {
      display: none;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: var(--gold-accent);
      font-weight: 600;
      margin-bottom: 10px;
    }

    .post-card.is-pinned
    .post-card__pin-flag {
      display: flex;
    }

    .post-card__head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .post-card__author {
      display: flex;
      gap: 10px;
      min-width: 0;
    }

    .post-card__avatar {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      flex-shrink: 0;
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        )
        center/cover;
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      color: #fff;
      font-size: 15px;
      overflow: hidden;
    }

    .post-card__author-info {
      min-width: 0;
    }

    .post-card__author-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    /* AUTHOR FULL NAME = YELLOW */
    .post-card__author-name {
      font-weight: 700;
      font-size: 13.5px;
      color: #f2c94c;
    }

    .post-card__author-name:hover {
      color: #ffd95a;
      text-decoration: underline;
    }

    .role-chip {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: var(--radius-full);
      background: rgba(139,92,255,0.12);
      color: var(--violet-accent);
      text-transform: capitalize;
    }

    .post-card__meta {
      font-size: 11.5px;
      color: #8a90a0;
      margin-top: 1px;
    }


    /* ========================================================
       PROFILE LINKS
       ======================================================== */

    .post-author-link {
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }

    a.post-card__avatar {
      display: flex;
    }

    a.post-card__author-name,
    a.comment-author {
      display: inline-block;
    }

    a.post-card__avatar:hover,
    a.comment-avatar:hover {
      opacity: 0.85;
    }


    /* ========================================================
       POST MENU
       ======================================================== */

    .post-card__menu-wrap {
      position: relative;
    }

    .post-card__menu-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: none;
      color: #8a90a0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .post-card__menu-btn:hover {
      background: rgba(0,0,0,0.05);
      color: #1a1d29;
    }

    .post-card__menu {
      display: none;
      position: absolute;
      top: 38px;
      right: 0;
      z-index: 10;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--radius-md);
      box-shadow:
        0 6px 20px rgba(0,0,0,0.12);
      overflow: hidden;
      min-width: 160px;
    }

    .post-card__menu.is-open {
      display: block;
    }

    .post-card__menu button {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      padding: 10px 14px;
      background: none;
      border: none;
      color: #4a5568;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }

    .post-card__menu button:hover {
      background: rgba(0,0,0,0.04);
      color: #1a1d29;
    }

    .post-card__menu button.is-danger:hover {
      color: var(--danger);
    }


    /* ========================================================
       POST BODY
       ======================================================== */

    .post-card__text {
      font-size: 14px;
      color: #1a1d29;
      line-height: 1.6;
      margin: 12px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .post-card__edit-textarea {
      width: 100%;
      margin-top: 12px;
      min-height: 70px;
      resize: vertical;
      background: #f5f6f8;
      border: 1px solid var(--electric-blue);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      color: #1a1d29;
      font-size: 14px;
      font-family: var(--font-body);
    }

    .post-card__edit-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .post-card__edit-actions button {
      padding: 7px 14px;
      border-radius: var(--radius-full);
      font-size: 12.5px;
      font-weight: 600;
      border: 1px solid rgba(0,0,0,0.1);
      background: #f5f6f8;
      color: #1a1d29;
      cursor: pointer;
    }

    .post-card__edit-actions .save-btn {
      background: var(--electric-blue);
      border: none;
      color: #fff;
    }


    /* ========================================================
       POST MEDIA
       ======================================================== */

    .post-card__media {
      margin-top: 12px;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: #000;
      width: 100%;
    }

    .post-card__media img {
      width: 100%;
      max-height: 500px;
      object-fit: contain;
      display: block;
      background: #000;
    }

    .post-card__media video {
      width: 100%;
      max-height: 520px;
      display: block;
      background: #000;
      object-fit: contain;
    }

    .post-video-error {
      padding: 20px;
      text-align: center;
      color: #ffffff;
      background: #111111;
      font-size: 13px;
    }


    /* ========================================================
       REPOST
       ======================================================== */

    .repost-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #8a90a0;
      margin-bottom: 10px;
    }

    .repost-banner i {
      color: var(--electric-blue-bright);
    }

    .repost-original {
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: var(--radius-md);
      padding: 12px 14px;
      margin-top: 10px;
      background: #f7f8fa;
    }

    .repost-original__author {
      font-size: 12.5px;
      font-weight: 600;
      color: #1a1d29;
    }

    .repost-original__text {
      font-size: 13px;
      color: #4a5568;
      margin-top: 4px;
      line-height: 1.5;
    }


    /* ========================================================
       ACTIONS
       ======================================================== */

    .post-card__actions {
      display: flex;
      gap: 6px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(0,0,0,0.08);
    }

    .post-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 9px;
      border-radius: var(--radius-sm);
      border: none;
      background: none;
      color: #6a7080;
      font-size: 12.5px;
      font-weight: 600;
      transition: all 0.2s var(--ease-out);
      cursor: pointer;
    }

    .post-action-btn:hover {
      background: rgba(0,0,0,0.04);
      color: #1a1d29;
    }

    .post-action-btn.is-liked {
      color: var(--danger);
    }

    .post-action-btn.is-liked i {
      font-weight: 900;
    }


    /* ========================================================
       COMMENTS
       ======================================================== */

    .comments-section {
      display: none;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(0,0,0,0.08);
    }

    .comments-section.is-open {
      display: block;
    }

    .comment-composer {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .comment-input {
      flex: 1;
      background: #f5f6f8;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--radius-full);
      padding: 9px 15px;
      color: #1a1d29;
      font-size: 13px;
      outline: none;
    }

    .comment-input:focus {
      border-color: var(--electric-blue);
    }

    .comment-input::placeholder {
      color: #9aa0ac;
    }

    .comment-send-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: var(--electric-blue);
      color: #fff;
      flex-shrink: 0;
      cursor: pointer;
    }

    .comment-item {
      display: flex;
      gap: 9px;
      margin-bottom: 12px;
    }

    .comment-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      flex-shrink: 0;
      background:
        linear-gradient(
          135deg,
          var(--electric-blue),
          var(--violet-accent)
        )
        center/cover;
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 11.5px;
      color: #fff;
      overflow: hidden;
    }

    .comment-bubble {
      background: #f5f6f8;
      border-radius: var(--radius-md);
      padding: 8px 12px;
      flex: 1;
    }

    .comment-author {
      font-size: 12.5px;
      font-weight: 600;
      color: #f2c94c;
    }

    .comment-author:hover {
      color: #ffd95a;
      text-decoration: underline;
    }

    .comment-text {
      font-size: 13px;
      color: #4a5568;
      margin-top: 2px;
      line-height: 1.45;
      word-break: break-word;
    }

    .comment-footer {
      display: flex;
      gap: 12px;
      margin-top: 5px;
    }

    .comment-reply-btn {
      font-size: 11.5px;
      color: #8a90a0;
      background: none;
      border: none;
      font-weight: 600;
      cursor: pointer;
    }

    .comment-reply-btn:hover {
      color: var(--electric-blue-bright);
    }

    .replies-list {
      margin-top: 8px;
      margin-left: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .reply-composer {
      display: none;
      gap: 8px;
      margin-top: 8px;
      margin-left: 16px;
    }

    .reply-composer.is-open {
      display: flex;
    }


    /* ========================================================
       LOAD MORE / EMPTY
       ======================================================== */

    .load-more-posts-btn {
      display: block;
      width: 100%;
      margin-top: 6px;
      padding: 11px;
      border-radius: var(--radius-md);
      background: #f5f6f8;
      border: 1px solid rgba(0,0,0,0.1);
      color: #1a1d29;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .load-more-posts-btn:hover {
      border-color: var(--electric-blue);
      color: var(--electric-blue-bright);
    }

    .posts-empty {
      text-align: center;
      padding: 50px 20px;
      color: #8a90a0;
    }

    .posts-empty i {
      font-size: 30px;
      color: var(--electric-blue-bright);
      opacity: 0.7;
      margin-bottom: 12px;
      display: block;
    }
  `;

  document.head.appendChild(style);
}


// ============================================================
// INIT
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

  loadMoreBtn.className =
    'load-more-posts-btn';

  loadMoreBtn.id =
    'loadMorePostsBtn';

  loadMoreBtn.textContent =
    'Load more posts';

  loadMoreBtn.style.display =
    'none';

  loadMoreBtn.addEventListener(
    'click',
    () => loadPosts(false)
  );

  ctx.panelEl.appendChild(loadMoreBtn);

  await loadPosts(true);
}


// ============================================================
// GROUP MEMBERSHIP
// ============================================================

function isActiveMember() {
  return (
    ctx.membership &&
    ctx.membership.status === 'active'
  );
}

function currentUserRole() {
  return ctx.membership
    ? ctx.membership.role
    : null;
}

function canModeratePosts() {
  const role = currentUserRole();

  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'moderator'
  );
}


// ============================================================
// PROFILE LINK
// ============================================================

function authorProfileHref(uid) {
  return uid
    ? `profile.html?uid=${encodeURIComponent(uid)}`
    : '#';
}


// ============================================================
// COMPOSER
// ============================================================

function renderComposer() {
  if (!isActiveMember()) {
    const notice = document.createElement('div');

    notice.className =
      'composer-join-notice';

    notice.innerHTML = `
      <i class="fa-solid fa-circle-info"></i>
      <span>
        Join this group to post, like, and comment.
      </span>
    `;

    ctx.panelEl.appendChild(notice);

    return;
  }

  const wrap = document.createElement('div');

  wrap.className = 'composer';

  wrap.innerHTML = `
    <div class="composer__top">

      <a
        class="post-author-link composer__avatar"
        id="composerAvatar"
        href="${authorProfileHref(ctx.currentUser.uid)}"
      ></a>

      <textarea
        class="composer__input"
        id="composerInput"
        placeholder="Share something with the group…"
        maxlength="3000"
        rows="1"
      ></textarea>

    </div>

    <div
      class="composer__media-preview"
      id="composerMediaPreview"
    ></div>

    <div class="composer__bottom">

      <div class="composer__tools">

        <button
          type="button"
          class="composer__tool-btn"
          id="composerImageBtn"
          title="Add photo"
        >
          <i class="fa-solid fa-image"></i>
        </button>

        <button
          type="button"
          class="composer__tool-btn"
          id="composerVideoBtn"
          title="Add video"
        >
          <i class="fa-solid fa-video"></i>
        </button>

        <input
          type="file"
          id="composerImageInput"
          accept="image/*"
          style="display:none;"
        />

        <input
          type="file"
          id="composerVideoInput"
          accept="video/*"
          style="display:none;"
        />

      </div>

      <button
        type="button"
        class="composer__post-btn"
        id="composerPostBtn"
        disabled
      >
        Post
      </button>

    </div>
  `;

  ctx.panelEl.insertBefore(
    wrap,
    ctx.panelEl.firstChild
  );


  // ==========================================================
  // CURRENT USER AVATAR
  // ==========================================================

  const avatarEl =
    wrap.querySelector('#composerAvatar');

  ctx.applyMediaBackground(
    avatarEl,
    ctx.currentUser.photoURL || '',
    ctx.initialsFrom(
      ctx.currentUser.displayName ||
      'User'
    )
  );


  // ==========================================================
  // INPUT
  // ==========================================================

  const input =
    wrap.querySelector('#composerInput');

  const postBtn =
    wrap.querySelector('#composerPostBtn');

  input.addEventListener(
    'input',
    () => {
      input.style.height = 'auto';

      input.style.height =
        `${Math.min(input.scrollHeight, 220)}px`;

      postBtn.disabled =
        input.value.trim().length === 0 &&
        !state.pendingMediaFile;
    }
  );


  // ==========================================================
  // MEDIA BUTTONS
  // ==========================================================

  wrap
    .querySelector('#composerImageBtn')
    .addEventListener(
      'click',
      () => {
        wrap
          .querySelector('#composerImageInput')
          .click();
      }
    );

  wrap
    .querySelector('#composerVideoBtn')
    .addEventListener(
      'click',
      () => {
        wrap
          .querySelector('#composerVideoInput')
          .click();
      }
    );


  // ==========================================================
  // FILE INPUTS
  // ==========================================================

  wrap
    .querySelector('#composerImageInput')
    .addEventListener(
      'change',
      (event) =>
        handleComposerMediaSelect(
          event,
          'image'
        )
    );

  wrap
    .querySelector('#composerVideoInput')
    .addEventListener(
      'change',
      (event) =>
        handleComposerMediaSelect(
          event,
          'video'
        )
    );


  // ==========================================================
  // POST
  // ==========================================================

  postBtn.addEventListener(
    'click',
    () => submitPost(wrap)
  );
}


// ============================================================
// MEDIA SELECTION
// ============================================================

function handleComposerMediaSelect(event, type) {
  const file =
    event.target.files &&
    event.target.files[0];

  if (!file) {
    return;
  }


  // ----------------------------------------------------------
  // TYPE VALIDATION
  // ----------------------------------------------------------

  if (
    type === 'image' &&
    !file.type.startsWith('image/')
  ) {
    ctx.showToast(
      'Please select a valid image.',
      'error'
    );

    event.target.value = '';

    return;
  }

  if (
    type === 'video' &&
    !file.type.startsWith('video/')
  ) {
    ctx.showToast(
      'Please select a valid video.',
      'error'
    );

    event.target.value = '';

    return;
  }


  // ----------------------------------------------------------
  // SIZE VALIDATION
  // ----------------------------------------------------------

  const maxSize =
    type === 'video'
      ? MAX_VIDEO_SIZE
      : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    ctx.showToast(
      type === 'video'
        ? 'Video is too large. Maximum size is 60MB.'
        : 'Image is too large. Maximum size is 8MB.',
      'error'
    );

    event.target.value = '';

    return;
  }


  // ----------------------------------------------------------
  // STORE FILE
  // ----------------------------------------------------------

  state.pendingMediaFile = file;
  state.pendingMediaType = type;


  // ----------------------------------------------------------
  // PREVIEW
  // ----------------------------------------------------------

  const preview =
    document.getElementById(
      'composerMediaPreview'
    );

  if (!preview) {
    return;
  }

  preview.innerHTML = '';

  const objectUrl =
    URL.createObjectURL(file);


  if (type === 'image') {
    const image =
      document.createElement('img');

    image.src = objectUrl;
    image.alt = 'Selected image';

    preview.appendChild(image);
  } else {
    const video =
      document.createElement('video');

    video.src = objectUrl;

    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';

    preview.appendChild(video);
  }


  // ----------------------------------------------------------
  // REMOVE BUTTON
  // ----------------------------------------------------------

  const removeBtn =
    document.createElement('button');

  removeBtn.type = 'button';

  removeBtn.className =
    'composer__media-remove';

  removeBtn.innerHTML =
    '<i class="fa-solid fa-xmark"></i>';

  removeBtn.addEventListener(
    'click',
    () => {
      URL.revokeObjectURL(objectUrl);

      state.pendingMediaFile = null;
      state.pendingMediaType = null;

      preview.innerHTML = '';

      preview.classList.remove(
        'is-visible'
      );

      const imageInput =
        document.getElementById(
          'composerImageInput'
        );

      const videoInput =
        document.getElementById(
          'composerVideoInput'
        );

      if (imageInput) {
        imageInput.value = '';
      }

      if (videoInput) {
        videoInput.value = '';
      }

      updatePostButtonState();
    }
  );

  preview.appendChild(removeBtn);

  preview.classList.add(
    'is-visible'
  );

  updatePostButtonState();
}


// ============================================================
// POST BUTTON STATE
// ============================================================

function updatePostButtonState() {
  const input =
    document.getElementById(
      'composerInput'
    );

  const postBtn =
    document.getElementById(
      'composerPostBtn'
    );

  if (!input || !postBtn) {
    return;
  }

  postBtn.disabled =
    input.value.trim().length === 0 &&
    !state.pendingMediaFile;
}


// ============================================================
// SUBMIT POST
// ============================================================

async function submitPost(composerEl) {
  const input =
    composerEl.querySelector(
      '#composerInput'
    );

  const postBtn =
    composerEl.querySelector(
      '#composerPostBtn'
    );

  const text =
    input.value.trim();

  if (
    !text &&
    !state.pendingMediaFile
  ) {
    return;
  }

  postBtn.disabled = true;
  postBtn.textContent = 'Posting…';


  try {
    // --------------------------------------------------------
    // GET REAL AUTHOR PROFILE
    // --------------------------------------------------------

    const author =
      await getAuthorProfile(
        ctx.currentUser.uid,
        {
          fullName:
            ctx.currentUser.displayName,

          photoURL:
            ctx.currentUser.photoURL
        }
      );


    // --------------------------------------------------------
    // MEDIA
    // --------------------------------------------------------

    let mediaURL = '';
    let mediaType = 'none';

    if (state.pendingMediaFile) {
      postBtn.textContent =
        'Uploading…';

      const uploadResult =
        await uploadToCloudinary(
          state.pendingMediaFile,
          state.pendingMediaType,
          (percent) => {
            postBtn.textContent =
              `Uploading ${percent}%`;
          }
        );

      mediaURL =
        uploadResult.url;

      mediaType =
        state.pendingMediaType;
    }


    // --------------------------------------------------------
    // CREATE FIRESTORE POST
    // --------------------------------------------------------

    const postsRef =
      collection(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts'
      );

    await addDoc(
      postsRef,
      {
        authorId:
          ctx.currentUser.uid,

        authorName:
          author.fullName,

        authorPhotoURL:
          author.photoURL,

        authorRole:
          currentUserRole() || 'member',

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

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );


    // --------------------------------------------------------
    // GROUP POST COUNT
    // --------------------------------------------------------

    await updateDoc(
      ctx.groupRef,
      {
        postCount:
          increment(1)
      }
    );

    ctx.refreshHeaderStats();


    // --------------------------------------------------------
    // RESET COMPOSER
    // --------------------------------------------------------

    input.value = '';
    input.style.height = 'auto';

    state.pendingMediaFile = null;
    state.pendingMediaType = null;

    const preview =
      document.getElementById(
        'composerMediaPreview'
      );

    if (preview) {
      preview.innerHTML = '';

      preview.classList.remove(
        'is-visible'
      );
    }

    const imageInput =
      document.getElementById(
        'composerImageInput'
      );

    const videoInput =
      document.getElementById(
        'composerVideoInput'
      );

    if (imageInput) {
      imageInput.value = '';
    }

    if (videoInput) {
      videoInput.value = '';
    }


    ctx.showToast(
      'Posted!',
      'success'
    );


    // --------------------------------------------------------
    // REFRESH FEED
    // --------------------------------------------------------

    await loadPosts(true);

  } catch (error) {
    console.error(
      '[Group Posts] Error creating post:',
      error
    );

    ctx.showToast(
      error.message ||
      'Could not publish your post. Please try again.',
      'error'
    );

  } finally {
    postBtn.disabled = false;
    postBtn.textContent = 'Post';

    updatePostButtonState();
  }
}


// ============================================================
// FEED LOADING
// ============================================================

async function loadPosts(reset) {
  if (state.isLoadingMore) {
    return;
  }

  state.isLoadingMore = true;

  const feedList =
    document.getElementById(
      'postsFeedList'
    );

  const loadMoreBtn =
    document.getElementById(
      'loadMorePostsBtn'
    );

  if (!feedList) {
    state.isLoadingMore = false;
    return;
  }

  if (reset) {
    state.lastVisibleDoc = null;

    feedList.innerHTML = `
      <div class="tab-panel-placeholder">
        <span class="spinner-sm"></span>
        Loading posts…
      </div>
    `;
  }


  try {
    const constraints = [
      orderBy(
        'isPinned',
        'desc'
      ),

      orderBy(
        'createdAt',
        'desc'
      ),

      limit(
        POSTS_PAGE_SIZE
      )
    ];

    if (
      !reset &&
      state.lastVisibleDoc
    ) {
      constraints.push(
        startAfter(
          state.lastVisibleDoc
        )
      );
    }

    const postsQuery =
      query(
        collection(
          ctx.db,
          'groups',
          ctx.groupId,
          'posts'
        ),
        ...constraints
      );

    const snapshot =
      await getDocs(
        postsQuery
      );

    if (reset) {
      feedList.innerHTML = '';
    }


    state.lastVisibleDoc =
      snapshot.docs.length > 0
        ? snapshot.docs[
            snapshot.docs.length - 1
          ]
        : state.lastVisibleDoc;

    state.hasMore =
      snapshot.docs.length ===
      POSTS_PAGE_SIZE;


    if (
      snapshot.empty &&
      reset
    ) {
      feedList.innerHTML = `
        <div class="posts-empty">
          <i class="fa-solid fa-note-sticky"></i>
          <p>
            No posts yet. Be the first to share something!
          </p>
        </div>
      `;
    } else {

      // ------------------------------------------------------
      // Load author profiles before rendering posts.
      // ------------------------------------------------------

      const posts =
        await Promise.all(
          snapshot.docs.map(
            async (postDoc) => {
              const post = {
                id:
                  postDoc.id,

                ...postDoc.data()
              };

              const author =
                await getAuthorProfile(
                  post.authorId,
                  {
                    authorName:
                      post.authorName,

                    authorPhotoURL:
                      post.authorPhotoURL
                  }
                );

              post.authorName =
                author.fullName;

              post.authorPhotoURL =
                author.photoURL;

              return post;
            }
          )
        );


      posts.forEach(
        (post) => {
          feedList.appendChild(
            renderPostCard(post)
          );
        }
      );
    }


    if (loadMoreBtn) {
      loadMoreBtn.style.display =
        state.hasMore
          ? 'block'
          : 'none';
    }

  } catch (error) {
    console.error(
      '[Group Posts] Error loading posts:',
      error
    );

    if (reset) {
      feedList.innerHTML = `
        <div class="posts-empty">
          <p>
            Could not load posts right now.
          </p>
        </div>
      `;
    }

    ctx.showToast(
      'Could not load posts.',
      'error'
    );

  } finally {
    state.isLoadingMore = false;
  }
}


// ============================================================
// POST CARD
// ============================================================

function renderPostCard(post) {
  const card =
    document.createElement('div');

  card.className =
    `post-card${post.isPinned ? ' is-pinned' : ''}`;

  card.dataset.postId =
    post.id;

  const isAuthor =
    post.authorId ===
    ctx.currentUser.uid;

  const canModerate =
    canModeratePosts();

  const timeLabel =
    post.createdAt &&
    post.createdAt.toDate
      ? timeAgo(
          post.createdAt.toDate()
        )
      : 'just now';

  const profileHref =
    authorProfileHref(
      post.authorId
    );


  card.innerHTML = `
    <div class="post-card__pin-flag">
      <i class="fa-solid fa-thumbtack"></i>
      Pinned post
    </div>

    <div class="post-card__head">

      <div class="post-card__author">

        <a
          class="post-author-link post-card__avatar"
          href="${profileHref}"
        ></a>

        <div class="post-card__author-info">

          <div class="post-card__author-name-row">

            <a
              class="post-author-link post-card__author-name"
              href="${profileHref}"
            ></a>

            ${
              post.authorRole &&
              post.authorRole !== 'member'
                ? `
                  <span class="role-chip">
                    ${escapeHtml(
                      post.authorRole
                    )}
                  </span>
                `
                : ''
            }

          </div>

          <div class="post-card__meta">
            ${timeLabel}
            ${post.isEdited ? ' · edited' : ''}
          </div>

        </div>

      </div>


      <div class="post-card__menu-wrap">

        <button
          type="button"
          class="post-card__menu-btn"
          aria-label="Post menu"
        >
          <i class="fa-solid fa-ellipsis"></i>
        </button>

        <div class="post-card__menu">

          ${
            isAuthor
              ? `
                <button
                  type="button"
                  class="edit-post-btn"
                >
                  <i class="fa-solid fa-pen"></i>
                  Edit
                </button>
              `
              : ''
          }

          ${
            isAuthor || canModerate
              ? `
                <button
                  type="button"
                  class="delete-post-btn is-danger"
                >
                  <i class="fa-solid fa-trash"></i>
                  Delete
                </button>
              `
              : ''
          }

          ${
            canModerate
              ? `
                <button
                  type="button"
                  class="pin-post-btn"
                >
                  <i class="fa-solid fa-thumbtack"></i>
                  ${post.isPinned ? 'Unpin' : 'Pin'} post
                </button>
              `
              : ''
          }

          ${
            !isAuthor
              ? `
                <button
                  type="button"
                  class="report-post-btn"
                >
                  <i class="fa-solid fa-flag"></i>
                  Report
                </button>
              `
              : ''
          }

        </div>

      </div>

    </div>


    <div class="post-card__body"></div>


    <div class="post-card__actions">

      <button
        type="button"
        class="post-action-btn like-btn"
      >
        <i class="fa-regular fa-heart"></i>
        <span class="like-count">
          ${ctx.formatCount(
            post.likesCount || 0
          )}
        </span>
      </button>

      <button
        type="button"
        class="post-action-btn comment-toggle-btn"
      >
        <i class="fa-regular fa-comment"></i>
        <span class="comment-count">
          ${ctx.formatCount(
            post.commentsCount || 0
          )}
        </span>
      </button>

      <button
        type="button"
        class="post-action-btn repost-btn"
      >
        <i class="fa-solid fa-retweet"></i>
        <span class="repost-count">
          ${ctx.formatCount(
            post.repostsCount || 0
          )}
        </span>
      </button>

      <button
        type="button"
        class="post-action-btn share-btn"
      >
        <i class="fa-solid fa-share"></i>
        Share
      </button>

    </div>


    <div
      class="comments-section"
      data-loaded="false"
    ></div>
  `;


  // ==========================================================
  // AUTHOR AVATAR
  // ==========================================================

  const authorAvatar =
    card.querySelector(
      '.post-card__avatar'
    );

  ctx.applyMediaBackground(
    authorAvatar,
    post.authorPhotoURL || '',
    ctx.initialsFrom(
      post.authorName ||
      'User'
    )
  );


  // ==========================================================
  // AUTHOR NAME
  // ==========================================================

  const authorNameEl =
    card.querySelector(
      '.post-card__author-name'
    );

  authorNameEl.textContent =
    post.authorName ||
    'VitalStar Member';


  // ==========================================================
  // BODY
  // ==========================================================

  renderPostBody(
    card,
    post
  );


  // ==========================================================
  // EVENTS
  // ==========================================================

  bindPostCardEvents(
    card,
    post
  );


  // ==========================================================
  // LIKE STATE
  // ==========================================================

  refreshLikeButtonState(
    card,
    post.id
  );


  return card;
}


// ============================================================
// POST BODY
// ============================================================

function renderPostBody(card, post) {
  const body =
    card.querySelector(
      '.post-card__body'
    );

  body.innerHTML = '';


  // ----------------------------------------------------------
  // REPOST BANNER
  // ----------------------------------------------------------

  if (post.repostOf) {
    const banner =
      document.createElement('div');

    banner.className =
      'repost-banner';

    banner.innerHTML = `
      <i class="fa-solid fa-retweet"></i>
      Reposted
    `;

    body.appendChild(
      banner
    );
  }


  // ----------------------------------------------------------
  // TEXT
  // ----------------------------------------------------------

  if (post.text) {
    const textEl =
      document.createElement('p');

    textEl.className =
      'post-card__text';

    textEl.textContent =
      post.text;

    body.appendChild(
      textEl
    );
  }


  // ----------------------------------------------------------
  // MEDIA
  // ----------------------------------------------------------

  if (post.mediaURL) {
    const mediaWrap =
      document.createElement('div');

    mediaWrap.className =
      'post-card__media';


    if (
      post.mediaType ===
      'video'
    ) {
      createPostVideo(
        mediaWrap,
        post.mediaURL
      );
    } else {
      createPostImage(
        mediaWrap,
        post.mediaURL
      );
    }


    body.appendChild(
      mediaWrap
    );
  }


  // ----------------------------------------------------------
  // ORIGINAL REPOST
  // ----------------------------------------------------------

  if (post.repostOf) {
    const original =
      document.createElement('div');

    original.className =
      'repost-original';

    original.innerHTML = `
      <div
        class="repost-original__author"
      ></div>

      <div
        class="repost-original__text"
      ></div>
    `;

    original
      .querySelector(
        '.repost-original__author'
      )
      .textContent =
        post.repostOfAuthorName ||
        'VitalStar Member';

    original
      .querySelector(
        '.repost-original__text'
      )
      .textContent =
        post.repostOfText ||
        '';

    body.appendChild(
      original
    );
  }
}


// ============================================================
// CREATE IMAGE
// ============================================================

function createPostImage(
  container,
  url
) {
  const image =
    document.createElement('img');

  image.src = url;

  image.alt =
    'Post image';

  image.loading =
    'lazy';

  image.decoding =
    'async';

  image.addEventListener(
    'error',
    () => {
      console.error(
        '[Group Posts] Image failed to load:',
        url
      );

      image.alt =
        'Unable to load image.';
    }
  );

  container.appendChild(
    image
  );
}


// ============================================================
// CREATE VIDEO
// ============================================================

function createPostVideo(
  container,
  url
) {
  const video =
    document.createElement('video');

  video.controls =
    true;

  video.playsInline =
    true;

  video.preload =
    'metadata';

  video.setAttribute(
    'controlsList',
    'nodownload'
  );

  video.setAttribute(
    'webkit-playsinline',
    'true'
  );

  // IMPORTANT:
  // Setting src directly instead of injecting HTML
  // makes the Cloudinary URL safer and more reliable.

  video.src =
    url;


  // ----------------------------------------------------------
  // PLAYBACK ERROR
  // ----------------------------------------------------------

  video.addEventListener(
    'error',
    () => {
      console.error(
        '[Group Posts] Video playback failed:',
        {
          url,
          error:
            video.error
        }
      );

      if (
        !container.querySelector(
          '.post-video-error'
        )
      ) {
        const errorMessage =
          document.createElement('div');

        errorMessage.className =
          'post-video-error';

        errorMessage.textContent =
          'This video could not be played.';

        container.appendChild(
          errorMessage
        );
      }
    }
  );


  // ----------------------------------------------------------
  // CAN PLAY
  // ----------------------------------------------------------

  video.addEventListener(
    'loadedmetadata',
    () => {
      console.log(
        '[Group Posts] Video ready:',
        url
      );
    }
  );


  container.appendChild(
    video
  );
}


// ============================================================
// POST EVENTS
// ============================================================

function bindPostCardEvents(
  card,
  post
) {
  const menuBtn =
    card.querySelector(
      '.post-card__menu-btn'
    );

  const menu =
    card.querySelector(
      '.post-card__menu'
    );


  menuBtn.addEventListener(
    'click',
    (event) => {
      event.stopPropagation();

      document
        .querySelectorAll(
          '.post-card__menu.is-open'
        )
        .forEach(
          (otherMenu) => {
            if (
              otherMenu !== menu
            ) {
              otherMenu.classList.remove(
                'is-open'
              );
            }
          }
        );

      menu.classList.toggle(
        'is-open'
      );
    }
  );


  menu.addEventListener(
    'click',
    (event) => {
      event.stopPropagation();
    }
  );


  const editBtn =
    card.querySelector(
      '.edit-post-btn'
    );

  if (editBtn) {
    editBtn.addEventListener(
      'click',
      () => {
        menu.classList.remove(
          'is-open'
        );

        startEditPost(
          card,
          post
        );
      }
    );
  }


  const deleteBtn =
    card.querySelector(
      '.delete-post-btn'
    );

  if (deleteBtn) {
    deleteBtn.addEventListener(
      'click',
      () => {
        menu.classList.remove(
          'is-open'
        );

        deletePost(
          card,
          post
        );
      }
    );
  }


  const pinBtn =
    card.querySelector(
      '.pin-post-btn'
    );

  if (pinBtn) {
    pinBtn.addEventListener(
      'click',
      () => {
        menu.classList.remove(
          'is-open'
        );

        togglePinPost(
          post
        );
      }
    );
  }


  const reportBtn =
    card.querySelector(
      '.report-post-btn'
    );

  if (reportBtn) {
    reportBtn.addEventListener(
      'click',
      () => {
        menu.classList.remove(
          'is-open'
        );

        reportPost(
          post
        );
      }
    );
  }


  card
    .querySelector('.like-btn')
    .addEventListener(
      'click',
      () =>
        toggleLike(
          card,
          post
        )
    );


  card
    .querySelector(
      '.comment-toggle-btn'
    )
    .addEventListener(
      'click',
      () =>
        toggleComments(
          card,
          post
        )
    );


  card
    .querySelector('.repost-btn')
    .addEventListener(
      'click',
      () =>
        repostPost(
          post
        )
    );


  card
    .querySelector('.share-btn')
    .addEventListener(
      'click',
      () =>
        sharePost(
          post
        )
    );
}


// ============================================================
// CLOSE MENUS WHEN CLICKING OUTSIDE
// ============================================================

document.addEventListener(
  'click',
  () => {
    document
      .querySelectorAll(
        '.post-card__menu.is-open'
      )
      .forEach(
        (menu) => {
          menu.classList.remove(
            'is-open'
          );
        }
      );
  }
);


// ============================================================
// TIME AGO
// ============================================================

function timeAgo(date) {
  const seconds =
    Math.floor(
      (Date.now() -
        date.getTime()) /
        1000
    );

  if (seconds < 60) {
    return 'just now';
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric'
    }
  );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(str) {
  const div =
    document.createElement('div');

  div.textContent =
    String(str ?? '');

  return div.innerHTML;
}


// ============================================================
// EDIT POST
// ============================================================

function startEditPost(
  card,
  post
) {
  const body =
    card.querySelector(
      '.post-card__body'
    );

  const textEl =
    body.querySelector(
      '.post-card__text'
    );

  const currentText =
    post.text || '';

  const editWrap =
    document.createElement('div');

  editWrap.innerHTML = `
    <textarea
      class="post-card__edit-textarea"
    ></textarea>

    <div class="post-card__edit-actions">

      <button
        type="button"
        class="save-btn"
      >
        Save
      </button>

      <button
        type="button"
        class="cancel-btn"
      >
        Cancel
      </button>

    </div>
  `;

  editWrap
    .querySelector('textarea')
    .value =
      currentText;


  if (textEl) {
    textEl.replaceWith(
      editWrap
    );
  } else {
    body.insertBefore(
      editWrap,
      body.firstChild
    );
  }


  editWrap
    .querySelector(
      '.cancel-btn'
    )
    .addEventListener(
      'click',
      () => {
        renderPostBody(
          card,
          post
        );
      }
    );


  editWrap
    .querySelector(
      '.save-btn'
    )
    .addEventListener(
      'click',
      async () => {
        const newText =
          editWrap
            .querySelector(
              'textarea'
            )
            .value
            .trim();

        try {
          const postRef =
            doc(
              ctx.db,
              'groups',
              ctx.groupId,
              'posts',
              post.id
            );

          await updateDoc(
            postRef,
            {
              text: newText,

              isEdited: true,

              updatedAt:
                serverTimestamp()
            }
          );

          post.text =
            newText;

          post.isEdited =
            true;

          renderPostBody(
            card,
            post
          );

          const meta =
            card.querySelector(
              '.post-card__meta'
            );

          if (
            meta &&
            !meta.textContent.includes(
              'edited'
            )
          ) {
            meta.textContent +=
              ' · edited';
          }

          ctx.showToast(
            'Post updated.',
            'success'
          );

        } catch (error) {
          console.error(
            '[Group Posts] Error updating post:',
            error
          );

          ctx.showToast(
            'Could not update the post.',
            'error'
          );
        }
      }
    );
}


// ============================================================
// DELETE POST
// ============================================================

async function deletePost(
  card,
  post
) {
  if (
    !window.confirm(
      'Delete this post? This cannot be undone.'
    )
  ) {
    return;
  }

  try {
    await deleteDoc(
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts',
        post.id
      )
    );

    await updateDoc(
      ctx.groupRef,
      {
        postCount:
          increment(-1)
      }
    );

    ctx.refreshHeaderStats();

    card.remove();

    ctx.showToast(
      'Post deleted.',
      'info'
    );

  } catch (error) {
    console.error(
      '[Group Posts] Error deleting post:',
      error
    );

    ctx.showToast(
      'Could not delete the post.',
      'error'
    );
  }
}


// ============================================================
// PIN / UNPIN
// ============================================================

async function togglePinPost(post) {
  try {
    const postRef =
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts',
        post.id
      );

    await updateDoc(
      postRef,
      {
        isPinned:
          !post.isPinned
      }
    );

    ctx.showToast(
      post.isPinned
        ? 'Post unpinned.'
        : 'Post pinned to the top.',
      'success'
    );

    await loadPosts(true);

  } catch (error) {
    console.error(
      '[Group Posts] Error pinning post:',
      error
    );

    ctx.showToast(
      'Could not update the pin status.',
      'error'
    );
  }
}


// ============================================================
// REPORT
// ============================================================

async function reportPost(post) {
  const reason =
    window.prompt(
      'Why are you reporting this post? (a short reason helps our team review it)'
    );

  if (
    !reason ||
    !reason.trim()
  ) {
    return;
  }

  try {
    await addDoc(
      collection(
        ctx.db,
        'reports'
      ),
      {
        type: 'post',

        groupId:
          ctx.groupId,

        targetId:
          post.id,

        reporterId:
          ctx.currentUser.uid,

        reason:
          reason.trim(),

        status:
          'pending',

        createdAt:
          serverTimestamp()
      }
    );

    ctx.showToast(
      'Thanks — this post has been reported to VitalStar moderators.',
      'success'
    );

  } catch (error) {
    console.error(
      '[Group Posts] Error reporting post:',
      error
    );

    ctx.showToast(
      'Could not submit the report.',
      'error'
    );
  }
}


// ============================================================
// LIKES
// ============================================================

async function refreshLikeButtonState(
  card,
  postId
) {
  try {
    const likeRef =
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts',
        postId,
        'likes',
        ctx.currentUser.uid
      );

    const likeSnap =
      await getDoc(
        likeRef
      );

    const likeBtn =
      card.querySelector(
        '.like-btn'
      );

    if (!likeBtn) {
      return;
    }

    if (likeSnap.exists()) {
      likeBtn.classList.add(
        'is-liked'
      );

      likeBtn.querySelector(
        'i'
      ).className =
        'fa-solid fa-heart';
    }

  } catch (error) {
    console.error(
      '[Group Posts] Error checking like state:',
      error
    );
  }
}


async function toggleLike(
  card,
  post
) {
  if (!isActiveMember()) {
    ctx.showToast(
      'Join this group to like posts.',
      'info'
    );

    return;
  }

  const likeBtn =
    card.querySelector(
      '.like-btn'
    );

  const countEl =
    likeBtn.querySelector(
      '.like-count'
    );

  const isLiked =
    likeBtn.classList.contains(
      'is-liked'
    );

  const postRef =
    doc(
      ctx.db,
      'groups',
      ctx.groupId,
      'posts',
      post.id
    );

  const likeRef =
    doc(
      ctx.db,
      'groups',
      ctx.groupId,
      'posts',
      post.id,
      'likes',
      ctx.currentUser.uid
    );


  likeBtn.classList.toggle(
    'is-liked'
  );

  likeBtn.querySelector(
    'i'
  ).className =
    isLiked
      ? 'fa-regular fa-heart'
      : 'fa-solid fa-heart';


  const newCount =
    Math.max(
      0,
      (post.likesCount || 0) +
        (isLiked ? -1 : 1)
    );

  post.likesCount =
    newCount;

  countEl.textContent =
    ctx.formatCount(
      newCount
    );


  try {
    if (isLiked) {
      await deleteDoc(
        likeRef
      );

      await updateDoc(
        postRef,
        {
          likesCount:
            increment(-1)
        }
      );
    } else {
      await setDoc(
        likeRef,
        {
          uid:
            ctx.currentUser.uid,

          likedAt:
            serverTimestamp()
        }
      );

      await updateDoc(
        postRef,
        {
          likesCount:
            increment(1)
        }
      );
    }

  } catch (error) {
    console.error(
      '[Group Posts] Error toggling like:',
      error
    );

    // Restore visual state if Firestore fails.

    likeBtn.classList.toggle(
      'is-liked'
    );

    likeBtn.querySelector(
      'i'
    ).className =
      isLiked
        ? 'fa-solid fa-heart'
        : 'fa-regular fa-heart';

    post.likesCount =
      Math.max(
        0,
        (post.likesCount || 0) +
          (isLiked ? 1 : -1)
      );

    countEl.textContent =
      ctx.formatCount(
        post.likesCount
      );

    ctx.showToast(
      'Could not update your like.',
      'error'
    );
  }
}


// ============================================================
// COMMENTS
// ============================================================

function toggleComments(
  card,
  post
) {
  const section =
    card.querySelector(
      '.comments-section'
    );

  const isOpen =
    section.classList.contains(
      'is-open'
    );

  if (isOpen) {
    section.classList.remove(
      'is-open'
    );

    return;
  }

  section.classList.add(
    'is-open'
  );

  if (
    section.dataset.loaded ===
    'false'
  ) {
    loadComments(
      section,
      post
    );
  }
}


// ============================================================
// LOAD COMMENTS
// ============================================================

async function loadComments(
  section,
  post
) {
  section.dataset.loaded =
    'true';

  section.innerHTML = `
    <div class="tab-panel-placeholder">
      <span class="spinner-sm"></span>
      Loading comments…
    </div>
  `;

  try {
    const commentsQuery =
      query(
        collection(
          ctx.db,
          'groups',
          ctx.groupId,
          'posts',
          post.id,
          'comments'
        ),

        orderBy(
          'createdAt',
          'asc'
        ),

        limit(50)
      );

    const snapshot =
      await getDocs(
        commentsQuery
      );

    section.innerHTML = '';


    if (isActiveMember()) {
      section.appendChild(
        buildCommentComposer(
          post,
          null,
          section
        )
      );
    }


    const commentsListEl =
      document.createElement(
        'div'
      );

    commentsListEl.className =
      'comments-list';

    section.appendChild(
      commentsListEl
    );


    for (
      const commentDoc
      of snapshot.docs
    ) {
      const comment = {
        id:
          commentDoc.id,

        ...commentDoc.data()
      };

      const author =
        await getAuthorProfile(
          comment.authorId,
          {
            authorName:
              comment.authorName,

            authorPhotoURL:
              comment.authorPhotoURL
          }
        );

      comment.authorName =
        author.fullName;

      comment.authorPhotoURL =
        author.photoURL;

      commentsListEl.appendChild(
        buildCommentItem(
          comment,
          post
        )
      );
    }

  } catch (error) {
    console.error(
      '[Group Posts] Error loading comments:',
      error
    );

    section.innerHTML = `
      <div class="posts-empty">
        <p>
          Could not load comments.
        </p>
      </div>
    `;
  }
}


// ============================================================
// COMMENT COMPOSER
// ============================================================

function buildCommentComposer(
  post,
  parentCommentId,
  container
) {
  const wrap =
    document.createElement(
      'div'
    );

  wrap.className =
    parentCommentId
      ? 'reply-composer is-open'
      : 'comment-composer';

  wrap.innerHTML = `
    <input
      type="text"
      class="comment-input"
      placeholder="${
        parentCommentId
          ? 'Write a reply…'
          : 'Write a comment…'
      }"
      maxlength="1000"
    />

    <button
      type="button"
      class="comment-send-btn"
    >
      <i class="fa-solid fa-paper-plane"></i>
    </button>
  `;

  const input =
    wrap.querySelector(
      '.comment-input'
    );

  const sendBtn =
    wrap.querySelector(
      '.comment-send-btn'
    );


  const submit =
    async () => {
      const text =
        input.value.trim();

      if (!text) {
        return;
      }

      sendBtn.disabled =
        true;

      try {
        // ----------------------------------------------------
        // REAL AUTHOR PROFILE
        // ----------------------------------------------------

        const author =
          await getAuthorProfile(
            ctx.currentUser.uid,
            {
              authorName:
                ctx.currentUser.displayName,

              authorPhotoURL:
                ctx.currentUser.photoURL
            }
          );


        // ----------------------------------------------------
        // REPLY
        // ----------------------------------------------------

        if (parentCommentId) {
          const repliesRef =
            collection(
              ctx.db,
              'groups',
              ctx.groupId,
              'posts',
              post.id,
              'comments',
              parentCommentId,
              'replies'
            );

          await addDoc(
            repliesRef,
            {
              authorId:
                ctx.currentUser.uid,

              authorName:
                author.fullName,

              authorPhotoURL:
                author.photoURL,

              text,

              createdAt:
                serverTimestamp()
            }
          );


          container.appendChild(
            buildReplyItem(
              {
                authorId:
                  ctx.currentUser.uid,

                authorName:
                  author.fullName,

                authorPhotoURL:
                  author.photoURL,

                text
              }
            )
          );

        } else {

          // --------------------------------------------------
          // COMMENT
          // --------------------------------------------------

          const commentsRef =
            collection(
              ctx.db,
              'groups',
              ctx.groupId,
              'posts',
              post.id,
              'comments'
            );

          await addDoc(
            commentsRef,
            {
              authorId:
                ctx.currentUser.uid,

              authorName:
                author.fullName,

              authorPhotoURL:
                author.photoURL,

              text,

              createdAt:
                serverTimestamp()
            }
          );


          await updateDoc(
            doc(
              ctx.db,
              'groups',
              ctx.groupId,
              'posts',
              post.id
            ),
            {
              commentsCount:
                increment(1)
            }
          );


          const card =
            document.querySelector(
              `.post-card[data-post-id="${post.id}"]`
            );

          if (card) {
            post.commentsCount =
              (post.commentsCount || 0) +
              1;

            const countEl =
              card.querySelector(
                '.comment-count'
              );

            if (countEl) {
              countEl.textContent =
                ctx.formatCount(
                  post.commentsCount
                );
            }
          }


          const commentsListEl =
            wrap.parentElement.querySelector(
              '.comments-list'
            );

          if (commentsListEl) {
            commentsListEl.appendChild(
              buildCommentItem(
                {
                  authorId:
                    ctx.currentUser.uid,

                  authorName:
                    author.fullName,

                  authorPhotoURL:
                    author.photoURL,

                  text
                },
                post
              )
            );
          }
        }

        input.value = '';

      } catch (error) {
        console.error(
          '[Group Posts] Error posting comment:',
          error
        );

        ctx.showToast(
          'Could not post your comment.',
          'error'
        );

      } finally {
        sendBtn.disabled =
          false;
      }
    };


  sendBtn.addEventListener(
    'click',
    submit
  );

  input.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Enter'
      ) {
        event.preventDefault();
        submit();
      }
    }
  );

  return wrap;
}


// ============================================================
// COMMENT ITEM
// ============================================================

function buildCommentItem(
  comment,
  post
) {
  const profileHref =
    authorProfileHref(
      comment.authorId
    );

  const item =
    document.createElement(
      'div'
    );

  item.className =
    'comment-item';

  item.innerHTML = `
    <a
      class="post-author-link comment-avatar"
      href="${profileHref}"
    ></a>

    <div
      style="flex:1;min-width:0;"
    >

      <div class="comment-bubble">

        <a
          class="post-author-link comment-author"
          href="${profileHref}"
        ></a>

        <div class="comment-text"></div>

      </div>

      <div class="comment-footer">

        ${
          isActiveMember()
            ? `
              <button
                type="button"
                class="comment-reply-btn"
              >
                Reply
              </button>
            `
            : ''
        }

      </div>

      <div class="replies-list"></div>

    </div>
  `;


  const avatar =
    item.querySelector(
      '.comment-avatar'
    );

  ctx.applyMediaBackground(
    avatar,
    comment.authorPhotoURL || '',
    ctx.initialsFrom(
      comment.authorName ||
      'User'
    )
  );


  item
    .querySelector(
      '.comment-author'
    )
    .textContent =
      comment.authorName ||
      'VitalStar Member';


  item
    .querySelector(
      '.comment-text'
    )
    .textContent =
      comment.text || '';


  const replyBtn =
    item.querySelector(
      '.comment-reply-btn'
    );

  const repliesList =
    item.querySelector(
      '.replies-list'
    );


  if (
    replyBtn &&
    comment.id
  ) {
    let replyComposerOpen =
      false;

    replyBtn.addEventListener(
      'click',
      () => {
        if (
          replyComposerOpen
        ) {
          return;
        }

        replyComposerOpen =
          true;

        const composer =
          buildCommentComposer(
            post,
            comment.id,
            repliesList
          );

        item
          .querySelector(
            'div[style]'
          )
          .appendChild(
            composer
          );

        loadReplies(
          comment.id,
          post,
          repliesList
        );
      }
    );
  }


  return item;
}


// ============================================================
// LOAD REPLIES
// ============================================================

async function loadReplies(
  commentId,
  post,
  repliesListEl
) {
  try {
    const repliesQuery =
      query(
        collection(
          ctx.db,
          'groups',
          ctx.groupId,
          'posts',
          post.id,
          'comments',
          commentId,
          'replies'
        ),

        orderBy(
          'createdAt',
          'asc'
        ),

        limit(30)
      );

    const snapshot =
      await getDocs(
        repliesQuery
      );


    for (
      const replyDoc
      of snapshot.docs
    ) {
      const reply = {
        id:
          replyDoc.id,

        ...replyDoc.data()
      };

      const author =
        await getAuthorProfile(
          reply.authorId,
          {
            authorName:
              reply.authorName,

            authorPhotoURL:
              reply.authorPhotoURL
          }
        );

      reply.authorName =
        author.fullName;

      reply.authorPhotoURL =
        author.photoURL;

      repliesListEl.appendChild(
        buildReplyItem(
          reply
        )
      );
    }

  } catch (error) {
    console.error(
      '[Group Posts] Error loading replies:',
      error
    );
  }
}


// ============================================================
// REPLY ITEM
// ============================================================

function buildReplyItem(
  reply
) {
  const profileHref =
    authorProfileHref(
      reply.authorId
    );

  const item =
    document.createElement(
      'div'
    );

  item.className =
    'comment-item';

  item.innerHTML = `
    <a
      class="post-author-link comment-avatar"
      style="width:26px;height:26px;"
      href="${profileHref}"
    ></a>

    <div
      class="comment-bubble"
      style="flex:1;"
    >

      <a
        class="post-author-link comment-author"
        href="${profileHref}"
      ></a>

      <div class="comment-text"></div>

    </div>
  `;


  ctx.applyMediaBackground(
    item.querySelector(
      '.comment-avatar'
    ),
    reply.authorPhotoURL || '',
    ctx.initialsFrom(
      reply.authorName ||
      'User'
    )
  );


  item
    .querySelector(
      '.comment-author'
    )
    .textContent =
      reply.authorName ||
      'VitalStar Member';


  item
    .querySelector(
      '.comment-text'
    )
    .textContent =
      reply.text || '';


  return item;
}


// ============================================================
// REPOST
// ============================================================

async function repostPost(
  post
) {
  if (!isActiveMember()) {
    ctx.showToast(
      'Join this group to repost.',
      'info'
    );

    return;
  }

  if (post.repostOf) {
    ctx.showToast(
      'You can only repost original posts.',
      'info'
    );

    return;
  }

  if (
    !window.confirm(
      'Repost this to the group feed?'
    )
  ) {
    return;
  }


  try {
    // --------------------------------------------------------
    // REAL CURRENT USER PROFILE
    // --------------------------------------------------------

    const author =
      await getAuthorProfile(
        ctx.currentUser.uid,
        {
          authorName:
            ctx.currentUser.displayName,

          authorPhotoURL:
            ctx.currentUser.photoURL
        }
      );


    const postsRef =
      collection(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts'
      );


    await addDoc(
      postsRef,
      {
        authorId:
          ctx.currentUser.uid,

        authorName:
          author.fullName,

        authorPhotoURL:
          author.photoURL,

        authorRole:
          currentUserRole() ||
          'member',

        text: '',

        mediaURL:
          post.mediaURL || '',

        mediaType:
          post.mediaType || 'none',

        isPinned:
          false,

        isEdited:
          false,

        likesCount:
          0,

        commentsCount:
          0,

        sharesCount:
          0,

        repostsCount:
          0,

        repostOf:
          post.id,

        repostOfAuthorName:
          post.authorName ||
          'VitalStar Member',

        repostOfText:
          post.text || '',

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );


    await updateDoc(
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts',
        post.id
      ),
      {
        repostsCount:
          increment(1)
      }
    );


    await updateDoc(
      ctx.groupRef,
      {
        postCount:
          increment(1)
      }
    );


    ctx.refreshHeaderStats();


    ctx.showToast(
      'Reposted to the group feed.',
      'success'
    );


    await loadPosts(true);

  } catch (error) {
    console.error(
      '[Group Posts] Error reposting:',
      error
    );

    ctx.showToast(
      'Could not repost.',
      'error'
    );
  }
}


// ============================================================
// SHARE
// ============================================================

async function sharePost(
  post
) {
  const url =
    `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(ctx.groupId)}&post=${encodeURIComponent(post.id)}`;

  try {
    const postRef =
      doc(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts',
        post.id
      );

    await updateDoc(
      postRef,
      {
        sharesCount:
          increment(1)
      }
    );


    if (
      navigator.share
    ) {
      await navigator.share(
        {
          title:
            'A post on VitalStar',

          url
        }
      );
    } else if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      await navigator.clipboard.writeText(
        url
      );

      ctx.showToast(
        'Link copied to clipboard.',
        'success'
      );
    } else {
      // Fallback for browsers where
      // Clipboard API isn't available.

      const textArea =
        document.createElement(
          'textarea'
        );

      textArea.value =
        url;

      textArea.style.position =
        'fixed';

      textArea.style.opacity =
        '0';

      document.body.appendChild(
        textArea
      );

      textArea.select();

      document.execCommand(
        'copy'
      );

      textArea.remove();

      ctx.showToast(
        'Link copied to clipboard.',
        'success'
      );
    }

  } catch (error) {
    if (
      error.name !==
      'AbortError'
    ) {
      console.error(
        '[Group Posts] Error sharing post:',
        error
      );
    }
  }
}