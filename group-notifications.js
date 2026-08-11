
// ============================================================
// VITALSTAR — group-notifications.js
// Group notification panel
//
// Handles:
// - Loading group notifications
// - Unread notification indicator
// - Marking notifications as read
// - Real-time notification updates
// - Safe fallback when no notifications exist
//
// Expected Firestore collection:
// notifications
//
// Expected notification fields:
// groupId
// receiverId
// senderId
// senderName
// senderPhotoURL
// type
// message
// postId
// createdAt
// read
// ============================================================

import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// MODULE STATE
// ============================================================

let state = {
  db: null,
  auth: null,
  currentUser: null,
  groupId: null,
  listEl: null,
  unreadDotEl: null,
  showToast: null,
  unsubscribe: null
};


// ============================================================
// INIT
// ============================================================

export async function init(ctx) {

  state.db = ctx.db;
  state.auth = ctx.auth;
  state.currentUser = ctx.currentUser;
  state.groupId = ctx.groupId;
  state.listEl = ctx.listEl;
  state.unreadDotEl = ctx.unreadDotEl;
  state.showToast = ctx.showToast;

  if (!state.db || !state.currentUser || !state.groupId) {
    renderEmpty("Notifications are unavailable.");
    return;
  }

  renderLoading();

  startNotificationListener();
}


// ============================================================
// LOAD NOTIFICATIONS
// ============================================================

function startNotificationListener() {

  // Clean up an old listener if the module is initialized again.
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }


  const notificationsRef = collection(
    state.db,
    "notifications"
  );


  /*
   * IMPORTANT:
   *
   * We intentionally do NOT use:
   *
   * orderBy("createdAt", "desc")
   *
   * together with where().
   *
   * That combination can require a Firestore composite index.
   *
   * We load a limited set and sort them in JavaScript instead.
   */

  const notificationsQuery = query(
    notificationsRef,
    where("groupId", "==", state.groupId),
    limit(50)
  );


  state.unsubscribe = onSnapshot(
    notificationsQuery,

    (snapshot) => {

      const notifications = snapshot.docs.map((notificationDoc) => ({
        id: notificationDoc.id,
        ...notificationDoc.data()
      }));


      // Sort newest first without requiring a Firestore index.
      notifications.sort((a, b) => {

        const aTime = getTimestampMillis(a.createdAt);
        const bTime = getTimestampMillis(b.createdAt);

        return bTime - aTime;

      });


      renderNotifications(notifications);

    },

    (error) => {

      console.error(
        "Group notifications listener error:",
        error
      );


      /*
       * Do not make the whole group page fail because
       * notifications are unavailable.
       */

      renderEmpty("You're all caught up.");

      if (state.unreadDotEl) {
        state.unreadDotEl.classList.remove("is-visible");
        state.unreadDotEl.style.display = "none";
      }

    }
  );
}


// ============================================================
// TIMESTAMP HELPER
// ============================================================

function getTimestampMillis(timestamp) {

  if (!timestamp) return 0;


  if (
    typeof timestamp.toMillis === "function"
  ) {
    return timestamp.toMillis();
  }


  if (
    typeof timestamp.toDate === "function"
  ) {
    return timestamp.toDate().getTime();
  }


  if (timestamp.seconds) {
    return timestamp.seconds * 1000;
  }


  if (typeof timestamp === "string") {

    const parsed = Date.parse(timestamp);

    return Number.isNaN(parsed)
      ? 0
      : parsed;

  }


  return 0;
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatNotificationTime(timestamp) {

  const millis = getTimestampMillis(timestamp);

  if (!millis) {
    return "Just now";
  }


  const date = new Date(millis);
  const now = Date.now();

  const difference = Math.max(
    0,
    now - millis
  );


  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;


  if (difference < minute) {
    return "Just now";
  }


  if (difference < hour) {

    const minutes = Math.floor(
      difference / minute
    );

    return `${minutes}m ago`;

  }


  if (difference < day) {

    const hours = Math.floor(
      difference / hour
    );

    return `${hours}h ago`;

  }


  if (difference < 7 * day) {

    const days = Math.floor(
      difference / day
    );

    return `${days}d ago`;

  }


  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric"
    }
  );
}


// ============================================================
// RENDER LOADING
// ============================================================

function renderLoading() {

  if (!state.listEl) return;


  state.listEl.innerHTML = `
    <div class="group-notifications-loading">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Loading notifications...</span>
    </div>
  `;

}


// ============================================================
// RENDER EMPTY
// ============================================================

function renderEmpty(message = "You're all caught up.") {

  if (!state.listEl) return;


  state.listEl.innerHTML = `
    <div class="group-notifications-empty">
      <div class="group-notifications-empty-icon">
        <i class="fa-regular fa-bell"></i>
      </div>

      <div class="group-notifications-empty-title">
        ${escapeHTML(message)}
      </div>

      <div class="group-notifications-empty-text">
        New group activity will appear here.
      </div>
    </div>
  `;

}


// ============================================================
// RENDER NOTIFICATIONS
// ============================================================

function renderNotifications(notifications) {

  if (!state.listEl) return;


  if (!notifications.length) {

    renderEmpty();

    updateUnreadIndicator([]);

    return;
  }


  const unreadCount = notifications.filter(
    notification => notification.read !== true &&
      notification.receiverId === state.currentUser.uid
  ).length;


  updateUnreadIndicator(notifications);


  state.listEl.innerHTML = "";


  notifications.forEach((notification) => {

    const item = createNotificationElement(
      notification
    );

    state.listEl.appendChild(item);

  });

}


// ============================================================
// CREATE NOTIFICATION ELEMENT
// ============================================================

function createNotificationElement(notification) {

  const item = document.createElement("div");

  item.className = "group-notification-item";


  if (notification.read !== true) {
    item.classList.add("is-unread");
  }


  const avatar = document.createElement("div");

  avatar.className =
    "group-notification-avatar";


  const photo =
    notification.senderPhotoURL ||
    notification.photoURL ||
    "";


  const senderName =
    notification.senderName ||
    notification.displayName ||
    "VitalStar Member";


  if (photo) {

    avatar.style.backgroundImage =
      `url("${safeURL(photo)}")`;

    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";

  } else {

    avatar.textContent =
      getInitial(senderName);

  }


  const content = document.createElement("div");

  content.className =
    "group-notification-content";


  const text = document.createElement("div");

  text.className =
    "group-notification-text";


  text.textContent =
    buildNotificationMessage(
      notification,
      senderName
    );


  const time = document.createElement("div");

  time.className =
    "group-notification-time";


  time.textContent =
    formatNotificationTime(
      notification.createdAt
    );


  content.appendChild(text);
  content.appendChild(time);


  if (notification.read !== true) {

    const unread = document.createElement("span");

    unread.className =
      "group-notification-unread";

    unread.setAttribute(
      "aria-label",
      "Unread"
    );

    item.appendChild(unread);

  }


  item.appendChild(avatar);
  item.appendChild(content);


  item.addEventListener(
    "click",
    () => handleNotificationClick(notification)
  );


  return item;
}


// ============================================================
// BUILD NOTIFICATION MESSAGE
// ============================================================

function buildNotificationMessage(
  notification,
  senderName
) {

  const type = notification.type || "general";


  if (notification.message) {

    return notification.message;

  }


  switch (type) {

    case "join":
    case "member_joined":
      return `${senderName} joined the group.`;

    case "post":
    case "new_post":
      return `${senderName} created a new post.`;

    case "comment":
    case "new_comment":
      return `${senderName} commented on a post.`;

    case "like":
    case "post_like":
      return `${senderName} liked a post.`;

    case "mention":
      return `${senderName} mentioned you.`;

    case "invite":
      return `${senderName} invited you to the group.`;

    case "request":
    case "join_request":
      return `${senderName} requested to join the group.`;

    case "approval":
    case "approved":
      return `${senderName} approved a group request.`;

    case "announcement":
      return `${senderName} posted a group announcement.`;

    case "admin":
      return `${senderName} sent a group notification.`;

    default:
      return `${senderName} sent a group notification.`;

  }
}


// ============================================================
// UNREAD INDICATOR
// ============================================================

function updateUnreadIndicator(notifications) {

  if (!state.unreadDotEl) return;


  const unreadExists = notifications.some(
    notification =>
      notification.read !== true &&
      notification.receiverId === state.currentUser.uid
  );


  state.unreadDotEl.classList.toggle(
    "is-visible",
    unreadExists
  );


  state.unreadDotEl.style.display =
    unreadExists
      ? ""
      : "none";

}


// ============================================================
// CLICK NOTIFICATION
// ============================================================

async function handleNotificationClick(notification) {

  await markNotificationAsRead(
    notification.id
  );


  // Open the related post when possible.
  if (notification.postId) {

    const postId =
      encodeURIComponent(
        notification.postId
      );


    window.location.href =
      `group.html?id=${encodeURIComponent(
        state.groupId
      )}&post=${postId}`;

    return;
  }

}


// ============================================================
// MARK ONE NOTIFICATION READ
// ============================================================

async function markNotificationAsRead(
  notificationId
) {

  if (!notificationId) return;


  try {

    await updateDoc(
      doc(
        state.db,
        "notifications",
        notificationId
      ),
      {
        read: true
      }
    );

  } catch (error) {

    console.error(
      "Could not mark notification as read:",
      error
    );

  }

}


// ============================================================
// MARK ALL AS READ
// ============================================================

export async function markAllAsRead() {

  if (!state.db || !state.currentUser) {
    return;
  }


  try {

    const notificationsRef =
      collection(
        state.db,
        "notifications"
      );


    const notificationsQuery = query(
      notificationsRef,
      where(
        "groupId",
        "==",
        state.groupId
      ),
      limit(50)
    );


    const snapshot =
      await getDocs(
        notificationsQuery
      );


    const unreadDocs =
      snapshot.docs.filter(
        notificationDoc => {

          const data =
            notificationDoc.data();

          return (
            data.receiverId ===
              state.currentUser.uid &&
            data.read !== true
          );

        }
      );


    if (!unreadDocs.length) {

      updateUnreadIndicator([]);

      return;

    }


    const batch =
      writeBatch(state.db);


    unreadDocs.forEach(
      notificationDoc => {

        batch.update(
          notificationDoc.ref,
          {
            read: true
          }
        );

      }
    );


    await batch.commit();


    updateUnreadIndicator([]);

  } catch (error) {

    console.error(
      "Could not mark notifications as read:",
      error
    );

  }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ============================================================
// SAFE URL
// ============================================================

function safeURL(value) {

  const url = String(value || "");

  if (
    url.startsWith("https://") ||
    url.startsWith("http://")
  ) {
    return url.replaceAll('"', "%22");
  }


  return "";

}


// ============================================================
// INITIAL
// ============================================================

function getInitial(name) {

  return (
    String(name || "V")
      .trim()
      .charAt(0)
      .toUpperCase() || "V"
  );

}