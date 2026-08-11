// ============================================================
// VITALSTAR — user-post.js
// Displays posts belonging to a user.
// Safe version: avoids compound Firestore index requirements.
// ============================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
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
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getUserId() {

  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.get("uid") ||
    params.get("userId") ||
    params.get("id") ||
    null
  );
}


function timestampToNumber(value) {

  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  const date = new Date(value);

  return isNaN(date.getTime())
    ? 0
    : date.getTime();
}


function formatTime(post) {

  const value =
    post.createdAt ||
    post.timestamp ||
    post.updatedAt;

  const milliseconds =
    timestampToNumber(value);

  if (!milliseconds) return "";

  try {
    return new Date(milliseconds).toLocaleString();
  } catch {
    return "";
  }
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadUserProfile(uid) {

  try {

    const userRef = doc(db, "users", uid);

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) {

      return {
        fullName: "VitalStar User",
        username: "",
        avatarURL: ""
      };

    }

    const user =
      userSnap.data();

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
      "Profile loading error:",
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
// CHECK POST OWNER
// ============================================================

function belongsToUser(post, uid) {

  return (
    post.userId === uid ||
    post.authorId === uid ||
    post.uid === uid ||
    post.ownerId === uid ||
    post.createdBy === uid
  );

}


// ============================================================
// MEDIA
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

  return String(
    post.mediaType ||
    post.type ||
    ""
  ).toLowerCase();

}


function createMedia(post) {

  const url =
    getMediaURL(post);

  if (!url) return "";

  const type =
    getMediaType(post);


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

  const article =
    document.createElement("article");

  article.className = "post";

  article.dataset.postId =
    post.id || "";


  const text =
    post.text ||
    post.content ||
    post.caption ||
    "";


  const avatar =
    profile.avatarURL ||
    "https://via.placeholder.com/100";


  const username =
    profile.username
      ? `@${escapeHTML(profile.username)}`
      : "";


  const time =
    formatTime(post);


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
            ? `
              <div class="username">
                ${username}
              </div>
            `
            : ""
        }

        ${
          time
            ? `
              <div class="post-time">
                ${escapeHTML(time)}
              </div>
            `
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


    ${createMedia(post)}


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
    console.error(
      "user-post.js: #posts element not found."
    );
    return;
  }


  postsContainer.innerHTML = `
    <div class="loading">
      Loading posts...
    </div>
  `;


  try {

    console.log(
      "Loading posts for UID:",
      uid
    );


    // Get posts WITHOUT where/orderBy.
    // This avoids Firestore index problems.
    const snapshot =
      await getDocs(
        collection(db, "posts")
      );


    console.log(
      "Total posts found:",
      snapshot.size
    );


    const posts = [];


    snapshot.forEach(postDoc => {

      const data =
        postDoc.data();


      if (
        belongsToUser(data, uid)
      ) {

        posts.push({
          id: postDoc.id,
          ...data
        });

      }

    });


    console.log(
      "Posts belonging to user:",
      posts.length
    );


    // Newest first
    posts.sort((a, b) => {

      const aTime =
        timestampToNumber(
          a.createdAt ||
          a.timestamp ||
          a.updatedAt
        );

      const bTime =
        timestampToNumber(
          b.createdAt ||
          b.timestamp ||
          b.updatedAt
        );

      return bTime - aTime;

    });


    // Latest 10
    const latestPosts =
      posts.slice(0, POSTS_LIMIT);


    if (latestPosts.length === 0) {

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


    latestPosts.forEach(post => {

      const element =
        renderPost(
          post,
          profile
        );

      postsContainer.appendChild(element);

    });


  } catch (error) {

    console.error(
      "USER POSTS ERROR:",
      error
    );


    postsContainer.innerHTML = `
      <div class="empty">
        Unable to load posts.
        <br>
        <small>
          Check the browser console for the exact error.
        </small>
      </div>
    `;

  }

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  async (user) => {

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

  }
);