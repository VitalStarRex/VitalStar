// ============================================================
// VITALSTAR — user-post.js
// Diagnostic + user posts loader
// ============================================================

const postsContainer = document.getElementById("posts");


// ============================================================
// SHOW STATUS
// ============================================================

function showStatus(message, error = false) {

  if (!postsContainer) {
    alert(message);
    return;
  }

  postsContainer.innerHTML = `
    <div class="${error ? "empty" : "loading"}">
      ${message}
    </div>
  `;

}


// ============================================================
// START
// ============================================================

async function startUserPosts() {

  try {

    showStatus("Connecting to VitalStar...");


    // --------------------------------------------------------
    // Load your existing Firebase configuration
    // --------------------------------------------------------

    const firebaseModule =
      await import("./firebase.js");


    const auth =
      firebaseModule.auth;

    const db =
      firebaseModule.db;


    if (!auth) {

      throw new Error(
        "Firebase Auth was not exported from firebase.js"
      );

    }


    if (!db) {

      throw new Error(
        "Firestore db was not exported from firebase.js"
      );

    }


    showStatus("Firebase connected. Checking login...");


    // --------------------------------------------------------
    // Firebase Auth
    // --------------------------------------------------------

    const {
      onAuthStateChanged
    } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
    );


    onAuthStateChanged(
      auth,
      async (user) => {

        try {

          if (!user) {

            showStatus(
              "You must be logged in to view posts."
            );

            return;

          }


          console.log(
            "Logged-in user:",
            user.uid
          );


          // --------------------------------------------------
          // Get profile UID from URL
          // --------------------------------------------------

          const params =
            new URLSearchParams(
              window.location.search
            );


          const profileUid =
            params.get("uid") ||
            params.get("userId") ||
            params.get("id") ||
            user.uid;


          console.log(
            "Posts will be loaded for:",
            profileUid
          );


          await loadPosts(
            db,
            profileUid
          );


        } catch (error) {

          console.error(
            "USER POSTS ERROR:",
            error
          );


          showStatus(
            "Error loading posts:<br><br>" +
            escapeHTML(
              error.message ||
              String(error)
            ),
            true
          );

        }

      }
    );


  } catch (error) {

    console.error(
      "USER-POST STARTUP ERROR:",
      error
    );


    showStatus(
      `
        <strong>user-post.js failed to start</strong>
        <br><br>
        ${escapeHTML(
          error.message ||
          String(error)
        )}
      `,
      true
    );

  }

}


// ============================================================
// LOAD POSTS
// ============================================================

async function loadPosts(db, uid) {

  showStatus("Loading posts from Firestore...");


  const {
    collection,
    getDocs
  } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );


  const postsSnapshot =
    await getDocs(
      collection(db, "posts")
    );


  console.log(
    "Total posts in database:",
    postsSnapshot.size
  );


  const posts = [];


  postsSnapshot.forEach(
    (postDoc) => {

      const data =
        postDoc.data();


      console.log(
        "Post:",
        postDoc.id,
        data
      );


      const ownerId =
        data.userId ||
        data.authorId ||
        data.uid ||
        data.ownerId ||
        data.createdBy;


      if (ownerId === uid) {

        posts.push({

          id: postDoc.id,

          ...data

        });

      }

    }
  );


  console.log(
    "Posts belonging to this user:",
    posts.length
  );


  // ----------------------------------------------------------
  // Sort newest first
  // ----------------------------------------------------------

  posts.sort(
    (a, b) => {

      return getTimestamp(b) -
             getTimestamp(a);

    }
  );


  const latestPosts =
    posts.slice(0, 10);


  if (latestPosts.length === 0) {

    showStatus(
      "This user has no posts yet."
    );

    return;

  }


  // ----------------------------------------------------------
  // Load profile
  // ----------------------------------------------------------

  const profile =
    await loadProfile(
      db,
      uid
    );


  postsContainer.innerHTML = "";


  latestPosts.forEach(
    (post) => {

      postsContainer.appendChild(
        createPostElement(
          post,
          profile
        )
      );

    }
  );

}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile(db, uid) {

  try {

    const {
      doc,
      getDoc
    } = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );


    const snap =
      await getDoc(
        doc(db, "users", uid)
      );


    if (!snap.exists()) {

      return {
        fullName: "VitalStar User",
        username: "",
        avatarURL: ""
      };

    }


    const user =
      snap.data();


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

    console.warn(
      "Profile could not be loaded:",
      error
    );


    return {

      fullName:
        "VitalStar User",

      username:
        "",

      avatarURL:
        ""

    };

  }

}


// ============================================================
// CREATE POST
// ============================================================

function createPostElement(post, profile) {

  const article =
    document.createElement("article");


  article.className =
    "post";


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
      ? "@" + profile.username
      : "";


  const time =
    formatDate(
      post.createdAt ||
      post.timestamp ||
      post.updatedAt
    );


  article.innerHTML = `

    <div class="post-header">

      <img
        class="avatar"
        src="${escapeHTML(avatar)}"
        alt="Profile picture"
        onerror="
          this.src='https://via.placeholder.com/100'
        "
      >

      <div>

        <div class="author">
          ${escapeHTML(profile.fullName)}
        </div>

        ${
          username
            ? `
              <div class="username">
                ${escapeHTML(username)}
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
// MEDIA
// ============================================================

function createMedia(post) {

  const url =
    post.mediaURL ||
    post.mediaUrl ||
    post.imageURL ||
    post.imageUrl ||
    post.videoURL ||
    post.videoUrl ||
    post.fileURL ||
    post.fileUrl ||
    "";


  if (!url) return "";


  const type =
    String(
      post.mediaType ||
      post.type ||
      ""
    ).toLowerCase();


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
      onerror="this.style.display='none'"
    >
  `;

}


// ============================================================
// TIME
// ============================================================

function getTimestamp(post) {

  return getTimestampValue(
    post.createdAt ||
    post.timestamp ||
    post.updatedAt
  );

}


function getTimestampValue(value) {

  if (!value) return 0;


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
    typeof value ===
    "number"
  ) {

    return value;

  }


  const date =
    new Date(value);


  return isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


function formatDate(value) {

  const time =
    getTimestampValue(value);


  if (!time) return "";


  return new Date(
    time
  ).toLocaleString();

}


// ============================================================
// SECURITY
// ============================================================

function escapeHTML(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ============================================================
// START
// ============================================================

startUserPosts();