// ============================================================
// VITALSTAR — user-post.js
// Displays posts belonging to the selected user.
// Uses the existing Firebase configuration from firebase.js.
// ============================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// SETTINGS
// ============================================================

const POSTS_LIMIT = 10;

const postsContainer = document.getElementById("posts");


// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getTime(post) {

  const timestamp =
    post.createdAt ||
    post.timestamp ||
    post.updatedAt;

  if (!timestamp) {
    return "";
  }

  try {

    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);

    return date.toLocaleString();

  } catch (error) {

    return "";

  }
}


// ============================================================
// GET USER ID
// ============================================================

function getUserId() {

  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.get("uid") ||
    params.get("userId") ||
    params.get("id")
  );
}


// ============================================================
// LOAD USER PROFILE
// ============================================================

async function loadUserProfile(uid) {

  try {

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        fullName: "VitalStar User",
        username: "",
        avatarURL: ""
      };
    }

    const user = userSnap.data();

    return {

      fullName:
        user.fullName ||
        user.displayName ||
        user.name ||
        "VitalStar User",

      username:
        user.username ||
        "",

      avatarURL:
        user.avatarURL ||
        user.photoURL ||
        user.profilePicture ||
        ""

    };

  } catch (error) {

    console.error(
      "Error loading user profile:",
      error
    );

    return {
      fullName: "VitalStar User",
      username: "",
      avatarURL: ""
    };

  }
}


// ============================================================
// FIND MEDIA
// ============================================================

function getMediaURL(post) {

  return (
    post.mediaURL ||
    post.mediaUrl ||
    post.imageURL ||
    post.imageUrl ||
    post.videoURL ||
    post.videoUrl ||
    post.fileURL ||
    post.fileUrl ||
    ""
  );
}


function getMediaType(post) {

  const type =
    post.mediaType ||
    post.type ||
    "";

  return String(type).toLowerCase();

}


// ============================================================
// CREATE MEDIA
// ============================================================

function createMedia(post) {

  const url = getMediaURL(post);

  if (!url) {
    return "";
  }

  const type = getMediaType(post);

  // Video
  if (
    type.includes("video") ||
    post.videoURL ||
    post.videoUrl
  ) {

    return `
      <video
        class="post-media"
        src="${escapeHTML(url)}"
        controls
        preload="metadata">
      </video>
    `;

  }


  // Image
  return `
    <img
      class="post-media"
      src="${escapeHTML(url)}"
      alt="Post media"
      loading="lazy"
      onerror="this.style.display='none'">
  `;

}


// ============================================================
// RENDER POST
// ============================================================

function renderPost(post, profile) {

  const postId =
    post.id ||
    "";

  const text =
    post.text ||
    post.content ||
    post.caption ||
    "";

  const time =
    getTime(post);

  const avatar =
    profile.avatarURL ||
    "https://via.placeholder.com/100";

  const username =
    profile.username
      ? `@${escapeHTML(profile.username)}`
      : "";

  const media =
    createMedia(post);


  const article =
    document.createElement("article");

  article.className = "post";

  article.dataset.postId = postId;


  article.innerHTML = `

    <div class="post-header">

      <img
        class="avatar"
        src="${escapeHTML(avatar)}"
        alt="Profile picture"
        onerror="this.src='https://via.placeholder.com/100'">

      <div>

        <div class="author">
          ${escapeHTML(profile.fullName)}
        </div>

        ${
          username
            ? `<div class="username">${username}</div>`
            : ""
        }

        ${
          time
            ? `<div class="post-time">${escapeHTML(time)}</div>`
            : ""
        }

      </div>

    </div>


    ${
      text
        ? `
          <div class="post-content">
            ${escapeHTML(text)}
          </div>
        `
        : ""
    }


    ${media}


    <div class="post-actions">

      <button type="button">
        ❤️ Like
      </button>

      <button type="button">
        💬 Comment
      </button>

      <button type="button">
        ↗️ Share
      </button>

    </div>

  `;


  return article;

}


// ============================================================
// LOAD POSTS
// ============================================================

async function loadUserPosts(uid) {

  if (!postsContainer) {
    return;
  }

  postsContainer.innerHTML =
    `<div class="loading">Loading posts...</div>`;


  try {

    /*
     * Posts are stored in the "posts" collection.
     * Supported author fields:
     * - userId (preferred)
     * - authorId (fallback)
     * - uid
     */

    let snapshot = null;


    try {

      const q = query(
        collection(db, "posts"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(POSTS_LIMIT)
      );

      snapshot = await getDocs(q);

    } catch (firstError) {

      console.warn(
        "Primary query using userId failed. Retrying with authorId...",
        firstError
      );


      const q = query(
        collection(db, "posts"),
        where("authorId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(POSTS_LIMIT)
      );

      snapshot = await getDocs(q);

    }


    if (!snapshot || snapshot.empty) {

      postsContainer.innerHTML = `
        <div class="empty">
          No posts available.
        </div>
      `;

      return;
    }


    const profile =
      await loadUserProfile(uid);


    postsContainer.innerHTML = "";


    snapshot.forEach(postDoc => {

      const post = {
        id: postDoc.id,
        ...postDoc.data()
      };


      const element =
        renderPost(post, profile);


      postsContainer.appendChild(element);

    });


  } catch (error) {

    console.error(
      "Failed to load user posts:",
      error
    );


    postsContainer.innerHTML = `
      <div class="empty">
        Unable to load posts at this time.
      </div>
    `;

  }

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    if (postsContainer) {

      postsContainer.innerHTML = `
        <div class="empty">
          Please sign in to view posts.
        </div>
      `;

    }

    return;
  }


  const uid =
    getUserId() || user.uid;


  await loadUserPosts(uid);

});