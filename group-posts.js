// ============================================================
// VITALSTAR — group-posts.js
// Complete Group Posts System
//
// Handles:
// - Text posts
// - Image uploads
// - Video uploads
// - Image preview
// - HTML5 video playback
// - Real user full names
// - Real profile pictures
// - Profile links
// - Likes
// - Comments
// - Replies
// - Reposts
// - Sharing
// - Edit / Delete
// - Pin / Unpin
// - Report
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
// STATE
// ============================================================

let ctx = null;
let state = null;


// Cache user profiles so we do not repeatedly request the
// same user document from Firestore.
const authorCache = new Map();


// ============================================================
// CLOUDINARY UPLOAD
// ============================================================

function uploadToCloudinary(file, resourceType, onProgress) {
  return new Promise((resolve, reject) => {

    if (!file) {
      reject(new Error('No media file selected.'));
      return;
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      reject(new Error('Cloudinary configuration is missing.'));
      return;
    }

    /*
     * Use the explicit endpoint first.
     *
     * Images:
     * /image/upload
     *
     * Videos:
     * /video/upload
     */
    const endpoint =
      resourceType === 'video'
        ? 'video/upload'
        : 'image/upload';

    const url =
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${endpoint}`;

    const formData = new FormData();

    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();

    xhr.open('POST', url, true);

    /*
     * Five minutes gives large videos enough time to upload
     * on a mobile connection.
     */
    xhr.timeout = 300000;

    xhr.upload.onprogress = (event) => {

      if (
        event.lengthComputable &&
        typeof onProgress === 'function'
      ) {
        const percent =
          Math.round((event.loaded / event.total) * 100);

        onProgress(percent);
      }
    };


    xhr.onload = () => {

      let response = null;

      try {
        response = JSON.parse(xhr.responseText || '{}');
      } catch (error) {
        console.error(
          '[Cloudinary] Invalid JSON response:',
          xhr.responseText
        );

        reject(
          new Error(
            `Cloudinary returned an invalid response (${xhr.status}).`
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
            response.resource_type || resourceType
        });

        return;
      }


      console.error(
        '[Cloudinary] Upload rejected:',
        {
          status: xhr.status,
          response
        }
      );


      let message =
        response?.error?.message ||
        `Cloudinary upload failed (${xhr.status}).`;


      /*
       * Give a much more useful error when the unsigned
       * preset is not configured for the selected media.
       */
      if (
        xhr.status === 400 &&
        resourceType === 'video'
      ) {
        message =
          response?.error?.message ||
          'Cloudinary rejected the video. Make sure the vitalstar_upload preset is unsigned and allows video uploads.';
      }


      reject(new Error(message));
    };


    xhr.onerror = () => {

      console.error(
        '[Cloudinary] Network error.',
        {
          online: navigator.onLine,
          url,
          fileName: file.name,
          fileSizeMB:
            (file.size / 1024 / 1024).toFixed(2),
          resourceType
        }
      );


      reject(
        new Error(
          navigator.onLine
            ? 'Could not connect to Cloudinary. Your browser or network may be blocking the Cloudinary upload.'
            : 'You appear to be offline. Check your internet connection and try again.'
        )
      );
    };


    xhr.onabort = () => {

      reject(
        new Error('Cloudinary upload was cancelled.')
      );
    };


    xhr.ontimeout = () => {

      reject(
        new Error(
          'Cloudinary upload timed out. Try a smaller file or a stronger internet connection.'
        )
      );
    };


    xhr.send(formData);
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
      border-radius: var(--radius-lg, 18px);
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
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;

      background:
        linear-gradient(
          135deg,
          #2f6fff,
          #8b5cff
        );

      background-size: cover;
      background-position: center;

      display: flex;
      align-items: center;
      justify-content: center;

      font-weight: 700;
      color: #fff;
      font-size: 15px;

      overflow: hidden;
      text-decoration: none;
    }


    .composer__input {
      flex: 1;
      min-height: 42px;
      max-height: 220px;
      resize: none;

      background: #f5f6f8;

      border: 1px solid rgba(0,0,0,0.1);

      border-radius: 12px;

      padding: 11px 14px;

      color: #1a1d29;

      font-family: inherit;
      font-size: 14px;

      outline: none;
    }


    .composer__input:focus {
      border-color: #2f6fff;
    }


    .composer__input::placeholder {
      color: #9aa0ac;
    }


    /* ========================================================
       MEDIA PREVIEW
       ======================================================== */

    .composer__media-preview {
      margin-top: 12px;

      position: relative;

      display: none;

      border-radius: 14px;

      overflow: hidden;

      background: #000;

      min-height: 0;
    }


    .composer__media-preview.is-visible {
      display: block;
    }


    .composer__media-preview img,
    .composer__media-preview video {

      width: 100%;

      max-height: 340px;

      display: block;

      object-fit: contain;

      background: #000;
    }


    .composer__media-preview img {
      min-height: 80px;
    }


    .composer__media-remove {

      position: absolute;

      top: 10px;
      right: 10px;

      width: 32px;
      height: 32px;

      border-radius: 50%;

      background: rgba(0,0,0,0.75);

      border: none;

      color: #fff;

      display: flex;

      align-items: center;
      justify-content: center;

      z-index: 5;
    }


    .composer__bottom {

      display: flex;

      align-items: center;

      justify-content: space-between;

      margin-top: 12px;
    }


    .composer__tools {

      display: flex;

      gap: 8px;
    }


    .composer__tool-btn {

      width: 40px;
      height: 40px;

      border-radius: 12px;

      background: #f5f6f8;

      border: 1px solid rgba(0,0,0,0.1);

      color: #5a6070;

      display: flex;

      align-items: center;

      justify-content: center;
    }


    .composer__tool-btn:hover {

      color: #2f6fff;

      border-color: #2f6fff;
    }


    .composer__post-btn {

      padding: 10px 22px;

      border-radius: 999px;

      border: none;

      background:
        linear-gradient(
          135deg,
          #2f6fff,
          #8b5cff
        );

      color: #fff;

      font-weight: 700;

      font-size: 14px;
    }


    .composer__post-btn:disabled {

      opacity: 0.5;

      cursor: default;
    }


    /* ========================================================
       POST
       ======================================================== */

    .post-card {

      border-radius: var(--radius-lg, 18px);

      background: #ffffff;

      border: 1px solid rgba(0,0,0,0.08);

      padding: 16px 18px;

      margin-bottom: 16px;

      animation: rise-in 0.35s ease;
    }


    .post-card.is-pinned {

      border-color: rgba(255,194,75,0.5);
    }


    .post-card__pin-flag {

      display: none;

      align-items: center;

      gap: 6px;

      font-size: 11.5px;

      color: #d69e00;

      font-weight: 700;

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


    /* ========================================================
       AUTHOR AVATAR
       ======================================================== */

    .post-card__avatar {

      width: 44px;
      height: 44px;

      border-radius: 50%;

      flex-shrink: 0;

      background:
        linear-gradient(
          135deg,
          #2f6fff,
          #8b5cff
        );

      background-position: center;

      background-size: cover;

      display: flex;

      align-items: center;

      justify-content: center;

      font-weight: 700;

      color: #fff;

      font-size: 15px;

      overflow: hidden;

      text-decoration: none;
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


    /* ========================================================
       FULL NAME — YELLOW
       ======================================================== */

    .post-card__author-name {

      font-weight: 800;

      font-size: 14px;

      color: #f2c94c !important;

      text-decoration: none;

      cursor: pointer;
    }


    .post-card__author-name:hover {

      text-decoration: underline;
    }


    .post-card__meta {

      font-size: 11.5px;

      color: #8a90a0;

      margin-top: 2px;
    }


    .role-chip {

      font-size: 10px;

      font-weight: 700;

      padding: 3px 8px;

      border-radius: 999px;

      background: rgba(139,92,255,0.12);

      color: #8b5cff;

      text-transform: capitalize;
    }


    .post-author-link {

      text-decoration: none;

      cursor: pointer;
    }


    .post-card__avatar:hover {

      opacity: 0.85;
    }


    /* ========================================================
       MENU
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

      z-index: 50;

      background: #ffffff;

      border: 1px solid rgba(0,0,0,0.1);

      border-radius: 12px;

      box-shadow: 0 6px 20px rgba(0,0,0,0.12);

      overflow: hidden;

      min-width: 170px;
    }


    .post-card__menu.is-open {

      display: block;
    }


    .post-card__menu button {

      display: flex;

      align-items: center;

      gap: 9px;

      width: 100%;

      padding: 11px 14px;

      background: none;

      border: none;

      color: #4a5568;

      font-size: 13px;

      text-align: left;
    }


    .post-card__menu button:hover {

      background: rgba(0,0,0,0.04);
    }


    /* ========================================================
       BODY
       ======================================================== */

    .post-card__text {

      font-size: 14px;

      color: #1a1d29;

      line-height: 1.6;

      margin: 12px 0 0;

      white-space: pre-wrap;

      word-break: break-word;
    }


    .post-card__media {

      margin-top: 12px;

      border-radius: 14px;

      overflow: hidden;

      background: #000;
    }


    .post-card__media img {

      width: 100%;

      max-height: 560px;

      object-fit: contain;

      display: block;

      background: #000;
    }


    /* ========================================================
       VIDEO
       ======================================================== */

    .post-card__media video {

      width: 100%;

      max-height: 560px;

      min-height: 180px;

      object-fit: contain;

      display: block;

      background: #000;

      outline: none;
    }


    .post-card__media video::-webkit-media-controls {

      display: flex !important;
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

      border-radius: 10px;

      border: none;

      background: none;

      color: #6a7080;

      font-size: 12.5px;

      font-weight: 600;
    }


    .post-action-btn:hover {

      background: rgba(0,0,0,0.04);

      color: #1a1d29;
    }


    .post-action-btn.is-liked {

      color: #ef4444;
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

      border-radius: 999px;

      padding: 9px 15px;

      color: #1a1d29;

      font-size: 13px;

      outline: none;
    }


    .comment-send-btn {

      width: 34px;

      height: 34px;

      border-radius: 50%;

      border: none;

      background: #2f6fff;

      color: #fff;

      flex-shrink: 0;
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
          #2f6fff,
          #8b5cff
        );

      background-size: cover;

      background-position: center;

      display: flex;

      align-items: center;

      justify-content: center;

      font-weight: 700;

      font-size: 11px;

      color: #fff;

      overflow: hidden;
    }


    .comment-bubble {

      background: #f5f6f8;

      border-radius: 12px;

      padding: 8px 12px;

      flex: 1;
    }


    .comment-author {

      font-size: 12.5px;

      font-weight: 700;

      color: #f2c94c !important;

      text-decoration: none;
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

      border-radius: 12px;

      background: #f5f6f8;

      border: 1px solid rgba(0,0,0,0.1);

      color: #1a1d29;

      font-weight: 600;

      font-size: 13px;
    }


    .posts-empty {

      text-align: center;

      padding: 50px 20px;

      color: #8a90a0;
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

    pendingMediaType: null,

    pendingPreviewURL: null

  };


  ctx.panelEl.innerHTML = '';


  /*
   * Make sure current user information is loaded before
   * creating the composer.
   */
  await hydrateCurrentUser();


  renderComposer();


  const feedList = document.createElement('div');

  feedList.id = 'postsFeedList';

  ctx.panelEl.appendChild(feedList);


  const loadMoreBtn = document.createElement('button');

  loadMoreBtn.className = 'load-more-posts-btn';

  loadMoreBtn.id = 'loadMorePostsBtn';

  loadMoreBtn.textContent = 'Load more posts';

  loadMoreBtn.style.display = 'none';


  loadMoreBtn.addEventListener(
    'click',
    () => loadPosts(false)
  );


  ctx.panelEl.appendChild(loadMoreBtn);


  await loadPosts(true);
}


// ============================================================
// USER PROFILE HELPERS
// ============================================================

async function getUserProfile(uid) {

  if (!uid) {
    return null;
  }


  if (authorCache.has(uid)) {
    return authorCache.get(uid);
  }


  try {

    const userSnap =
      await getDoc(
        doc(ctx.db, 'users', uid)
      );


    if (!userSnap.exists()) {

      authorCache.set(uid, null);

      return null;
    }


    const data = userSnap.data() || {};

    const profile = {

      uid,

      fullName:
        data.fullName ||
        data.fullname ||
        data.displayName ||
        data.name ||
        data.username ||
        'VitalStar Member',

      photoURL:
        data.photoURL ||
        data.profilePicture ||
        data.profileImage ||
        data.avatar ||
        data.photo ||
        ''

    };


    authorCache.set(uid, profile);

    return profile;

  } catch (error) {

    console.error(
      'Could not load user profile:',
      uid,
      error
    );

    return null;
  }
}


// ============================================================
// CURRENT USER
// ============================================================

async function hydrateCurrentUser() {

  if (!ctx?.currentUser?.uid) {
    return;
  }


  const uid = ctx.currentUser.uid;

  const profile =
    await getUserProfile(uid);


  if (!profile) {
    return;
  }


  /*
   * Add full-name information to currentUser without
   * destroying the Firebase user object.
   */
  ctx.currentUser.fullName =
    profile.fullName ||
    ctx.currentUser.fullName ||
    ctx.currentUser.displayName ||
    'VitalStar Member';


  ctx.currentUser.photoURL =
    profile.photoURL ||
    ctx.currentUser.photoURL ||
    '';
}


// ============================================================
// MEMBERSHIP
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

    const notice =
      document.createElement('div');

    notice.className =
      'composer-join-notice';

    notice.innerHTML = `
      <span>
        Join this group to post, like, and comment.
      </span>
    `;

    ctx.panelEl.appendChild(notice);

    return;
  }


  const wrap =
    document.createElement('div');

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
        placeholder="Share something with the group..."
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
          accept="image/jpeg,image/png,image/gif,image/webp,image/*"
          style="display:none;"
        />


        <input
          type="file"
          id="composerVideoInput"
          accept="video/mp4,video/webm,video/ogg,video/*"
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


  const avatarEl =
    wrap.querySelector('#composerAvatar');


  ctx.applyMediaBackground(
    avatarEl,
    ctx.currentUser.photoURL || '',
    ctx.initialsFrom(
      ctx.currentUser.fullName ||
      ctx.currentUser.displayName ||
      'U'
    )
  );


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

      updateComposerButtonState(
        input,
        postBtn
      );
    }
  );


  wrap
    .querySelector('#composerImageBtn')
    .addEventListener(
      'click',
      () =>
        wrap
          .querySelector('#composerImageInput')
          .click()
    );


  wrap
    .querySelector('#composerVideoBtn')
    .addEventListener(
      'click',
      () =>
        wrap
          .querySelector('#composerVideoInput')
          .click()
    );


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


  postBtn.addEventListener(
    'click',
    () => submitPost(wrap)
  );
}


// ============================================================
// COMPOSER BUTTON STATE
// ============================================================

function updateComposerButtonState(
  input,
  button
) {

  button.disabled =
    input.value.trim().length === 0 &&
    !state.pendingMediaFile;
}


// ============================================================
// MEDIA PREVIEW
// ============================================================

async function handleComposerMediaSelect(
  event,
  type
) {

  const file =
    event.target.files?.[0];


  if (!file) {
    return;
  }


  const maxSize =
    type === 'video'
      ? MAX_VIDEO_SIZE
      : MAX_IMAGE_SIZE;


  if (file.size > maxSize) {

    ctx.showToast(
      `${type === 'video' ? 'Video' : 'Image'} is too large. Maximum size is ${
        type === 'video' ? '60MB' : '8MB'
      }.`,
      'error'
    );

    event.target.value = '';

    return;
  }


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


  state.pendingMediaFile = file;

  state.pendingMediaType = type;


  const preview =
    document.getElementById(
      'composerMediaPreview'
    );


  if (!preview) {
    return;
  }


  /*
   * Revoke previous object URL.
   */
  if (state.pendingPreviewURL) {

    try {
      URL.revokeObjectURL(
        state.pendingPreviewURL
      );
    } catch (_) {}

    state.pendingPreviewURL = null;
  }


  preview.innerHTML = '';


  /*
   * IMAGE PREVIEW
   *
   * Use FileReader instead of relying only on a blob URL.
   * This fixes the broken "Selected image" preview shown
   * in the screenshot on some Android browsers.
   */
  if (type === 'image') {

    try {

      const dataURL =
        await readFileAsDataURL(file);


      const img =
        document.createElement('img');


      img.src = dataURL;

      img.alt = 'Selected image';

      img.loading = 'eager';


      img.onerror = () => {

        preview.innerHTML =
          '<div style="padding:20px;color:#fff;text-align:center;">Could not preview this image.</div>';
      };


      preview.appendChild(img);

    } catch (error) {

      console.error(
        'Image preview error:',
        error
      );

      ctx.showToast(
        'Could not preview this image.',
        'error'
      );

      state.pendingMediaFile = null;

      state.pendingMediaType = null;

      return;
    }

  }


  /*
   * VIDEO PREVIEW
   */
  if (type === 'video') {

    const video =
      document.createElement('video');


    const objectURL =
      URL.createObjectURL(file);


    state.pendingPreviewURL =
      objectURL;


    video.src = objectURL;

    video.controls = true;

    video.playsInline = true;

    video.preload = 'metadata';

    video.muted = true;


    video.addEventListener(
      'error',
      () => {

        console.error(
          'Video preview error:',
          video.error
        );

        ctx.showToast(
          'This video cannot be previewed by your browser.',
          'error'
        );
      }
    );


    preview.appendChild(video);
  }


  /*
   * REMOVE BUTTON
   */
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

      clearPendingMedia();

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


      const input =
        document.getElementById(
          'composerInput'
        );


      const postBtn =
        document.getElementById(
          'composerPostBtn'
        );


      if (input && postBtn) {
        updateComposerButtonState(
          input,
          postBtn
        );
      }
    }
  );


  preview.appendChild(removeBtn);

  preview.classList.add('is-visible');


  const input =
    document.getElementById(
      'composerInput'
    );


  const postBtn =
    document.getElementById(
      'composerPostBtn'
    );


  if (input && postBtn) {

    postBtn.disabled = false;
  }
}


// ============================================================
// READ FILE AS DATA URL
// ============================================================

function readFileAsDataURL(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        () => resolve(
          reader.result
        );


      reader.onerror =
        () =>
          reject(
            reader.error ||
            new Error(
              'Could not read file.'
            )
          );


      reader.readAsDataURL(file);
    }
  );
}


// ============================================================
// CLEAR MEDIA
// ============================================================

function clearPendingMedia() {

  if (state.pendingPreviewURL) {

    try {

      URL.revokeObjectURL(
        state.pendingPreviewURL
      );

    } catch (_) {}

  }


  state.pendingPreviewURL = null;

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

  postBtn.textContent =
    'Posting...';


  try {

    /*
     * Make sure user profile is current.
     */
    await hydrateCurrentUser();


    let mediaURL = '';

    let mediaType = 'none';


    /*
     * Upload media first.
     */
    if (state.pendingMediaFile) {

      const selectedFile =
        state.pendingMediaFile;


      const selectedType =
        state.pendingMediaType;


      postBtn.textContent =
        selectedType === 'video'
          ? 'Uploading video...'
          : 'Uploading image...';


      const uploadResult =
        await uploadToCloudinary(
          selectedFile,
          selectedType,
          (percent) => {

            postBtn.textContent =
              `Uploading ${selectedType} ${percent}%...`;
          }
        );


      mediaURL =
        uploadResult.url;


      mediaType =
        selectedType;


      if (!mediaURL) {

        throw new Error(
          'Cloudinary did not return a media URL.'
        );
      }
    }


    /*
     * Get best available full name.
     */
    const authorName =
      ctx.currentUser.fullName ||
      ctx.currentUser.displayName ||
      ctx.currentUser.name ||
      'VitalStar Member';


    const authorPhotoURL =
      ctx.currentUser.photoURL ||
      '';


    const postsRef =
      collection(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts'
      );


    postBtn.textContent =
      'Publishing...';


    await addDoc(
      postsRef,
      {

        authorId:
          ctx.currentUser.uid,

        authorName,

        authorPhotoURL,

        authorRole:
          currentUserRole() ||
          'member',

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


    try {

      await updateDoc(
        ctx.groupRef,
        {
          postCount:
            increment(1)
        }
      );

      ctx.refreshHeaderStats();

    } catch (countError) {

      console.warn(
        'Post created but group postCount could not be updated:',
        countError
      );
    }


    input.value = '';

    input.style.height =
      'auto';


    clearPendingMedia();


    const imageInput =
      composerEl.querySelector(
        '#composerImageInput'
      );


    const videoInput =
      composerEl.querySelector(
        '#composerVideoInput'
      );


    if (imageInput) {
      imageInput.value = '';
    }


    if (videoInput) {
      videoInput.value = '';
    }


    ctx.showToast(
      'Posted successfully!',
      'success'
    );


    await loadPosts(true);

  } catch (error) {

    console.error(
      'Error creating post:',
      error
    );


    ctx.showToast(
      error?.message ||
      'Could not publish your post. Please try again.',
      'error'
    );

  } finally {

    postBtn.disabled =
      input.value.trim().length === 0 &&
      !state.pendingMediaFile;


    postBtn.textContent =
      'Post';
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
        Loading posts...
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
      await getDocs(postsQuery);


    if (reset) {

      feedList.innerHTML = '';
    }


    if (snapshot.docs.length > 0) {

      state.lastVisibleDoc =
        snapshot.docs[
          snapshot.docs.length - 1
        ];
    }


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
            No posts yet.
            Be the first to share something!
          </p>

        </div>

      `;

    } else {

      snapshot.forEach(
        (postDoc) => {

          const post = {

            id: postDoc.id,

            ...postDoc.data()

          };


          const card =
            renderPostCard(post);


          feedList.appendChild(card);


          /*
           * Load the latest user profile after the card
           * is displayed.
           */
          hydratePostAuthor(
            card,
            post
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
      'Error loading posts:',
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
// HYDRATE POST AUTHOR
// ============================================================

async function hydratePostAuthor(
  card,
  post
) {

  if (!post.authorId) {
    return;
  }


  const profile =
    await getUserProfile(
      post.authorId
    );


  if (!profile) {
    return;
  }


  const fullName =
    profile.fullName ||
    post.authorName ||
    'VitalStar Member';


  const photoURL =
    profile.photoURL ||
    post.authorPhotoURL ||
    '';


  /*
   * Update DOM.
   */
  const nameEl =
    card.querySelector(
      '.post-card__author-name'
    );


  if (nameEl) {

    nameEl.textContent =
      fullName;
  }


  const avatarEl =
    card.querySelector(
      '.post-card__avatar'
    );


  if (avatarEl) {

    ctx.applyMediaBackground(
      avatarEl,
      photoURL,
      ctx.initialsFrom(
        fullName
      )
    );
  }


  /*
   * Keep the in-memory post current.
   */
  post.authorName =
    fullName;


  post.authorPhotoURL =
    photoURL;
}


// ============================================================
// RENDER POST CARD
// ============================================================

function renderPostCard(post) {

  const card =
    document.createElement('div');


  card.className =
    `post-card${
      post.isPinned
        ? ' is-pinned'
        : ''
    }`;


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


  const authorName =
    post.authorName ||
    'VitalStar Member';


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

            ${
              post.isEdited
                ? ' · edited'
                : ''
            }

          </div>

        </div>

      </div>


      <div class="post-card__menu-wrap">

        <button
          type="button"
          class="post-card__menu-btn"
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

                  ${
                    post.isPinned
                      ? 'Unpin'
                      : 'Pin'
                  }
                  post
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


  const authorAvatar =
    card.querySelector(
      '.post-card__avatar'
    );


  ctx.applyMediaBackground(
    authorAvatar,
    post.authorPhotoURL || '',
    ctx.initialsFrom(
      authorName
    )
  );


  card.querySelector(
    '.post-card__author-name'
  ).textContent =
    authorName;


  renderPostBody(
    card,
    post
  );


  bindPostCardEvents(
    card,
    post
  );


  refreshLikeButtonState(
    card,
    post.id
  );


  return card;
}


// ============================================================
// RENDER POST BODY
// ============================================================

function renderPostBody(
  card,
  post
) {

  const body =
    card.querySelector(
      '.post-card__body'
    );


  body.innerHTML = '';


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


  /*
   * MEDIA
   */
  if (post.mediaURL) {

    const mediaWrap =
      document.createElement('div');


    mediaWrap.className =
      'post-card__media';


    if (
      post.mediaType ===
      'video'
    ) {

      const video =
        document.createElement('video');


      /*
       * Important attributes for mobile browsers.
       */
      video.controls = true;

      video.playsInline = true;

      video.preload = 'metadata';

      video.setAttribute(
        'playsinline',
        ''
      );


      /*
       * Cloudinary secure URL.
       */
      video.src =
        normalizeMediaURL(
          post.mediaURL
        );


      video.addEventListener(
        'error',
        () => {

          console.error(
            'Posted video could not play:',
            {
              url: post.mediaURL,
              error: video.error
            }
          );


          /*
           * Show a useful fallback rather than a
           * completely blank media area.
           */
          if (
            !mediaWrap.querySelector(
              '.video-error-message'
            )
          ) {

            const errorText =
              document.createElement(
                'div'
              );


            errorText.className =
              'video-error-message';


            errorText.style.cssText =
              `
                padding:16px;
                color:#fff;
                background:#111;
                text-align:center;
                font-size:13px;
              `;


            errorText.textContent =
              'This video could not be played by your browser.';


            mediaWrap.appendChild(
              errorText
            );
          }
        }
      );


      mediaWrap.appendChild(
        video
      );

    } else {

      const img =
        document.createElement(
          'img'
        );


      img.src =
        normalizeMediaURL(
          post.mediaURL
        );


      img.alt =
        'Post image';


      img.loading =
        'lazy';


      img.decoding =
        'async';


      img.onerror =
        () => {

          console.error(
            'Posted image could not load:',
            post.mediaURL
          );
        };


      mediaWrap.appendChild(
        img
      );
    }


    body.appendChild(
      mediaWrap
    );
  }


  if (post.repostOf) {

    const original =
      document.createElement(
        'div'
      );


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


    original.querySelector(
      '.repost-original__author'
    ).textContent =
      post.repostOfAuthorName ||
      'VitalStar Member';


    original.querySelector(
      '.repost-original__text'
    ).textContent =
      post.repostOfText ||
      '';


    body.appendChild(
      original
    );
  }
}


// ============================================================
// NORMALIZE MEDIA URL
// ============================================================

function normalizeMediaURL(url) {

  if (!url) {
    return '';
  }


  /*
   * Cloudinary normally returns HTTPS URLs already.
   */
  if (
    url.startsWith(
      'https://'
    )
  ) {
    return url;
  }


  if (
    url.startsWith(
      'http://'
    )
  ) {

    return url.replace(
      'http://',
      'https://'
    );
  }


  return url;
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


  const editBtn =
    card.querySelector(
      '.edit-post-btn'
    );


  if (editBtn) {

    editBtn.addEventListener(
      'click',
      () =>
        startEditPost(
          card,
          post
        )
    );
  }


  const deleteBtn =
    card.querySelector(
      '.delete-post-btn'
    );


  if (deleteBtn) {

    deleteBtn.addEventListener(
      'click',
      () =>
        deletePost(
          card,
          post
        )
    );
  }


  const pinBtn =
    card.querySelector(
      '.pin-post-btn'
    );


  if (pinBtn) {

    pinBtn.addEventListener(
      'click',
      () =>
        togglePinPost(
          post
        )
    );
  }


  const reportBtn =
    card.querySelector(
      '.report-post-btn'
    );


  if (reportBtn) {

    reportBtn.addEventListener(
      'click',
      () =>
        reportPost(
          post
        )
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
    .querySelector(
      '.repost-btn'
    )
    .addEventListener(
      'click',
      () =>
        repostPost(
          post
        )
    );


  card
    .querySelector(
      '.share-btn'
    )
    .addEventListener(
      'click',
      () =>
        sharePost(
          post
        )
    );
}


// ============================================================
// GLOBAL MENU CLOSE
// ============================================================

document.addEventListener(
  'click',
  () => {

    document
      .querySelectorAll(
        '.post-card__menu.is-open'
      )
      .forEach(
        (menu) =>
          menu.classList.remove(
            'is-open'
          )
      );
  }
);


// ============================================================
// TIME AGO
// ============================================================

function timeAgo(date) {

  const seconds =
    Math.floor(
      (
        Date.now() -
        date.getTime()
      ) / 1000
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
    document.createElement(
      'div'
    );


  div.textContent =
    String(str || '');


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
    document.createElement(
      'div'
    );


  editWrap.innerHTML = `

    <textarea
      class="post-card__edit-textarea"
    ></textarea>


    <div
      class="post-card__edit-actions"
    >

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


  editWrap.querySelector(
    'textarea'
  ).value =
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
      () =>
        renderPostBody(
          card,
          post
        )
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


          ctx.showToast(
            'Post updated.',
            'success'
          );

        } catch (error) {

          console.error(
            'Error updating post:',
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


    try {

      await updateDoc(
        ctx.groupRef,
        {
          postCount:
            increment(-1)
        }
      );

      ctx.refreshHeaderStats();

    } catch (countError) {

      console.warn(
        'Post deleted but postCount could not be updated:',
        countError
      );
    }


    card.remove();


    ctx.showToast(
      'Post deleted.',
      'info'
    );

  } catch (error) {

    console.error(
      'Error deleting post:',
      error
    );


    ctx.showToast(
      'Could not delete the post.',
      'error'
    );
  }
}


// ============================================================
// PIN POST
// ============================================================

async function togglePinPost(
  post
) {

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
      'Error pinning post:',
      error
    );


    ctx.showToast(
      'Could not update the pin status.',
      'error'
    );
  }
}


// ============================================================
// REPORT POST
// ============================================================

async function reportPost(
  post
) {

  const reason =
    window.prompt(
      'Why are you reporting this post?'
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
      'Post reported.',
      'success'
    );

  } catch (error) {

    console.error(
      'Error reporting post:',
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
      'Error checking like state:',
      error
    );
  }
}


// ============================================================
// TOGGLE LIKE
// ============================================================

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


  const oldCount =
    Number(
      post.likesCount || 0
    );


  const newCount =
    Math.max(
      0,
      oldCount +
        (
          isLiked
            ? -1
            : 1
        )
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
      'Error toggling like:',
      error
    );


    /*
     * Roll UI back if Firestore failed.
     */
    post.likesCount =
      oldCount;


    countEl.textContent =
      ctx.formatCount(
        oldCount
      );


    likeBtn.classList.toggle(
      'is-liked'
    );


    likeBtn.querySelector(
      'i'
    ).className =
      isLiked
        ? 'fa-solid fa-heart'
        : 'fa-regular fa-heart';


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

      Loading comments...

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


    snapshot.forEach(
      (commentDoc) => {

        commentsListEl.appendChild(
          buildCommentItem(
            {
              id:
                commentDoc.id,

              ...commentDoc.data()
            },
            post
          )
        );
      }
    );

  } catch (error) {

    console.error(
      'Error loading comments:',
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
          ? 'Write a reply...'
          : 'Write a comment...'
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


          const replyData = {

            authorId:
              ctx.currentUser.uid,

            authorName:
              ctx.currentUser.fullName ||
              ctx.currentUser.displayName ||
              'VitalStar Member',

            authorPhotoURL:
              ctx.currentUser.photoURL ||
              '',

            text,

            createdAt:
              serverTimestamp()
          };


          const replyDoc =
            await addDoc(
              repliesRef,
              replyData
            );


          container.appendChild(
            buildReplyItem(
              {
                id:
                  replyDoc.id,

                ...replyData
              }
            )
          );

        } else {

          const commentsRef =
            collection(
              ctx.db,
              'groups',
              ctx.groupId,
              'posts',
              post.id,
              'comments'
            );


          const commentData = {

            authorId:
              ctx.currentUser.uid,

            authorName:
              ctx.currentUser.fullName ||
              ctx.currentUser.displayName ||
              'VitalStar Member',

            authorPhotoURL:
              ctx.currentUser.photoURL ||
              '',

            text,

            createdAt:
              serverTimestamp()
          };


          const commentDoc =
            await addDoc(
              commentsRef,
              commentData
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
              (
                post.commentsCount ||
                0
              ) + 1;


            card.querySelector(
              '.comment-count'
            ).textContent =
              ctx.formatCount(
                post.commentsCount
              );
          }


          const commentsListEl =
            wrap.parentElement.querySelector(
              '.comments-list'
            );


          if (commentsListEl) {

            commentsListEl.appendChild(
              buildCommentItem(
                {
                  id:
                    commentDoc.id,

                  ...commentData
                },
                post
              )
            );
          }
        }


        input.value = '';

      } catch (error) {

        console.error(
          'Error posting comment:',
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
        event.key ===
        'Enter'
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


    <div style="flex:1;min-width:0;">

      <div class="comment-bubble">

        <a
          class="post-author-link comment-author"
          href="${profileHref}"
        ></a>


        <div
          class="comment-text"
        ></div>

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


  const author =
    item.querySelector(
      '.comment-author'
    );


  const name =
    comment.authorName ||
    'VitalStar Member';


  ctx.applyMediaBackground(
    avatar,
    comment.authorPhotoURL || '',
    ctx.initialsFrom(name)
  );


  author.textContent =
    name;


  item.querySelector(
    '.comment-text'
  ).textContent =
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


  /*
   * Also refresh comment author profile.
   */
  if (comment.authorId) {

    getUserProfile(
      comment.authorId
    ).then(
      (profile) => {

        if (!profile) {
          return;
        }


        const fullName =
          profile.fullName ||
          name;


        author.textContent =
          fullName;


        ctx.applyMediaBackground(
          avatar,
          profile.photoURL ||
            comment.authorPhotoURL ||
            '',
          ctx.initialsFrom(
            fullName
          )
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


    snapshot.forEach(
      (replyDoc) => {

        repliesListEl.appendChild(
          buildReplyItem(
            {
              id:
                replyDoc.id,

              ...replyDoc.data()
            }
          )
        );
      }
    );

  } catch (error) {

    console.error(
      'Error loading replies:',
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


      <div
        class="comment-text"
      ></div>

    </div>

  `;


  const name =
    reply.authorName ||
    'VitalStar Member';


  ctx.applyMediaBackground(
    item.querySelector(
      '.comment-avatar'
    ),
    reply.authorPhotoURL || '',
    ctx.initialsFrom(name)
  );


  item.querySelector(
    '.comment-author'
  ).textContent =
    name;


  item.querySelector(
    '.comment-text'
  ).textContent =
    reply.text || '';


  /*
   * Refresh reply author profile.
   */
  if (reply.authorId) {

    getUserProfile(
      reply.authorId
    ).then(
      (profile) => {

        if (!profile) {
          return;
        }


        const fullName =
          profile.fullName ||
          name;


        item.querySelector(
          '.comment-author'
        ).textContent =
          fullName;


        ctx.applyMediaBackground(
          item.querySelector(
            '.comment-avatar'
          ),
          profile.photoURL ||
            reply.authorPhotoURL ||
            '',
          ctx.initialsFrom(
            fullName
          )
        );
      }
    );
  }


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

    const postsRef =
      collection(
        ctx.db,
        'groups',
        ctx.groupId,
        'posts'
      );


    const authorName =
      ctx.currentUser.fullName ||
      ctx.currentUser.displayName ||
      'VitalStar Member';


    await addDoc(
      postsRef,
      {

        authorId:
          ctx.currentUser.uid,

        authorName,

        authorPhotoURL:
          ctx.currentUser.photoURL ||
          '',

        authorRole:
          currentUserRole() ||
          'member',

        text: '',

        mediaURL:
          post.mediaURL ||
          '',

        mediaType:
          post.mediaType ||
          'none',

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
          post.text ||
          '',

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


    try {

      await updateDoc(
        ctx.groupRef,
        {
          postCount:
            increment(1)
        }
      );

      ctx.refreshHeaderStats();

    } catch (error) {

      console.warn(
        'Could not update group postCount:',
        error
      );
    }


    ctx.showToast(
      'Reposted to the group feed.',
      'success'
    );


    await loadPosts(true);

  } catch (error) {

    console.error(
      'Error reposting:',
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
    `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(
      ctx.groupId
    )}&post=${encodeURIComponent(
      post.id
    )}`;


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

          text:
            post.text
              ? post.text.substring(
                  0,
                  100
                )
              : 'View this post on VitalStar',

          url
        }
      );

    } else {

      await navigator.clipboard.writeText(
        url
      );


      ctx.showToast(
        'Link copied to clipboard.',
        'success'
      );
    }

  } catch (error) {

    if (
      error?.name !==
      'AbortError'
    ) {

      console.error(
        'Error sharing post:',
        error
      );
    }
  }
}