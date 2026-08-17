import {
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  increment,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// CLOUDINARY
// ============================================================

const CLOUDINARY_CLOUD_NAME = "m0scmqqv";
const CLOUDINARY_UPLOAD_PRESET = "vitalstar_upload";

async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file selected.");

  const type = file.type.startsWith("video/")
    ? "video"
    : "image";

  const url =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`;

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      body: form
    });
  } catch (error) {
    console.error("Cloudinary network error:", error);

    throw new Error(
      "Cloudinary connection failed. Check your internet connection."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Cloudinary returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    console.error("Cloudinary upload failed:", data);

    throw new Error(
      data?.error?.message ||
      `Cloudinary upload failed (${response.status}).`
    );
  }

  if (!data.secure_url) {
    throw new Error("Cloudinary did not return a media URL.");
  }

  return {
    url: data.secure_url,
    type
  };
}

// Converts Cloudinary videos to MP4 for better mobile compatibility.
function getPlayableVideoUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname.includes("res.cloudinary.com") &&
      parsed.pathname.includes("/video/upload/")
    ) {
      const marker = "/video/upload/";
      const index = parsed.pathname.indexOf(marker);

      if (index !== -1) {
        const before =
          parsed.pathname.slice(0, index + marker.length);

        const after =
          parsed.pathname.slice(index + marker.length);

        if (!after.startsWith("f_mp4/")) {
          parsed.pathname =
            before + "f_mp4/" + after;
        }

        return parsed.toString();
      }
    }
  } catch (error) {
    console.warn(
      "Could not transform video URL:",
      error
    );
  }

  return url;
}

// ============================================================
// STATE
// ============================================================

const POSTS_PAGE_SIZE = 10;
const POSTS_STYLE_ID = "vs-group-posts-styles";

let ctx = null;
let state = null;

const profileCache = new Map();

// ============================================================
// GROUP NOTIFICATIONS
// ============================================================

/*
 * All group notifications are stored in:
 *
 * notifications
 *
 * Expected notification structure:
 *
 * {
 *   receiverId,
 *   senderId,
 *   senderName,
 *   senderPhotoURL,
 *   groupId,
 *   groupName,
 *   postId,
 *   commentId,
 *   type,
 *   message,
 *   read,
 *   createdAt
 * }
 */

function getGroupName() {
  return (
    ctx?.groupName ||
    ctx?.group?.name ||
    ctx?.groupData?.name ||
    ctx?.group?.groupName ||
    "your group"
  );
}

async function createGroupNotification({
  receiverId,
  type,
  message,
  postId = null,
  commentId = null
}) {
  try {
    if (!receiverId) return;

    // Never notify yourself.
    if (
      receiverId ===
      ctx.currentUser.uid
    ) {
      return;
    }

    const senderProfile =
      await getUserProfile(
        ctx.currentUser.uid
      );

    await addDoc(
      collection(
        ctx.db,
        "notifications"
      ),
      {
        receiverId,

        senderId:
          ctx.currentUser.uid,

        senderName:
          senderProfile.fullName ||
          ctx.currentUser.displayName ||
          "VitalStar User",

        senderPhotoURL:
          senderProfile.photoURL ||
          "",

        groupId:
          ctx.groupId,

        groupName:
          getGroupName(),

        postId:
          postId || null,

        commentId:
          commentId || null,

        type,

        message,

        read: false,

        createdAt:
          serverTimestamp()
      }
    );

  } catch (error) {
    /*
     * Notification failure should NEVER break
     * the actual action such as liking/commenting.
     */
    console.error(
      "Could not create group notification:",
      error
    );
  }
}

// ============================================================
// USER PROFILE
// ============================================================

async function getUserProfile(uid) {
  if (!uid) {
    return {
      fullName: "VitalStar User",
      photoURL: ""
    };
  }

  if (profileCache.has(uid)) {
    return profileCache.get(uid);
  }

  try {
    const snap =
      await getDoc(
        doc(
          ctx.db,
          "users",
          uid
        )
      );

    if (!snap.exists()) {
      const fallback = {
        fullName: "VitalStar User",
        photoURL: ""
      };

      profileCache.set(
        uid,
        fallback
      );

      return fallback;
    }

    const data =
      snap.data();

    const profile = {
      fullName:
        data.fullName ||
        data.displayName ||
        data.name ||
        "VitalStar User",

      photoURL:
        data.photoURL ||
        data.profilePicture ||
        data.profilePic ||
        data.profileImage ||
        data.avatar ||
        data.image ||
        ""
    };

    profileCache.set(
      uid,
      profile
    );

    return profile;

  } catch (error) {
    console.error(
      "Could not load user profile:",
      error
    );

    return {
      fullName: "VitalStar User",
      photoURL: ""
    };
  }
}

function getInitials(name) {
  if (!name) return "U";

  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        x =>
          x
            .charAt(0)
            .toUpperCase()
      )
      .join("") || "U"
  );
}

function authorProfileHref(uid) {
  return uid
    ? `profile.html?uid=${encodeURIComponent(uid)}`
    : "#";
}

function setAvatarBackground(
  element,
  photoURL,
  name
) {
  element.textContent =
    getInitials(name);

  if (!photoURL) return;

  element.style.backgroundImage =
    `url("${photoURL}")`;

  element.style.backgroundSize =
    "cover";

  element.style.backgroundPosition =
    "center";
}

// ============================================================
// STYLES
// ============================================================

function injectStyles() {
  if (
    document.getElementById(
      POSTS_STYLE_ID
    )
  ) return;

  const style =
    document.createElement(
      "style"
    );

  style.id =
    POSTS_STYLE_ID;

  style.textContent = `
    .composer {
      border-radius:22px;
      background:#fff;
      border:1px solid rgba(0,0,0,.08);
      padding:16px 18px;
      margin-bottom:20px;
    }

    .composer__top {
      display:flex;
      gap:12px;
      align-items:flex-start;
    }

    .composer__avatar,
    .post-card__avatar,
    .comment-avatar {
      background:linear-gradient(135deg,#315fff,#7c4dff)
        center/cover;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-weight:700;
      text-decoration:none;
      overflow:hidden;
      flex-shrink:0;
    }

    .composer__avatar {
      width:40px;
      height:40px;
      border-radius:50%;
      font-size:15px;
    }

    .composer__input {
      flex:1;
      min-height:42px;
      max-height:220px;
      resize:none;
      background:#f5f6f8;
      border:1px solid rgba(0,0,0,.1);
      border-radius:12px;
      padding:11px 14px;
      color:#1a1d29;
      font-size:14px;
      outline:none;
    }

    .composer__input:focus {
      border-color:#315fff;
    }

    .composer__input::placeholder {
      color:#9aa0ac;
    }

    .composer__media-preview {
      margin-top:12px;
      position:relative;
      display:none;
      border-radius:14px;
      overflow:hidden;
      background:#000;
    }

    .composer__media-preview.is-visible {
      display:block;
    }

    .composer__media-preview img,
    .composer__media-preview video {
      width:100%;
      max-height:420px;
      object-fit:contain;
      display:block;
      background:#000;
    }

    .composer__media-remove {
      position:absolute;
      top:10px;
      right:10px;
      z-index:5;
      width:32px;
      height:32px;
      border-radius:50%;
      background:rgba(0,0,0,.75);
      border:0;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    }

    .composer__bottom {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-top:12px;
    }

    .composer__tools {
      display:flex;
      gap:8px;
    }

    .composer__tool-btn {
      width:40px;
      height:40px;
      border-radius:12px;
      background:#f5f6f8;
      border:1px solid rgba(0,0,0,.1);
      color:#5a6070;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
    }

    .composer__post-btn {
      padding:10px 22px;
      border-radius:999px;
      border:0;
      background:linear-gradient(135deg,#315fff,#7c4dff);
      color:#fff;
      font-weight:700;
      cursor:pointer;
    }

    .composer__post-btn:disabled {
      opacity:.5;
      cursor:default;
    }

    .composer-join-notice {
      display:flex;
      align-items:center;
      gap:10px;
      padding:14px 16px;
      border-radius:18px;
      background:rgba(47,111,255,.07);
      border:1px solid rgba(47,111,255,.18);
      color:#4a5568;
      font-size:13px;
      margin-bottom:20px;
    }

    .post-card {
      border-radius:22px;
      background:#fff;
      border:1px solid rgba(0,0,0,.08);
      padding:16px 18px;
      margin-bottom:16px;
      overflow:hidden;
    }

    .post-card.is-pinned {
      border-color:rgba(255,194,75,.55);
    }

    .post-card__pin-flag {
      display:none;
      align-items:center;
      gap:6px;
      font-size:11.5px;
      color:#d69e00;
      font-weight:700;
      margin-bottom:10px;
    }

    .post-card.is-pinned .post-card__pin-flag {
      display:flex;
    }

    .post-card__head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
    }

    .post-card__author {
      display:flex;
      gap:10px;
      min-width:0;
      align-items:center;
    }

    .post-card__avatar {
      width:44px;
      height:44px;
      border-radius:50%;
      font-size:15px;
    }

    .post-card__author-info {
      min-width:0;
    }

    .post-card__author-name-row {
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
    }

    .post-card__author-name,
    .comment-author,
    .repost-original__author {
      color:#e2aa00 !important;
      font-weight:800;
      text-decoration:none;
    }

    .post-card__author-name {
      font-size:14px;
    }

    .post-card__meta {
      font-size:11.5px;
      color:#8a90a0;
      margin-top:2px;
    }

    .role-chip {
      font-size:10px;
      font-weight:700;
      padding:3px 8px;
      border-radius:999px;
      background:rgba(139,92,255,.12);
      color:#8b5cff;
      text-transform:capitalize;
    }

    .post-card__text {
      font-size:14px;
      color:#1a1d29;
      line-height:1.6;
      margin:12px 0 0;
      white-space:pre-wrap;
      word-break:break-word;
    }

    .post-card__media {
      margin-top:12px;
      border-radius:14px;
      overflow:hidden;
      background:#000;
      width:100%;
    }

    .post-card__media img,
    .post-card__media video {
      width:100%;
      max-height:500px;
      object-fit:contain;
      display:block;
      background:#000;
    }

    .post-card__menu-wrap {
      position:relative;
    }

    .post-card__menu-btn {
      width:34px;
      height:34px;
      border-radius:50%;
      border:0;
      background:none;
      color:#8a90a0;
      cursor:pointer;
    }

    .post-card__menu {
      display:none;
      position:absolute;
      top:38px;
      right:0;
      z-index:50;
      background:#fff;
      border:1px solid rgba(0,0,0,.1);
      border-radius:14px;
      box-shadow:0 8px 25px rgba(0,0,0,.15);
      overflow:hidden;
      min-width:170px;
    }

    .post-card__menu.is-open {
      display:block;
    }

    .post-card__menu button {
      display:flex;
      align-items:center;
      gap:9px;
      width:100%;
      padding:11px 14px;
      background:none;
      border:0;
      color:#4a5568;
      font-size:13px;
      text-align:left;
      cursor:pointer;
    }

    .post-card__actions {
      display:flex;
      gap:6px;
      margin-top:14px;
      padding-top:12px;
      border-top:1px solid rgba(0,0,0,.08);
    }

    .post-action-btn {
      flex:1;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:7px;
      padding:9px;
      border-radius:10px;
      border:0;
      background:none;
      color:#6a7080;
      font-size:12.5px;
      font-weight:600;
      cursor:pointer;
    }

    .post-action-btn.is-liked {
      color:#e63946;
    }

    .comments-section {
      display:none;
      margin-top:14px;
      padding-top:14px;
      border-top:1px solid rgba(0,0,0,.08);
    }

    .comments-section.is-open {
      display:block;
    }

    .comment-composer,
    .reply-composer {
      display:flex;
      gap:8px;
      margin-bottom:12px;
    }

    .reply-composer {
      margin-left:16px;
      margin-top:8px;
    }

    .comment-input {
      flex:1;
      background:#f5f6f8;
      border:1px solid rgba(0,0,0,.1);
      border-radius:999px;
      padding:9px 15px;
      color:#1a1d29;
      font-size:13px;
      outline:none;
    }

    .comment-send-btn {
      width:36px;
      height:36px;
      border-radius:50%;
      border:0;
      background:#315fff;
      color:#fff;
      cursor:pointer;
      flex-shrink:0;
    }

    .comment-item {
      display:flex;
      gap:9px;
      margin-bottom:12px;
    }

    .comment-avatar {
      width:32px;
      height:32px;
      border-radius:50%;
      font-size:11px;
    }

    .comment-bubble {
      background:#f5f6f8;
      border-radius:14px;
      padding:8px 12px;
      flex:1;
    }

    .comment-author {
      font-size:12.5px;
    }

    .comment-text {
      font-size:13px;
      color:#4a5568;
      margin-top:2px;
      line-height:1.45;
      word-break:break-word;
    }

    .comment-footer {
      margin-top:5px;
    }

    .comment-reply-btn {
      font-size:11.5px;
      color:#8a90a0;
      background:none;
      border:0;
      font-weight:600;
      cursor:pointer;
    }

    .replies-list {
      margin-top:8px;
      margin-left:16px;
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .repost-banner {
      display:flex;
      align-items:center;
      gap:6px;
      font-size:12px;
      color:#8a90a0;
      font-weight:700;
      margin-bottom:6px;
    }

    .repost-original {
      margin-top:10px;
      padding:10px 12px;
      border-radius:12px;
      background:#f5f6f8;
      border:1px solid rgba(0,0,0,.08);
    }

    .repost-original__author {
      font-size:12.5px;
    }

    .repost-original__text {
      font-size:13px;
      color:#4a5568;
      margin-top:2px;
    }

    .load-more-posts-btn {
      display:block;
      width:100%;
      margin-top:6px;
      padding:11px;
      border-radius:12px;
      background:#f5f6f8;
      border:1px solid rgba(0,0,0,.1);
      color:#1a1d29;
      font-weight:600;
      font-size:13px;
      cursor:pointer;
    }

    .posts-empty {
      text-align:center;
      padding:50px 20px;
      color:#8a90a0;
    }

    .posts-empty i {
      font-size:30px;
      color:#315fff;
      opacity:.7;
      margin-bottom:12px;
      display:block;
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
    previewObjectURL: null
  };

  ctx.panelEl.innerHTML = "";

  renderComposer();

  const feed =
    document.createElement("div");

  feed.id =
    "postsFeedList";

  ctx.panelEl.appendChild(feed);

  const more =
    document.createElement("button");

  more.id =
    "loadMorePostsBtn";

  more.className =
    "load-more-posts-btn";

  more.textContent =
    "Load more posts";

  more.style.display =
    "none";

  more.onclick =
    () => loadPosts(false);

  ctx.panelEl.appendChild(more);

  await loadPosts(true);
}

// ============================================================
// MEMBERSHIP
// ============================================================

function isActiveMember() {
  return (
    ctx.membership?.status ===
    "active"
  );
}

function currentUserRole() {
  return (
    ctx.membership?.role ||
    null
  );
}

function canModeratePosts() {
  const role =
    currentUserRole();

  return (
    role === "owner" ||
    role === "admin" ||
    role === "moderator"
  );
}

// ============================================================
// COMPOSER
// ============================================================

function renderComposer() {
  if (!isActiveMember()) {
    const notice =
      document.createElement("div");

    notice.className =
      "composer-join-notice";

    notice.innerHTML = `
      <i class="fa-solid fa-circle-info"></i>
      <span>Join this group to post, like, and comment.</span>
    `;

    ctx.panelEl.appendChild(
      notice
    );

    return;
  }

  const wrap =
    document.createElement("div");

  wrap.className =
    "composer";

  wrap.innerHTML = `
    <div class="composer__top">

      <a
        class="post-author-link composer__avatar"
        id="composerAvatar"
        href="${authorProfileHref(ctx.currentUser.uid)}"
      >
        ${getInitials(ctx.currentUser.displayName)}
      </a>

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
          accept="image/*"
          hidden
        >

        <input
          type="file"
          id="composerVideoInput"
          accept="video/*"
          hidden
        >

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

  loadComposerProfile(
    wrap.querySelector(
      "#composerAvatar"
    )
  );

  const input =
    wrap.querySelector(
      "#composerInput"
    );

  const postBtn =
    wrap.querySelector(
      "#composerPostBtn"
    );

  input.addEventListener(
    "input",
    () => {
      input.style.height =
        "auto";

      input.style.height =
        `${Math.min(
          input.scrollHeight,
          220
        )}px`;

      updatePostButtonState();
    }
  );

  wrap.querySelector(
    "#composerImageBtn"
  ).onclick = () =>
    wrap.querySelector(
      "#composerImageInput"
    ).click();

  wrap.querySelector(
    "#composerVideoBtn"
  ).onclick = () =>
    wrap.querySelector(
      "#composerVideoInput"
    ).click();

  wrap.querySelector(
    "#composerImageInput"
  ).onchange =
    e =>
      handleComposerMediaSelect(
        e,
        "image"
      );

  wrap.querySelector(
    "#composerVideoInput"
  ).onchange =
    e =>
      handleComposerMediaSelect(
        e,
        "video"
      );

  postBtn.onclick =
    () => submitPost(wrap);
}

async function loadComposerProfile(
  avatar
) {
  const profile =
    await getUserProfile(
      ctx.currentUser.uid
    );

  setAvatarBackground(
    avatar,
    profile.photoURL,
    profile.fullName
  );
}

// ============================================================
// MEDIA SELECT
// ============================================================

function handleComposerMediaSelect(
  event,
  type
) {
  const file =
    event.target.files?.[0];

  if (!file) return;

  if (
    type === "image" &&
    !file.type.startsWith("image/")
  ) {
    ctx.showToast(
      "Please select a valid photo.",
      "error"
    );

    event.target.value =
      "";

    return;
  }

  if (
    type === "video" &&
    !file.type.startsWith("video/")
  ) {
    ctx.showToast(
      "Please select a valid video.",
      "error"
    );

    event.target.value =
      "";

    return;
  }

  /*
   * No artificial file-size restriction here.
   *
   * Cloudinary will determine the actual maximum
   * allowed size for your account/upload preset.
   */

  state.pendingMediaFile =
    file;

  state.pendingMediaType =
    type;

  const preview =
    document.getElementById(
      "composerMediaPreview"
    );

  if (state.previewObjectURL) {
    URL.revokeObjectURL(
      state.previewObjectURL
    );
  }

  const objectURL =
    URL.createObjectURL(file);

  state.previewObjectURL =
    objectURL;

  preview.innerHTML =
    "";

  if (type === "image") {
    const img =
      document.createElement(
        "img"
      );

    img.src =
      objectURL;

    img.alt =
      "Selected photo";

    preview.appendChild(img);

  } else {
    const video =
      document.createElement(
        "video"
      );

    video.src =
      objectURL;

    video.controls =
      true;

    video.playsInline =
      true;

    video.preload =
      "metadata";

    preview.appendChild(
      video
    );
  }

  const remove =
    document.createElement(
      "button"
    );

  remove.type =
    "button";

  remove.className =
    "composer__media-remove";

  remove.innerHTML =
    '<i class="fa-solid fa-xmark"></i>';

  remove.onclick =
    clearSelectedMedia;

  preview.appendChild(
    remove
  );

  preview.classList.add(
    "is-visible"
  );

  updatePostButtonState();
}

// ============================================================
// CLEAR MEDIA
// ============================================================

function clearSelectedMedia() {
  state.pendingMediaFile =
    null;

  state.pendingMediaType =
    null;

  if (state.previewObjectURL) {
    URL.revokeObjectURL(
      state.previewObjectURL
    );

    state.previewObjectURL =
      null;
  }

  const preview =
    document.getElementById(
      "composerMediaPreview"
    );

  if (preview) {
    preview.innerHTML =
      "";

    preview.classList.remove(
      "is-visible"
    );
  }

  const imageInput =
    document.getElementById(
      "composerImageInput"
    );

  const videoInput =
    document.getElementById(
      "composerVideoInput"
    );

  if (imageInput)
    imageInput.value =
      "";

  if (videoInput)
    videoInput.value =
      "";

  updatePostButtonState();
}

// ============================================================
// POST BUTTON
// ============================================================

function updatePostButtonState() {
  const input =
    document.getElementById(
      "composerInput"
    );

  const button =
    document.getElementById(
      "composerPostBtn"
    );

  if (!input || !button)
    return;

  button.disabled =
    !input.value.trim() &&
    !state.pendingMediaFile;
}

// ============================================================
// CREATE POST
// ============================================================

async function submitPost(
  composerEl
) {
  const input =
    composerEl.querySelector(
      "#composerInput"
    );

  const postBtn =
    composerEl.querySelector(
      "#composerPostBtn"
    );

  const text =
    input.value.trim();

  if (
    !text &&
    !state.pendingMediaFile
  ) {
    ctx.showToast(
      "Write something or choose a photo/video.",
      "error"
    );

    return;
  }

  postBtn.disabled =
    true;

  postBtn.textContent =
    "Posting...";

  try {
    const profile =
      await getUserProfile(
        ctx.currentUser.uid
      );

    let mediaURL =
      "";

    let mediaType =
      "none";

    if (state.pendingMediaFile) {
      postBtn.textContent =
        "Uploading...";

      const result =
        await uploadToCloudinary(
          state.pendingMediaFile
        );

      mediaURL =
        result.url;

      mediaType =
        result.type;
    }

    await addDoc(
      collection(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts"
      ),
      {
        authorId:
          ctx.currentUser.uid,

        authorName:
          profile.fullName ||
          "VitalStar User",

        authorPhotoURL:
          profile.photoURL ||
          "",

        authorRole:
          currentUserRole() ||
          "member",

        text,

        mediaURL,

        mediaType,

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
          null,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
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

    input.value =
      "";

    input.style.height =
      "auto";

    clearSelectedMedia();

    ctx.showToast(
      "Post created successfully!",
      "success"
    );

    await loadPosts(true);

  } catch (error) {
    console.error(
      "Error creating post:",
      error
    );

    ctx.showToast(
      error.message ||
      "Could not publish your post.",
      "error"
    );

  } finally {
    postBtn.textContent =
      "Post";

    updatePostButtonState();
  }
}

// ============================================================
// LOAD POSTS
// ============================================================

async function loadPosts(reset) {
  if (state.isLoadingMore)
    return;

  state.isLoadingMore =
    true;

  const feed =
    document.getElementById(
      "postsFeedList"
    );

  const more =
    document.getElementById(
      "loadMorePostsBtn"
    );

  if (!feed) {
    state.isLoadingMore =
      false;

    return;
  }

  if (reset) {
    state.lastVisibleDoc =
      null;

    feed.innerHTML = `
      <div class="tab-panel-placeholder">
        <span class="spinner-sm"></span>
        Loading posts...
      </div>
    `;
  }

  try {
    const constraints = [
      orderBy(
        "isPinned",
        "desc"
      ),

      orderBy(
        "createdAt",
        "desc"
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

    const snapshot =
      await getDocs(
        query(
          collection(
            ctx.db,
            "groups",
            ctx.groupId,
            "posts"
          ),
          ...constraints
        )
      );

    if (reset)
      feed.innerHTML =
        "";

    if (
      snapshot.docs.length
    ) {
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
      feed.innerHTML = `
        <div class="posts-empty">
          <i class="fa-solid fa-note-sticky"></i>
          <p>No posts yet. Be the first to share something!</p>
        </div>
      `;
    } else {
      snapshot.forEach(
        postDoc => {
          feed.appendChild(
            renderPostCard({
              id:
                postDoc.id,

              ...postDoc.data()
            })
          );
        }
      );
    }

    if (more) {
      more.style.display =
        state.hasMore
          ? "block"
          : "none";
    }

  } catch (error) {
    console.error(
      "Error loading posts:",
      error
    );

    if (reset) {
      feed.innerHTML = `
        <div class="posts-empty">
          <p>Could not load posts right now.</p>
        </div>
      `;
    }

    ctx.showToast(
      "Could not load posts.",
      "error"
    );

  } finally {
    state.isLoadingMore =
      false;
  }
}

// ============================================================
// RENDER POST
// ============================================================

function renderPostCard(post) {
  const card =
    document.createElement(
      "div"
    );

  card.className =
    `post-card${
      post.isPinned
        ? " is-pinned"
        : ""
    }`;

  card.dataset.postId =
    post.id;

  const isAuthor =
    post.authorId ===
    ctx.currentUser.uid;

  const moderator =
    canModeratePosts();

  const timeLabel =
    post.createdAt?.toDate
      ? timeAgo(
          post.createdAt.toDate()
        )
      : "just now";

  const href =
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
          href="${href}"
        >
          ${getInitials(post.authorName)}
        </a>

        <div class="post-card__author-info">

          <div class="post-card__author-name-row">

            <a
              class="post-author-link post-card__author-name"
              href="${href}"
            ></a>

            ${
              post.authorRole &&
              post.authorRole !== "member"
                ? `
                  <span class="role-chip">
                    ${escapeHtml(
                      post.authorRole
                    )}
                  </span>
                `
                : ""
            }

          </div>

          <div class="post-card__meta">
            ${timeLabel}
            ${
              post.isEdited
                ? " · edited"
                : ""
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
              : ""
          }

          ${
            isAuthor || moderator
              ? `
                <button
                  type="button"
                  class="delete-post-btn"
                >
                  <i class="fa-solid fa-trash"></i>
                  Delete
                </button>
              `
              : ""
          }

          ${
            moderator
              ? `
                <button
                  type="button"
                  class="pin-post-btn"
                >
                  <i class="fa-solid fa-thumbtack"></i>
                  ${
                    post.isPinned
                      ? "Unpin"
                      : "Pin"
                  } post
                </button>
              `
              : ""
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
              : ""
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

  const name =
    post.authorName ||
    "VitalStar User";

  const avatar =
    card.querySelector(
      ".post-card__avatar"
    );

  setAvatarBackground(
    avatar,
    post.authorPhotoURL,
    name
  );

  card.querySelector(
    ".post-card__author-name"
  ).textContent =
    name;

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

  refreshPostAuthor(
    card,
    post
  );

  return card;
}

// ============================================================
// REFRESH AUTHOR
// ============================================================

async function refreshPostAuthor(
  card,
  post
) {
  if (!post.authorId)
    return;

  try {
    const profile =
      await getUserProfile(
        post.authorId
      );

    const name =
      profile.fullName ||
      post.authorName ||
      "VitalStar User";

    const nameEl =
      card.querySelector(
        ".post-card__author-name"
      );

    const avatar =
      card.querySelector(
        ".post-card__avatar"
      );

    if (nameEl) {
      nameEl.textContent =
        name;
    }

    if (avatar) {
      setAvatarBackground(
        avatar,
        profile.photoURL ||
          post.authorPhotoURL ||
          "",
        name
      );
    }

    post.authorName =
      name;

    post.authorPhotoURL =
      profile.photoURL ||
      post.authorPhotoURL ||
      "";

  } catch (error) {
    console.error(
      "Could not refresh author:",
      error
    );
  }
}

// ============================================================
// POST BODY
// ============================================================

function renderPostBody(
  card,
  post
) {
  const body =
    card.querySelector(
      ".post-card__body"
    );

  body.innerHTML =
    "";

  if (post.repostOf) {
    const banner =
      document.createElement(
        "div"
      );

    banner.className =
      "repost-banner";

    banner.innerHTML = `
      <i class="fa-solid fa-retweet"></i>
      Reposted
    `;

    body.appendChild(
      banner
    );
  }

  if (post.text) {
    const text =
      document.createElement(
        "p"
      );

    text.className =
      "post-card__text";

    text.textContent =
      post.text;

    body.appendChild(
      text
    );
  }

  if (post.mediaURL) {
    const media =
      document.createElement(
        "div"
      );

    media.className =
      "post-card__media";

    if (
      post.mediaType ===
      "video"
    ) {
      const video =
        document.createElement(
          "video"
        );

      video.controls =
        true;

      video.playsInline =
        true;

      video.preload =
        "metadata";

      const source =
        document.createElement(
          "source"
        );

      source.src =
        getPlayableVideoUrl(
          post.mediaURL
        );

      source.type =
        "video/mp4";

      video.appendChild(
        source
      );

      video.onerror =
        () => {
          console.error(
            "Video playback failed:",
            post.mediaURL
          );
        };

      media.appendChild(
        video
      );

    } else {
      const image =
        document.createElement(
          "img"
        );

      image.src =
        post.mediaURL;

      image.alt =
        "Post image";

      image.loading =
        "lazy";

      image.decoding =
        "async";

      media.appendChild(
        image
      );
    }

    body.appendChild(
      media
    );
  }

  if (post.repostOf) {
    const original =
      document.createElement(
        "div"
      );

    original.className =
      "repost-original";

    original.innerHTML = `
      <div class="repost-original__author"></div>
      <div class="repost-original__text"></div>
    `;

    original.querySelector(
      ".repost-original__author"
    ).textContent =
      post.repostOfAuthorName ||
      "VitalStar User";

    original.querySelector(
      ".repost-original__text"
    ).textContent =
      post.repostOfText ||
      "";

    body.appendChild(
      original
    );
  }
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
      ".post-card__menu-btn"
    );

  const menu =
    card.querySelector(
      ".post-card__menu"
    );

  menuBtn.onclick =
    event => {
      event.stopPropagation();

      document
        .querySelectorAll(
          ".post-card__menu.is-open"
        )
        .forEach(x => {
          if (x !== menu) {
            x.classList.remove(
              "is-open"
            );
          }
        });

      menu.classList.toggle(
        "is-open"
      );
    };

  card.querySelector(
    ".edit-post-btn"
  )?.addEventListener(
    "click",
    () =>
      startEditPost(
        card,
        post
      )
  );

  card.querySelector(
    ".delete-post-btn"
  )?.addEventListener(
    "click",
    () =>
      deletePost(
        card,
        post
      )
  );

  card.querySelector(
    ".pin-post-btn"
  )?.addEventListener(
    "click",
    () =>
      togglePinPost(
        post
      )
  );

  card.querySelector(
    ".report-post-btn"
  )?.addEventListener(
    "click",
    () =>
      reportPost(
        post
      )
  );

  card.querySelector(
    ".like-btn"
  ).onclick =
    () =>
      toggleLike(
        card,
        post
      );

  card.querySelector(
    ".comment-toggle-btn"
  ).onclick =
    () =>
      toggleComments(
        card,
        post
      );

  card.querySelector(
    ".repost-btn"
  ).onclick =
    () =>
      repostPost(
        post
      );

  card.querySelector(
    ".share-btn"
  ).onclick =
    () =>
      sharePost(
        post
      );
}

if (
  !window.__vitalstarGroupPostMenuHandler
) {
  window.__vitalstarGroupPostMenuHandler =
    true;

  document.addEventListener(
    "click",
    () => {
      document
        .querySelectorAll(
          ".post-card__menu.is-open"
        )
        .forEach(menu => {
          menu.classList.remove(
            "is-open"
          );
        });
    }
  );
}

// ============================================================
// TIME
// ============================================================

function timeAgo(date) {
  const seconds =
    Math.floor(
      (Date.now() -
        date.getTime()) /
        1000
    );

  if (seconds < 60)
    return "just now";

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60)
    return `${minutes}m ago`;

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24)
    return `${hours}h ago`;

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7)
    return `${days}d ago`;

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric"
    }
  );
}

function escapeHtml(value) {
  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    String(value ?? "");

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
      ".post-card__body"
    );

  const oldText =
    post.text || "";

  const wrap =
    document.createElement(
      "div"
    );

  wrap.innerHTML = `
    <textarea
      class="post-card__edit-textarea"
      style="
        width:100%;
        min-height:90px;
        padding:10px;
        border-radius:12px;
        border:1px solid #315fff;
        resize:vertical;
      "
    ></textarea>

    <div
      style="
        display:flex;
        gap:8px;
        margin-top:8px;
      "
    >

      <button
        type="button"
        class="save-btn"
        style="
          padding:8px 15px;
          border:0;
          border-radius:999px;
          background:#315fff;
          color:white;
          font-weight:600;
        "
      >
        Save
      </button>

      <button
        type="button"
        class="cancel-btn"
        style="
          padding:8px 15px;
          border:1px solid #ddd;
          border-radius:999px;
          background:#f5f6f8;
        "
      >
        Cancel
      </button>

    </div>
  `;

  wrap.querySelector(
    "textarea"
  ).value =
    oldText;

  const textEl =
    body.querySelector(
      ".post-card__text"
    );

  if (textEl) {
    textEl.replaceWith(
      wrap
    );
  } else {
    body.prepend(
      wrap
    );
  }

  wrap.querySelector(
    ".cancel-btn"
  ).onclick =
    () =>
      renderPostBody(
        card,
        post
      );

  wrap.querySelector(
    ".save-btn"
  ).onclick =
    async () => {
      const text =
        wrap.querySelector(
          "textarea"
        ).value.trim();

      try {
        await updateDoc(
          doc(
            ctx.db,
            "groups",
            ctx.groupId,
            "posts",
            post.id
          ),
          {
            text,

            isEdited:
              true,

            updatedAt:
              serverTimestamp()
          }
        );

        post.text =
          text;

        post.isEdited =
          true;

        renderPostBody(
          card,
          post
        );

        ctx.showToast(
          "Post updated.",
          "success"
        );

      } catch (error) {
        console.error(
          "Error updating post:",
          error
        );

        ctx.showToast(
          "Could not update the post.",
          "error"
        );
      }
    };
}

// ============================================================
// DELETE
// ============================================================

async function deletePost(
  card,
  post
) {
  if (
    !window.confirm(
      "Delete this post? This cannot be undone."
    )
  ) return;

  try {
    await deleteDoc(
      doc(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts",
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
      "Post deleted.",
      "info"
    );

  } catch (error) {
    console.error(
      "Error deleting post:",
      error
    );

    ctx.showToast(
      "Could not delete the post.",
      "error"
    );
  }
}

// ============================================================
// PIN
// ============================================================

async function togglePinPost(
  post
) {
  try {
    await updateDoc(
      doc(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts",
        post.id
      ),
      {
        isPinned:
          !post.isPinned
      }
    );

    ctx.showToast(
      post.isPinned
        ? "Post unpinned."
        : "Post pinned to the top.",
      "success"
    );

    await loadPosts(
      true
    );

  } catch (error) {
    console.error(
      "Error changing pin:",
      error
    );

    ctx.showToast(
      "Could not update the pin status.",
      "error"
    );
  }
}

// ============================================================
// REPORT
// ============================================================

async function reportPost(
  post
) {
  const reason =
    window.prompt(
      "Why are you reporting this post?"
    );

  if (!reason?.trim())
    return;

  try {
    await addDoc(
      collection(
        ctx.db,
        "reports"
      ),
      {
        type:
          "post",

        groupId:
          ctx.groupId,

        targetId:
          post.id,

        reporterId:
          ctx.currentUser.uid,

        reason:
          reason.trim(),

        status:
          "pending",

        createdAt:
          serverTimestamp()
      }
    );

    ctx.showToast(
      "Post reported.",
      "success"
    );

  } catch (error) {
    console.error(
      "Error reporting post:",
      error
    );

    ctx.showToast(
      "Could not submit the report.",
      "error"
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
    const snap =
      await getDoc(
        doc(
          ctx.db,
          "groups",
          ctx.groupId,
          "posts",
          postId,
          "likes",
          ctx.currentUser.uid
        )
      );

    const button =
      card.querySelector(
        ".like-btn"
      );

    if (!button)
      return;

    if (snap.exists()) {
      button.classList.add(
        "is-liked"
      );

      button.querySelector(
        "i"
      ).className =
        "fa-solid fa-heart";
    }

  } catch (error) {
    console.error(
      "Error checking like:",
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
      "Join this group to like posts.",
      "info"
    );

    return;
  }

  const button =
    card.querySelector(
      ".like-btn"
    );

  const count =
    button.querySelector(
      ".like-count"
    );

  const liked =
    button.classList.contains(
      "is-liked"
    );

  const postRef =
    doc(
      ctx.db,
      "groups",
      ctx.groupId,
      "posts",
      post.id
    );

  const likeRef =
    doc(
      ctx.db,
      "groups",
      ctx.groupId,
      "posts",
      post.id,
      "likes",
      ctx.currentUser.uid
    );

  button.classList.toggle(
    "is-liked"
  );

  button.querySelector(
    "i"
  ).className =
    liked
      ? "fa-regular fa-heart"
      : "fa-solid fa-heart";

  const newCount =
    Math.max(
      0,
      (post.likesCount || 0) +
        (liked ? -1 : 1)
    );

  post.likesCount =
    newCount;

  count.textContent =
    ctx.formatCount(
      newCount
    );

  try {
    if (liked) {
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

      // ======================================================
      // NOTIFICATION: LIKE
      // ======================================================

      await createGroupNotification({
        receiverId:
          post.authorId,

        type:
          "group_post_like",

        message:
          "liked your post",

        postId:
          post.id
      });
    }

  } catch (error) {
    console.error(
      "Error toggling like:",
      error
    );

    button.classList.toggle(
      "is-liked"
    );

    post.likesCount =
      Math.max(
        0,
        (post.likesCount || 0) +
          (liked ? 1 : -1)
      );

    count.textContent =
      ctx.formatCount(
        post.likesCount
      );

    ctx.showToast(
      "Could not update your like.",
      "error"
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
      ".comments-section"
    );

  if (
    section.classList.contains(
      "is-open"
    )
  ) {
    section.classList.remove(
      "is-open"
    );

    return;
  }

  section.classList.add(
    "is-open"
  );

  if (
    section.dataset.loaded ===
    "false"
  ) {
    loadComments(
      section,
      post
    );
  }
}

async function loadComments(
  section,
  post
) {
  section.dataset.loaded =
    "true";

  section.innerHTML = `
    <div class="tab-panel-placeholder">
      <span class="spinner-sm"></span>
      Loading comments...
    </div>
  `;

  try {
    const snapshot =
      await getDocs(
        query(
          collection(
            ctx.db,
            "groups",
            ctx.groupId,
            "posts",
            post.id,
            "comments"
          ),
          orderBy(
            "createdAt",
            "asc"
          ),
          limit(50)
        )
      );

    section.innerHTML =
      "";

    if (isActiveMember()) {
      section.appendChild(
        buildCommentComposer(
          post,
          null,
          section
        )
      );
    }

    const list =
      document.createElement(
        "div"
      );

    list.className =
      "comments-list";

    section.appendChild(
      list
    );

    snapshot.forEach(
      commentDoc => {
        list.appendChild(
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
      "Error loading comments:",
      error
    );

    section.innerHTML = `
      <div class="posts-empty">
        <p>Could not load comments.</p>
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
      "div"
    );

  wrap.className =
    parentCommentId
      ? "reply-composer"
      : "comment-composer";

  wrap.innerHTML = `
    <input
      type="text"
      class="comment-input"
      placeholder="${
        parentCommentId
          ? "Write a reply..."
          : "Write a comment..."
      }"
      maxlength="1000"
    >

    <button
      type="button"
      class="comment-send-btn"
    >
      <i class="fa-solid fa-paper-plane"></i>
    </button>
  `;

  const input =
    wrap.querySelector(
      ".comment-input"
    );

  const send =
    wrap.querySelector(
      ".comment-send-btn"
    );

  const submit =
    async () => {
      const text =
        input.value.trim();

      if (!text)
        return;

      send.disabled =
        true;

      try {
        const profile =
          await getUserProfile(
            ctx.currentUser.uid
          );

        if (parentCommentId) {

          // ==================================================
          // CREATE REPLY
          // ==================================================

          await addDoc(
            collection(
              ctx.db,
              "groups",
              ctx.groupId,
              "posts",
              post.id,
              "comments",
              parentCommentId,
              "replies"
            ),
            {
              authorId:
                ctx.currentUser.uid,

              authorName:
                profile.fullName,

              authorPhotoURL:
                profile.photoURL,

              text,

              createdAt:
                serverTimestamp()
            }
          );

          // ==================================================
          // NOTIFICATION: REPLY
          //
          // Find the original comment so the notification
          // goes to the person who wrote it.
          // ==================================================

          try {
            const commentSnap =
              await getDoc(
                doc(
                  ctx.db,
                  "groups",
                  ctx.groupId,
                  "posts",
                  post.id,
                  "comments",
                  parentCommentId
                )
              );

            if (
              commentSnap.exists()
            ) {
              const commentData =
                commentSnap.data();

              await createGroupNotification({
                receiverId:
                  commentData.authorId,

                type:
                  "group_comment_reply",

                message:
                  "replied to your comment",

                postId:
                  post.id,

                commentId:
                  parentCommentId
              });
            }

          } catch (
            notificationError
          ) {
            console.error(
              "Could not create reply notification:",
              notificationError
            );
          }

          container.appendChild(
            buildReplyItem({
              authorId:
                ctx.currentUser.uid,

              authorName:
                profile.fullName,

              authorPhotoURL:
                profile.photoURL,

              text
            })
          );

        } else {

          // ==================================================
          // CREATE COMMENT
          // ==================================================

          const commentRef =
            await addDoc(
              collection(
                ctx.db,
                "groups",
                ctx.groupId,
                "posts",
                post.id,
                "comments"
              ),
              {
                authorId:
                  ctx.currentUser.uid,

                authorName:
                  profile.fullName,

                authorPhotoURL:
                  profile.photoURL,

                text,

                createdAt:
                  serverTimestamp()
              }
            );

          await updateDoc(
            doc(
              ctx.db,
              "groups",
              ctx.groupId,
              "posts",
              post.id
            ),
            {
              commentsCount:
                increment(1)
            }
          );

          post.commentsCount =
            (post.commentsCount || 0) +
            1;

          const card =
            document.querySelector(
              `.post-card[data-post-id="${post.id}"]`
            );

          if (card) {
            card.querySelector(
              ".comment-count"
            ).textContent =
              ctx.formatCount(
                post.commentsCount
              );
          }

          const list =
            wrap.parentElement?.querySelector(
              ".comments-list"
            );

          if (list) {
            list.appendChild(
              buildCommentItem(
                {
                  id:
                    commentRef.id,

                  authorId:
                    ctx.currentUser.uid,

                  authorName:
                    profile.fullName,

                  authorPhotoURL:
                    profile.photoURL,

                  text
                },
                post
              )
            );
          }

          // ==================================================
          // NOTIFICATION: COMMENT
          // ==================================================

          await createGroupNotification({
            receiverId:
              post.authorId,

            type:
              "group_post_comment",

            message:
              "commented on your post",

            postId:
              post.id,

            commentId:
              commentRef.id
          });
        }

        input.value =
          "";

      } catch (error) {
        console.error(
          "Error posting comment:",
          error
        );

        ctx.showToast(
          "Could not post your comment.",
          "error"
        );

      } finally {
        send.disabled =
          false;
      }
    };

  send.onclick =
    submit;

  input.onkeydown =
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();

        submit();
      }
    };

  return wrap;
}

// ============================================================
// COMMENT ITEM
// ============================================================

function buildCommentItem(
  comment,
  post
) {
  const href =
    authorProfileHref(
      comment.authorId
    );

  const item =
    document.createElement(
      "div"
    );

  item.className =
    "comment-item";

  item.innerHTML = `
    <a
      class="post-author-link comment-avatar"
      href="${href}"
    >
      ${getInitials(
        comment.authorName
      )}
    </a>

    <div style="flex:1;min-width:0;">

      <div class="comment-bubble">

        <a
          class="post-author-link comment-author"
          href="${href}"
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
            : ""
        }

      </div>

      <div class="replies-list"></div>

    </div>
  `;

  setAvatarBackground(
    item.querySelector(
      ".comment-avatar"
    ),
    comment.authorPhotoURL,
    comment.authorName
  );

  item.querySelector(
    ".comment-author"
  ).textContent =
    comment.authorName ||
    "VitalStar User";

  item.querySelector(
    ".comment-text"
  ).textContent =
    comment.text ||
    "";

  const replyBtn =
    item.querySelector(
      ".comment-reply-btn"
    );

  const replies =
    item.querySelector(
      ".replies-list"
    );

  const body =
    item.querySelector(
      "div[style]"
    );

  if (
    replyBtn &&
    comment.id
  ) {
    replyBtn.onclick =
      () => {
        if (
          item.querySelector(
            ".reply-composer"
          )
        ) return;

        body.appendChild(
          buildCommentComposer(
            post,
            comment.id,
            replies
          )
        );

        loadReplies(
          comment.id,
          post,
          replies
        );
      };
  }

  refreshCommentAuthor(
    item,
    comment
  );

  return item;
}

// ============================================================
// REFRESH COMMENT AUTHOR
// ============================================================

async function refreshCommentAuthor(
  item,
  comment
) {
  if (!comment.authorId)
    return;

  try {
    const profile =
      await getUserProfile(
        comment.authorId
      );

    const name =
      profile.fullName ||
      comment.authorName ||
      "VitalStar User";

    const avatar =
      item.querySelector(
        ".comment-avatar"
      );

    const author =
      item.querySelector(
        ".comment-author"
      );

    if (author) {
      author.textContent =
        name;
    }

    if (avatar) {
      setAvatarBackground(
        avatar,
        profile.photoURL ||
          comment.authorPhotoURL ||
          "",
        name
      );
    }

  } catch (error) {
    console.error(
      "Could not refresh comment author:",
      error
    );
  }
}

// ============================================================
// REPLIES
// ============================================================

async function loadReplies(
  commentId,
  post,
  repliesList
) {
  try {
    const snapshot =
      await getDocs(
        query(
          collection(
            ctx.db,
            "groups",
            ctx.groupId,
            "posts",
            post.id,
            "comments",
            commentId,
            "replies"
          ),
          orderBy(
            "createdAt",
            "asc"
          ),
          limit(30)
        )
      );

    snapshot.forEach(
      replyDoc => {
        repliesList.appendChild(
          buildReplyItem({
            id:
              replyDoc.id,

            ...replyDoc.data()
          })
        );
      }
    );

  } catch (error) {
    console.error(
      "Error loading replies:",
      error
    );
  }
}

function buildReplyItem(
  reply
) {
  const href =
    authorProfileHref(
      reply.authorId
    );

  const item =
    document.createElement(
      "div"
    );

  item.className =
    "comment-item";

  item.innerHTML = `
    <a
      class="post-author-link comment-avatar"
      style="width:26px;height:26px;"
      href="${href}"
    >
      ${getInitials(
        reply.authorName
      )}
    </a>

    <div
      class="comment-bubble"
      style="flex:1;"
    >
      <a
        class="post-author-link comment-author"
        href="${href}"
      ></a>

      <div class="comment-text"></div>
    </div>
  `;

  setAvatarBackground(
    item.querySelector(
      ".comment-avatar"
    ),
    reply.authorPhotoURL,
    reply.authorName
  );

  item.querySelector(
    ".comment-author"
  ).textContent =
    reply.authorName ||
    "VitalStar User";

  item.querySelector(
    ".comment-text"
  ).textContent =
    reply.text ||
    "";

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
      "Join this group to repost.",
      "info"
    );

    return;
  }

  if (post.repostOf) {
    ctx.showToast(
      "You can only repost original posts.",
      "info"
    );

    return;
  }

  if (
    !window.confirm(
      "Repost this to the group feed?"
    )
  ) return;

  try {
    const profile =
      await getUserProfile(
        ctx.currentUser.uid
      );

    await addDoc(
      collection(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts"
      ),
      {
        authorId:
          ctx.currentUser.uid,

        authorName:
          profile.fullName,

        authorPhotoURL:
          profile.photoURL,

        authorRole:
          currentUserRole() ||
          "member",

        text:
          "",

        mediaURL:
          post.mediaURL ||
          "",

        mediaType:
          post.mediaType ||
          "none",

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
          "VitalStar User",

        repostOfText:
          post.text ||
          "",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );

    await updateDoc(
      doc(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts",
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

    // ========================================================
    // NOTIFICATION: REPOST
    // ========================================================

    await createGroupNotification({
      receiverId:
        post.authorId,

      type:
        "group_post_repost",

      message:
        "reposted your post",

      postId:
        post.id
    });

    ctx.refreshHeaderStats();

    ctx.showToast(
      "Reposted to the group feed.",
      "success"
    );

    await loadPosts(
      true
    );

  } catch (error) {
    console.error(
      "Error reposting:",
      error
    );

    ctx.showToast(
      "Could not repost.",
      "error"
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
    `${window.location.origin}${window.location.pathname}` +
    `?id=${encodeURIComponent(
      ctx.groupId
    )}` +
    `&post=${encodeURIComponent(
      post.id
    )}`;

  try {
    await updateDoc(
      doc(
        ctx.db,
        "groups",
        ctx.groupId,
        "posts",
        post.id
      ),
      {
        sharesCount:
          increment(1)
      }
    );

    // ========================================================
    // NOTIFICATION: SHARE
    // ========================================================

    await createGroupNotification({
      receiverId:
        post.authorId,

      type:
        "group_post_share",

      message:
        "shared your post",

      postId:
        post.id
    });

    if (navigator.share) {
      await navigator.share({
        title:
          "A post on VitalStar",

        text:
          post.text
            ? post.text.slice(
                0,
                100
              )
            : "Check out this post on VitalStar.",

        url
      });

    } else if (
      navigator.clipboard
    ) {
      await navigator.clipboard.writeText(
        url
      );

      ctx.showToast(
        "Link copied to clipboard.",
        "success"
      );

    } else {
      ctx.showToast(
        "Share link: " + url,
        "info"
      );
    }

  } catch (error) {
    if (
      error.name !==
      "AbortError"
    ) {
      console.error(
        "Error sharing post:",
        error
      );
    }
  }
}