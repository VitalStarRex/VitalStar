// ============================================================
// VITALSTAR — GENERAL REALS
// ============================================================
// GENERAL = ALL PUBLIC VIDEOS IN VITALSTAR
//
// Includes:
// • Normal VitalStar video posts
// • Video posts from ALL groups
//
// Excludes:
// • DM / chat videos
// • Voice notes
// • Private / Only Me normal posts
// • Non-video posts
//
// Firestore sources:
// • posts/{postId}
// • groups/{groupId}/posts/{postId}
//
// Firebase v10.12.2
// ============================================================

import {
  collection,
  collectionGroup,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// STATE
// ============================================================

let ctx = null;
let container = null;

let settings = {
  autoplay: true,
  muted: true,
  dataSaver: false
};

let unsubscribePosts = null;
let unsubscribeGroups = null;

let normalPosts = [];
let groupPosts = [];

let renderedVideos = new Map();

let observer = null;

let destroyed = false;

const STYLE_ID =
  "vitalstar-general-reals-styles";

// ============================================================
// CONSTANTS
// ============================================================

const NORMAL_POST_LIMIT = 100;
const GROUP_POST_LIMIT = 100;

// ============================================================
// INIT
// ============================================================

export function init(context = {}) {
  destroyed = false;

  ctx = context;

  container =
    context.container ||
    context.panelEl ||
    document.getElementById(
      "realsContent"
    );

  settings = {
    autoplay:
      context.settings?.autoplay !== false,

    muted:
      context.settings?.muted !== false,

    dataSaver:
      context.settings?.dataSaver === true
  };

  injectStyles();

  if (!container) {
    console.error(
      "VitalStar General Reals: container not found."
    );

    return () => {};
  }

  destroyListeners();

  container.innerHTML = `
    <div class="vs-general-feed" id="vsGeneralFeed"></div>
  `;

  subscribeToVideos();

  return destroyGeneralVids;
}

// ============================================================
// COMPATIBILITY EXPORT
// ============================================================

export function initGeneralVids(context) {
  return init(context);
}

// ============================================================
// SETTINGS
// ============================================================

export function onSettingChange(
  nextSettings = {}
) {
  settings = {
    ...settings,
    ...nextSettings
  };

  applySettingsToVideos();
}

// ============================================================
// FIRESTORE LISTENERS
// ============================================================

function subscribeToVideos() {
  if (!ctx?.db) {
    showMessage(
      "VitalStar database is not available."
    );

    return;
  }

  // ----------------------------------------------------------
  // NORMAL POSTS
  // ----------------------------------------------------------

  try {
    const postsQuery =
      query(
        collection(
          ctx.db,
          "posts"
        ),

        orderBy(
          "createdAt",
          "desc"
        ),

        limit(
          NORMAL_POST_LIMIT
        )
      );

    unsubscribePosts =
      onSnapshot(
        postsQuery,
        snapshot => {
          normalPosts =
            snapshot.docs
              .map(docSnap => ({
                id:
                  docSnap.id,

                source:
                  "post",

                ...docSnap.data()
              }))
              .filter(
                isPublicNormalVideo
              );

          rebuildFeed();
        },
        error => {
          console.error(
            "VitalStar General Reals — normal posts error:",
            error
          );

          normalPosts = [];

          rebuildFeed();
        }
      );

  } catch (error) {
    console.error(
      "Could not subscribe to normal videos:",
      error
    );
  }

  // ----------------------------------------------------------
  // ALL GROUP POSTS
  //
  // collectionGroup("posts") finds:
  //
  // groups/{groupId}/posts/{postId}
  //
  // It does NOT include:
  //
  // posts/{postId}
  //
  // Therefore normal posts and group posts stay separate.
  // ----------------------------------------------------------

  try {
    const groupQuery =
      query(
        collectionGroup(
          ctx.db,
          "posts"
        ),

        orderBy(
          "createdAt",
          "desc"
        ),

        limit(
          GROUP_POST_LIMIT
        )
      );

    unsubscribeGroups =
      onSnapshot(
        groupQuery,
        snapshot => {
          groupPosts =
            snapshot.docs
              .map(docSnap => {
                const data =
                  docSnap.data();

                const path =
                  docSnap.ref.path;

                const groupId =
                  extractGroupId(
                    path
                  );

                return {
                  id:
                    docSnap.id,

                  source:
                    "group",

                  groupId,

                  ...data
                };
              })
              .filter(
                isGroupVideo
              );

          rebuildFeed();
        },
        error => {
          console.error(
            "VitalStar General Reals — group posts error:",
            error
          );

          groupPosts = [];

          rebuildFeed();
        }
      );

  } catch (error) {
    console.error(
      "Could not subscribe to group videos:",
      error
    );
  }
}

// ============================================================
// NORMAL POST VIDEO FILTER
// ============================================================

function isPublicNormalVideo(post) {
  if (!post) {
    return false;
  }

  // ----------------------------------------------------------
  // Video URL
  //
  // Your normal posts use the "video" field.
  // Extra fallbacks are supported so older videos still work.
  // ----------------------------------------------------------

  const videoURL =
    post.video ||
    post.videoUrl ||
    post.videoURL ||
    (
      post.mediaType ===
        "video"
        ? post.mediaURL
        : ""
    );

  if (!videoURL) {
    return false;
  }

  // ----------------------------------------------------------
  // PRIVATE FILTER
  // ----------------------------------------------------------

  const privacy =
    String(
      post.privacy ??
      post.visibility ??
      "Public"
    )
      .trim()
      .toLowerCase();

  const privateValues = [
    "only me",
    "onlyme",
    "private",
    "only_me",
    "only-me"
  ];

  if (
    privateValues.includes(
      privacy
    )
  ) {
    return false;
  }

  // If explicitly marked public/friends,
  // only public content belongs in General.
  //
  // Friends-only videos are NOT public.
  if (
    privacy === "friends" ||
    privacy === "friend" ||
    privacy === "friends only" ||
    privacy === "friendsonly"
  ) {
    return false;
  }

  // Explicitly blocked/unpublished content.
  if (
    post.deleted === true ||
    post.isDeleted === true ||
    post.hidden === true ||
    post.isHidden === true ||
    post.published === false
  ) {
    return false;
  }

  return true;
}

// ============================================================
// GROUP VIDEO FILTER
// ============================================================

function isGroupVideo(post) {
  if (!post) {
    return false;
  }

  if (
    post.mediaType !==
    "video"
  ) {
    return false;
  }

  if (!post.mediaURL) {
    return false;
  }

  if (
    post.deleted === true ||
    post.isDeleted === true ||
    post.hidden === true ||
    post.isHidden === true
  ) {
    return false;
  }

  return true;
}

// ============================================================
// EXTRACT GROUP ID
// ============================================================

function extractGroupId(path) {
  if (!path) {
    return "";
  }

  const parts =
    path.split("/");

  // groups/{groupId}/posts/{postId}
  if (
    parts.length >= 4 &&
    parts[0] === "groups" &&
    parts[2] === "posts"
  ) {
    return parts[1];
  }

  return "";
}

// ============================================================
// BUILD GENERAL FEED
// ============================================================

function rebuildFeed() {
  if (
    destroyed ||
    !container
  ) {
    return;
  }

  const allVideos = [
    ...normalPosts,
    ...groupPosts
  ];

  // ----------------------------------------------------------
  // NORMALIZE
  // ----------------------------------------------------------

  const normalized =
    allVideos
      .map(normalizeVideo)
      .filter(video =>
        Boolean(
          video.url
        )
      );

  // ----------------------------------------------------------
  // REMOVE DUPLICATES
  //
  // Prefer the source + document ID.
  // Also prevent the same exact URL from appearing twice.
  // ----------------------------------------------------------

  const unique =
    [];

  const ids =
    new Set();

  const urls =
    new Set();

  for (
    const video of normalized
  ) {
    const idKey =
      `${video.source}:${video.id}`;

    if (
      ids.has(idKey)
    ) {
      continue;
    }

    if (
      urls.has(video.url)
    ) {
      continue;
    }

    ids.add(idKey);
    urls.add(video.url);

    unique.push(video);
  }

  // ----------------------------------------------------------
  // NEWEST FIRST
  // ----------------------------------------------------------

  unique.sort(
    (a, b) =>
      getTimestamp(
        b.createdAt
      ) -
      getTimestamp(
        a.createdAt
      )
  );

  renderFeed(
    unique
  );
}

// ============================================================
// NORMALIZE VIDEO
// ============================================================

function normalizeVideo(item) {
  const isGroup =
    item.source ===
    "group";

  const url =
    isGroup
      ? item.mediaURL
      : (
          item.video ||
          item.videoUrl ||
          item.videoURL ||
          item.mediaURL ||
          ""
        );

  return {
    id:
      item.id,

    source:
      item.source,

    groupId:
      item.groupId ||
      "",

    url,

    createdAt:
      item.createdAt ||
      null,

    authorId:
      item.authorId ||
      item.uid ||
      item.userId ||
      "",

    authorName:
      item.authorName ||
      item.fullName ||
      item.displayName ||
      item.username ||
      "VitalStar User",

    authorPhoto:
      item.authorPhotoURL ||
      item.profilePicture ||
      item.profilePhoto ||
      item.photoURL ||
      item.avatar ||
      "",

    caption:
      item.text ||
      item.caption ||
      "",

    likes:
      Number(
        item.likesCount ??
        item.likes ??
        0
      ),

    comments:
      Number(
        item.commentsCount ??
        item.comments ??
        0
      ),

    reposts:
      Number(
        item.repostsCount ??
        item.reposts ??
        0
      ),

    shares:
      Number(
        item.sharesCount ??
        item.shares ??
        0
      )
  };
}

// ============================================================
// TIMESTAMP
// ============================================================

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (
    typeof value.toMillis ===
    "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value.toDate ===
    "function"
  ) {
    return value.toDate().getTime();
  }

  if (
    typeof value.seconds ===
    "number"
  ) {
    return (
      value.seconds * 1000
    );
  }

  if (
    typeof value ===
    "number"
  ) {
    return value;
  }

  const parsed =
    new Date(value)
      .getTime();

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

// ============================================================
// RENDER FEED
// ============================================================

function renderFeed(videos) {
  const feed =
    container.querySelector(
      "#vsGeneralFeed"
    );

  if (!feed) {
    return;
  }

  // ----------------------------------------------------------
  // SAVE CURRENT INDEX
  // ----------------------------------------------------------

  const currentCards =
    [
      ...feed.querySelectorAll(
        ".vs-real-card"
      )
    ];

  let currentIndex = 0;

  if (
    currentCards.length
  ) {
    const closest =
      currentCards.find(
        card =>
          card.getBoundingClientRect()
            .top >= -50 &&
          card.getBoundingClientRect()
            .top <=
            window.innerHeight / 2
      );

    if (closest) {
      currentIndex =
        Number(
          closest.dataset.index ||
          0
        );
    }
  }

  // ----------------------------------------------------------
  // NO VIDEOS
  // ----------------------------------------------------------

  if (!videos.length) {
    destroyObserver();

    renderedVideos.clear();

    feed.innerHTML = `
      <div class="vs-real-empty">
        <div class="vs-real-empty-icon">
          <i class="fa-solid fa-video"></i>
        </div>

        <h3>No public videos yet</h3>

        <p>
          Public videos from VitalStar posts and groups
          will appear here.
        </p>
      </div>
    `;

    return;
  }

  // ----------------------------------------------------------
  // CREATE DOCUMENT FRAGMENT
  // ----------------------------------------------------------

  const fragment =
    document.createDocumentFragment();

  const newIds =
    new Set();

  videos.forEach(
    (video, index) => {
      const key =
        `${video.source}:${video.id}`;

      newIds.add(key);

      const card =
        createVideoCard(
          video,
          index
        );

      fragment.appendChild(
        card
      );
    }
  );

  destroyObserver();

  renderedVideos.clear();

  feed.innerHTML =
    "";

  feed.appendChild(
    fragment
  );

  // ----------------------------------------------------------
  // OBSERVER
  // ----------------------------------------------------------

  setupObserver();

  applySettingsToVideos();

  // ----------------------------------------------------------
  // RESTORE POSITION
  // ----------------------------------------------------------

  if (
    currentIndex <
    videos.length
  ) {
    requestAnimationFrame(
      () => {
        const card =
          feed.querySelector(
            `.vs-real-card[data-index="${currentIndex}"]`
          );

        if (card) {
          card.scrollIntoView({
            block:
              "nearest"
          });
        }
      }
    );
  }
}

// ============================================================
// VIDEO CARD
// ============================================================

function createVideoCard(
  video,
  index
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "vs-real-card";

  card.dataset.index =
    String(index);

  card.dataset.videoId =
    `${video.source}:${video.id}`;

  const sourceLabel =
    video.source ===
    "group"
      ? "Group"
      : "Post";

  const videoElement =
    document.createElement(
      "video"
    );

  videoElement.className =
    "vs-real-video";

  videoElement.src =
    getPlayableVideoUrl(
      video.url
    );

  videoElement.playsInline =
    true;

  videoElement.loop =
    true;

  videoElement.controls =
    false;

  videoElement.preload =
    settings.dataSaver
      ? "none"
      : "metadata";

  videoElement.muted =
    settings.muted;

  // ----------------------------------------------------------
  // VIDEO ERROR
  // ----------------------------------------------------------

  videoElement.addEventListener(
    "error",
    () => {
      console.error(
        "VitalStar Reals video error:",
        video.url
      );
    }
  );

  // ----------------------------------------------------------
  // TAP PLAY / PAUSE
  // ----------------------------------------------------------

  videoElement.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      if (
        videoElement.paused
      ) {
        videoElement.play()
          .catch(() => {});
      } else {
        videoElement.pause();
      }
    }
  );

  // ----------------------------------------------------------
  // CARD HTML
  // ----------------------------------------------------------

  card.innerHTML = `
    <div class="vs-real-overlay"></div>

    <div class="vs-real-top">
      <div class="vs-real-source">
        <i class="${
          video.source === "group"
            ? "fa-solid fa-users"
            : "fa-solid fa-video"
        }"></i>

        ${sourceLabel}
      </div>
    </div>

    <div class="vs-real-actions">

      <button
        type="button"
        class="vs-real-action"
        data-action="like"
        aria-label="Like"
      >
        <span class="vs-real-action-icon">
          <i class="fa-regular fa-heart"></i>
        </span>

        <span class="vs-real-action-count">
          ${formatCount(video.likes)}
        </span>
      </button>

      <button
        type="button"
        class="vs-real-action"
        data-action="comment"
        aria-label="Comments"
      >
        <span class="vs-real-action-icon">
          <i class="fa-regular fa-comment"></i>
        </span>

        <span class="vs-real-action-count">
          ${formatCount(video.comments)}
        </span>
      </button>

      <button
        type="button"
        class="vs-real-action"
        data-action="repost"
        aria-label="Repost"
      >
        <span class="vs-real-action-icon">
          <i class="fa-solid fa-retweet"></i>
        </span>

        <span class="vs-real-action-count">
          ${formatCount(video.reposts)}
        </span>
      </button>

      <button
        type="button"
        class="vs-real-action"
        data-action="share"
        aria-label="Share"
      >
        <span class="vs-real-action-icon">
          <i class="fa-solid fa-share"></i>
        </span>

        <span class="vs-real-action-count">
          ${formatCount(video.shares)}
        </span>
      </button>

      <button
        type="button"
        class="vs-real-action"
        data-action="mute"
        aria-label="Mute"
      >
        <span class="vs-real-action-icon">
          <i class="fa-solid ${
            settings.muted
              ? "fa-volume-xmark"
              : "fa-volume-high"
          }"></i>
        </span>
      </button>

      <button
        type="button"
        class="vs-real-action"
        data-action="more"
        aria-label="More"
      >
        <span class="vs-real-action-icon">
          <i class="fa-solid fa-ellipsis"></i>
        </span>
      </button>

    </div>

    <div class="vs-real-bottom">

      <div class="vs-real-creator">

        <a
          class="vs-real-avatar"
          href="${profileHref(
            video.authorId
          )}"
        >
          ${getInitials(
            video.authorName
          )}
        </a>

        <div class="vs-real-creator-info">

          <a
            class="vs-real-creator-name"
            href="${profileHref(
              video.authorId
            )}"
          ></a>

          <div class="vs-real-follow-line">
            <span>VitalStar</span>
          </div>

        </div>

        <button
          type="button"
          class="vs-real-follow-btn"
          data-action="follow"
        >
          Follow
        </button>

      </div>

      ${
        video.caption
          ? `
            <div class="vs-real-caption"></div>
          `
          : ""
      }

    </div>
  `;

  card.insertBefore(
    videoElement,
    card.firstChild
  );

  // ----------------------------------------------------------
  // SET TEXT SAFELY
  // ----------------------------------------------------------

  const creatorName =
    card.querySelector(
      ".vs-real-creator-name"
    );

  if (creatorName) {
    creatorName.textContent =
      video.authorName ||
      "VitalStar User";
  }

  const caption =
    card.querySelector(
      ".vs-real-caption"
    );

  if (caption) {
    caption.textContent =
      video.caption;
  }

  const avatar =
    card.querySelector(
      ".vs-real-avatar"
    );

  setAvatar(
    avatar,
    video.authorPhoto,
    video.authorName
  );

  // ----------------------------------------------------------
  // ACTIONS
  // ----------------------------------------------------------

  card
    .querySelectorAll(
      ".vs-real-action"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          handleAction(
            button.dataset.action,
            video,
            videoElement,
            card
          );
        }
      );
    });

  card
    .querySelector(
      ".vs-real-follow-btn"
    )
    ?.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        handleFollow(
          video,
          card
        );
      }
    );

  return card;
}

// ============================================================
// VIDEO URL
// ============================================================

function getPlayableVideoUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.hostname.includes(
        "res.cloudinary.com"
      ) &&
      parsed.pathname.includes(
        "/video/upload/"
      )
    ) {
      const marker =
        "/video/upload/";

      const index =
        parsed.pathname.indexOf(
          marker
        );

      if (index !== -1) {
        const before =
          parsed.pathname.slice(
            0,
            index +
              marker.length
          );

        const after =
          parsed.pathname.slice(
            index +
              marker.length
          );

        if (
          !after.startsWith(
            "f_mp4/"
          )
        ) {
          parsed.pathname =
            before +
            "f_mp4/" +
            after;
        }

        return parsed.toString();
      }
    }
  } catch {
    // Keep original URL.
  }

  return url;
}

// ============================================================
// INTERSECTION OBSERVER
// ============================================================

function setupObserver() {
  const feed =
    container?.querySelector(
      "#vsGeneralFeed"
    );

  if (!feed) {
    return;
  }

  observer =
    new IntersectionObserver(
      entries => {
        entries.forEach(
          entry => {
            const video =
              entry.target.querySelector(
                ".vs-real-video"
              );

            if (!video) {
              return;
            }

            if (
              entry.isIntersecting &&
              entry.intersectionRatio >=
                0.65
            ) {
              if (
                settings.autoplay
              ) {
                video.muted =
                  settings.muted;

                video.play()
                  .catch(() => {});
              }
            } else {
              video.pause();
            }
          }
        );
      },
      {
        root:
          feed,

        threshold: [
          0,
          0.65,
          0.9
        ]
      }
    );

  feed
    .querySelectorAll(
      ".vs-real-card"
    )
    .forEach(card => {
      observer.observe(
        card
      );
    });
}

// ============================================================
// APPLY SETTINGS
// ============================================================

function applySettingsToVideos() {
  if (!container) {
    return;
  }

  container
    .querySelectorAll(
      ".vs-real-video"
    )
    .forEach(video => {
      video.muted =
        settings.muted;

      video.preload =
        settings.dataSaver
          ? "none"
          : "metadata";

      const muteIcon =
        video
          .closest(
            ".vs-real-card"
          )
          ?.querySelector(
            '[data-action="mute"] i'
          );

      if (muteIcon) {
        muteIcon.className =
          `fa-solid ${
            settings.muted
              ? "fa-volume-xmark"
              : "fa-volume-high"
          }`;
      }

      if (
        !settings.autoplay
      ) {
        video.pause();
      }
    });
}

// ============================================================
// ACTION HANDLER
// ============================================================

function handleAction(
  action,
  video,
  videoElement,
  card
) {
  switch (action) {

    case "like":
      handleLike(
        video,
        card
      );
      break;

    case "comment":
      handleComment(
        video
      );
      break;

    case "repost":
      handleRepost(
        video
      );
      break;

    case "share":
      handleShare(
        video
      );
      break;

    case "mute":
      videoElement.muted =
        !videoElement.muted;

      const icon =
        card.querySelector(
          '[data-action="mute"] i'
        );

      if (icon) {
        icon.className =
          `fa-solid ${
            videoElement.muted
              ? "fa-volume-xmark"
              : "fa-volume-high"
          }`;
      }

      break;

    case "more":
      showMoreMenu(
        video
      );
      break;
  }
}

// ============================================================
// LIKE
// ============================================================

function handleLike(
  video,
  card
) {
  const button =
    card.querySelector(
      '[data-action="like"]'
    );

  if (!button) {
    return;
  }

  button.classList.toggle(
    "is-active"
  );

  const icon =
    button.querySelector(
      "i"
    );

  if (
    button.classList.contains(
      "is-active"
    )
  ) {
    icon.className =
      "fa-solid fa-heart";
  } else {
    icon.className =
      "fa-regular fa-heart";
  }

  // ----------------------------------------------------------
  // NOTE
  // ----------------------------------------------------------
  //
  // The General Reals feed combines two different Firestore
  // schemas:
  //
  // posts/{postId}
  // groups/{groupId}/posts/{postId}
  //
  // Their existing like systems are different.
  //
  // Therefore this UI does NOT write a guessed like structure.
  // The original Post / Group Post like handlers remain the
  // source of truth.
  //
  // ----------------------------------------------------------
}

// ============================================================
// COMMENT
// ============================================================

function handleComment(
  video
) {
  const url =
    video.source ===
    "group"
      ? `../group.html?id=${encodeURIComponent(
          video.groupId
        )}&post=${encodeURIComponent(
          video.id
        )}`
      : `../post.html?id=${encodeURIComponent(
          video.id
        )}`;

  window.location.href =
    url;
}

// ============================================================
// REPOST
// ============================================================

function handleRepost(
  video
) {
  if (
    video.source ===
    "group"
  ) {
    showMessage(
      "Open the group post to repost this video."
    );
  } else {
    showMessage(
      "Open the original post to repost this video."
    );
  }
}

// ============================================================
// SHARE
// ============================================================

async function handleShare(
  video
) {
  const url =
    `${window.location.origin}${window.location.pathname}` +
    `?video=${encodeURIComponent(
      video.id
    )}` +
    `&source=${encodeURIComponent(
      video.source
    )}`;

  try {
    if (
      navigator.share
    ) {
      await navigator.share({
        title:
          "VitalStar Reals",

        text:
          video.caption ||
          "Check out this video on VitalStar.",

        url
      });

      return;
    }

    if (
      navigator.clipboard
    ) {
      await navigator.clipboard.writeText(
        url
      );

      showMessage(
        "Video link copied."
      );

      return;
    }

    showMessage(
      url
    );

  } catch (error) {
    if (
      error?.name !==
      "AbortError"
    ) {
      console.error(
        "Share failed:",
        error
      );
    }
  }
}

// ============================================================
// FOLLOW
// ============================================================

function handleFollow(
  video,
  card
) {
  if (
    !video.authorId
  ) {
    return;
  }

  showMessage(
    "Open the creator profile to follow them."
  );
}

// ============================================================
// MORE
// ============================================================

function showMoreMenu(
  video
) {
  const choice =
    window.confirm(
      "Open this creator's profile?"
    );

  if (
    choice &&
    video.authorId
  ) {
    window.location.href =
      profileHref(
        video.authorId
      );
  }
}

// ============================================================
// PROFILE LINK
// ============================================================

function profileHref(uid) {
  if (!uid) {
    return "#";
  }

  return `../profile.html?uid=${encodeURIComponent(
    uid
  )}`;
}

// ============================================================
// AVATAR
// ============================================================

function setAvatar(
  element,
  photoURL,
  name
) {
  if (!element) {
    return;
  }

  element.textContent =
    getInitials(
      name
    );

  if (photoURL) {
    element.style.backgroundImage =
      `url("${photoURL}")`;

    element.style.backgroundSize =
      "cover";

    element.style.backgroundPosition =
      "center";
  }
}

// ============================================================
// INITIALS
// ============================================================

function getInitials(
  name
) {
  if (!name) {
    return "U";
  }

  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(
        part =>
          part
            .charAt(0)
            .toUpperCase()
      )
      .join("") ||
    "U"
  );
}

// ============================================================
// COUNT
// ============================================================

function formatCount(
  value
) {
  const number =
    Number(value) || 0;

  if (
    number < 1000
  ) {
    return String(
      number
    );
  }

  if (
    number < 1000000
  ) {
    return (
      (number / 1000)
        .toFixed(
          number >= 10000
            ? 0
            : 1
        )
        .replace(
          ".0",
          ""
        ) +
      "K"
    );
  }

  return (
    (number / 1000000)
      .toFixed(1)
      .replace(
        ".0",
        ""
      ) +
    "M"
  );
}

// ============================================================
// MESSAGE
// ============================================================

function showMessage(
  message
) {
  if (
    ctx?.showToast
  ) {
    ctx.showToast(
      message,
      "info"
    );

    return;
  }

  console.log(
    message
  );
}

// ============================================================
// DESTROY OBSERVER
// ============================================================

function destroyObserver() {
  if (observer) {
    observer.disconnect();

    observer =
      null;
  }
}

// ============================================================
// DESTROY LISTENERS
// ============================================================

function destroyListeners() {
  if (
    unsubscribePosts
  ) {
    unsubscribePosts();

    unsubscribePosts =
      null;
  }

  if (
    unsubscribeGroups
  ) {
    unsubscribeGroups();

    unsubscribeGroups =
      null;
  }
}

// ============================================================
// DESTROY
// ============================================================

export function destroyGeneralVids() {
  destroyed =
    true;

  destroyListeners();

  destroyObserver();

  if (container) {
    container
      .querySelectorAll(
        ".vs-real-video"
      )
      .forEach(video => {
        video.pause();

        video.removeAttribute(
          "src"
        );

        video.load();
      });

    container.innerHTML =
      "";
  }

  renderedVideos.clear();

  normalPosts = [];

  groupPosts = [];

  ctx =
    null;

  container =
    null;
}

// ============================================================
// STYLES
// ============================================================

function injectStyles() {
  if (
    document.getElementById(
      STYLE_ID
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    STYLE_ID;

  style.textContent = `
    .vs-general-feed {
      width:100%;
      height:100%;
      overflow-y:auto;
      overflow-x:hidden;
      scroll-snap-type:y mandatory;
      overscroll-behavior-y:contain;
      background:#050914;
      scrollbar-width:none;
    }

    .vs-general-feed::-webkit-scrollbar {
      display:none;
    }

    .vs-real-card {
      position:relative;
      width:100%;
      min-height:100%;
      height:100%;
      scroll-snap-align:start;
      scroll-snap-stop:always;
      overflow:hidden;
      background:#050914;
    }

    .vs-real-video {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      background:#050914;
      cursor:pointer;
    }

    .vs-real-overlay {
      position:absolute;
      inset:0;
      z-index:1;
      pointer-events:none;
      background:
        linear-gradient(
          to bottom,
          rgba(0,0,0,.22),
          transparent 25%,
          transparent 55%,
          rgba(0,0,0,.72)
        );
    }

    .vs-real-top {
      position:absolute;
      top:16px;
      left:16px;
      z-index:5;
    }

    .vs-real-source {
      display:inline-flex;
      align-items:center;
      gap:7px;
      padding:7px 11px;
      border-radius:999px;
      background:rgba(5,9,20,.62);
      border:1px solid rgba(255,255,255,.12);
      color:#fff;
      font-size:12px;
      backdrop-filter:blur(10px);
    }

    .vs-real-actions {
      position:absolute;
      right:12px;
      bottom:115px;
      z-index:6;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:13px;
    }

    .vs-real-action {
      width:48px;
      min-height:48px;
      padding:0;
      border:0;
      background:none;
      color:#fff;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:3px;
      cursor:pointer;
    }

    .vs-real-action-icon {
      width:43px;
      height:43px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(5,9,20,.58);
      border:1px solid rgba(255,255,255,.14);
      backdrop-filter:blur(10px);
      font-size:20px;
    }

    .vs-real-action.is-active
      .vs-real-action-icon {
      color:#ff3d69;
    }

    .vs-real-action-count {
      font-size:10px;
      font-weight:700;
      color:#fff;
      text-shadow:0 1px 4px rgba(0,0,0,.8);
    }

    .vs-real-bottom {
      position:absolute;
      left:16px;
      right:72px;
      bottom:18px;
      z-index:6;
    }

    .vs-real-creator {
      display:flex;
      align-items:center;
      gap:10px;
    }

    .vs-real-avatar {
      width:43px;
      height:43px;
      border-radius:50%;
      flex-shrink:0;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
      background:linear-gradient(
        135deg,
        #315fff,
        #7c4dff
      );
      color:#fff;
      font-weight:800;
      text-decoration:none;
      background-size:cover;
      background-position:center;
      border:1px solid rgba(255,255,255,.3);
    }

    .vs-real-creator-info {
      min-width:0;
    }

    .vs-real-creator-name {
      color:#fff;
      font-size:14px;
      font-weight:800;
      text-decoration:none;
    }

    .vs-real-follow-line {
      margin-top:2px;
      color:rgba(255,255,255,.7);
      font-size:11px;
    }

    .vs-real-follow-btn {
      margin-left:5px;
      padding:7px 13px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.35);
      background:rgba(5,9,20,.52);
      color:#fff;
      font-size:11px;
      font-weight:700;
      cursor:pointer;
    }

    .vs-real-caption {
      margin-top:9px;
      max-width:90%;
      color:#fff;
      font-size:13px;
      line-height:1.45;
      white-space:pre-wrap;
      word-break:break-word;
      text-shadow:0 1px 5px rgba(0,0,0,.85);
    }

    .vs-real-empty {
      min-height:100%;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:30px;
      text-align:center;
      color:#fff;
    }

    .vs-real-empty-icon {
      width:70px;
      height:70px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      margin-bottom:15px;
      background:rgba(49,95,255,.12);
      border:1px solid rgba(49,95,255,.25);
      color:#7c9cff;
      font-size:28px;
    }

    .vs-real-empty h3 {
      margin:0;
      font-size:18px;
    }

    .vs-real-empty p {
      max-width:280px;
      margin:8px 0 0;
      color:#8d96aa;
      font-size:13px;
      line-height:1.5;
    }

    @media (min-width:700px) {
      .vs-real-card {
        max-width:620px;
        margin:0 auto;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}