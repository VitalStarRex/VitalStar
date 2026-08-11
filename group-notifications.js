// ============================================================
// VITALSTAR — group-notifications.js
// Complete group notification system
//
// Handles:
// - Real-time group notifications
// - Unread badge
// - Notification panel
// - Mark one notification as read
// - Mark all notifications as read
// - Relative timestamps
//
// Firestore structure:
//
// groups/{groupId}/notifications/{notificationId}
//
// {
//   recipientId: "USER_UID",
//   actorId: "USER_UID",
//   actorName: "Full Name",
//   actorPhotoURL: "",
//   type: "post",
//   title: "New group post",
//   message: "John created a new post.",
//   read: false,
//   createdAt: serverTimestamp()
// }
// ============================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// STATE
// ============================================================

let unsubscribeNotifications = null;

let notificationState = {
  notifications: [],
  db: null,
  auth: null,
  currentUser: null,
  groupId: null,
  listEl: null,
  unreadDotEl: null,
  showToast: null
};


// ============================================================
// INITIALIZE
// ============================================================

export async function init(ctx) {

  notificationState = {
    ...notificationState,
    ...ctx
  };

  const {
    db,
    currentUser,
    groupId,
    listEl,
    unreadDotEl
  } = notificationState;


  if (!db || !currentUser || !groupId) {
    console.error(
      "Group notifications: missing required context."
    );

    renderError("Notifications could not be loaded.");
    return;
  }


  if (!listEl) {
    console.error(
      "Group notifications: notificationsList element not found."
    );

    return;
  }


  // Clean up an old listener if this module is initialized again.
  if (unsubscribeNotifications) {
    unsubscribeNotifications();
    unsubscribeNotifications = null;
  }


  renderLoading();


  try {

    const notificationsRef = collection(
      db,
      "groups",
      groupId,
      "notifications"
    );


    // IMPORTANT:
    //
    // We intentionally do NOT use:
    //
    // orderBy("createdAt", "desc")
    //
    // together with where().
    //
    // That can require a Firestore composite index.
    //
    // Instead we retrieve the user's notifications and sort
    // them in JavaScript.

    const notificationsQuery = query(
      notificationsRef,
      where("recipientId", "==", currentUser.uid),
      limit(100)
    );


    unsubscribeNotifications = onSnapshot(
      notificationsQuery,

      (snapshot) => {

        const notifications = snapshot.docs.map(
          (notificationDoc) => ({
            id: notificationDoc.id,
            ...notificationDoc.data()
          })
        );


        // Sort newest first.
        notifications.sort((a, b) => {

          const aTime = getTimestampMillis(a.createdAt);
          const bTime = getTimestampMillis(b.createdAt);

          return bTime - aTime;

        });


        notificationState.notifications =
          notifications;


        renderNotifications();


        updateUnreadBadge();

      },

      (error) => {

        console.error(
          "Group notifications listener error:",
          error
        );

        renderError(
          "Notifications could not be loaded."
        );

        updateUnreadBadge();

      }
    );

  } catch (error) {

    console.error(
      "Could not initialize group notifications:",
      error
    );

    renderError(
      "Notifications could not be loaded."
    );

  }
}


// ============================================================
// GET TIMESTAMP
// ============================================================

function getTimestampMillis(timestamp) {

  if (!timestamp) {
    return 0;
  }


  // Firebase Timestamp
  if (
    typeof timestamp.toMillis === "function"
  ) {
    return timestamp.toMillis();
  }


  // JavaScript Date
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }


  // Number
  if (typeof timestamp === "number") {
    return timestamp;
  }


  // Serialized timestamp
  if (
    typeof timestamp.seconds === "number"
  ) {

    return timestamp.seconds * 1000;

  }


  return 0;
}


// ============================================================
// RELATIVE TIME
// ============================================================

function formatRelativeTime(timestamp) {

  const millis = getTimestampMillis(timestamp);

  if (!millis) {
    return "just now";
  }


  const difference =
    Math.max(0, Date.now() - millis);


  const seconds =
    Math.floor(difference / 1000);


  if (seconds < 10) {
    return "just now";
  }


  if (seconds < 60) {
    return `${seconds}s ago`;
  }


  const minutes =
    Math.floor(seconds / 60);


  if (minutes < 60) {
    return `${minutes}m ago`;
  }


  const hours =
    Math.floor(minutes / 60);


  if (hours < 24) {
    return `${hours}h ago`;
  }


  const days =
    Math.floor(hours / 24);


  if (days < 7) {
    return `${days}d ago`;
  }


  const date = new Date(millis);


  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric"
    }
  );
}


// ============================================================
// NOTIFICATION ICON
// ============================================================

function getNotificationIcon(type) {

  const icons = {

    post:
      "fa-solid fa-file-lines",

    comment:
      "fa-solid fa-comment",

    like:
      "fa-solid fa-heart",

    member:
      "fa-solid fa-user-plus",

    join:
      "fa-solid fa-user-plus",

    join_request:
      "fa-solid fa-user-clock",

    approved:
      "fa-solid fa-circle-check",

    removed:
      "fa-solid fa-user-minus",

    mention:
      "fa-solid fa-at",

    chat:
      "fa-solid fa-comments",

    admin:
      "fa-solid fa-shield",

    settings:
      "fa-solid fa-gear",

    system:
      "fa-solid fa-bell"

  };


  return icons[type] ||
    "fa-solid fa-bell";
}


// ============================================================
// RENDER LOADING
// ============================================================

function renderLoading() {

  if (!notificationState.listEl) {
    return;
  }


  notificationState.listEl.innerHTML = `
    <div class="notification-loading">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Loading notifications...</span>
    </div>
  `;
}


// ============================================================
// RENDER ERROR
// ============================================================

function renderError(message) {

  if (!notificationState.listEl) {
    return;
  }


  notificationState.listEl.innerHTML = `
    <div class="notification-empty notification-error">
      <i class="fa-solid fa-circle-exclamation"></i>
      <span></span>
    </div>
  `;


  const span =
    notificationState.listEl.querySelector(
      "span"
    );


  if (span) {
    span.textContent = message;
  }
}


// ============================================================
// RENDER NOTIFICATIONS
// ============================================================

function renderNotifications() {

  const listEl =
    notificationState.listEl;


  if (!listEl) {
    return;
  }


  const notifications =
    notificationState.notifications;


  listEl.innerHTML = "";


  if (!notifications.length) {

    listEl.innerHTML = `
      <div class="notification-empty">
        <div class="notification-empty-icon">
          <i class="fa-regular fa-bell"></i>
        </div>

        <div class="notification-empty-title">
          You're all caught up.
        </div>

        <div class="notification-empty-text">
          New group activity will appear here.
        </div>
      </div>
    `;

    return;
  }


  // Header controls
  const controls =
    document.createElement("div");

  controls.className =
    "notification-controls";


  const unreadCount =
    notifications.filter(
      notification => !notification.read
    ).length;


  controls.innerHTML = `
    <span class="notification-count">
      ${unreadCount}
      unread
    </span>

    <button
      type="button"
      class="mark-all-read-btn"
      ${unreadCount === 0 ? "disabled" : ""}
    >
      Mark all as read
    </button>
  `;


  const markAllBtn =
    controls.querySelector(
      ".mark-all-read-btn"
    );


  markAllBtn.addEventListener(
    "click",
    markAllAsRead
  );


  listEl.appendChild(controls);


  // Notification items
  notifications.forEach(
    notification => {

      const item =
        createNotificationElement(
          notification
        );

      listEl.appendChild(item);

    }
  );
}


// ============================================================
// CREATE NOTIFICATION ELEMENT
// ============================================================

function createNotificationElement(
  notification
) {

  const item =
    document.createElement("button");


  item.type = "button";


  item.className =
    "group-notification";


  if (!notification.read) {
    item.classList.add("is-unread");
  }


  const icon =
    getNotificationIcon(
      notification.type
    );


  const actorName =
    notification.actorName ||
    "VitalStar Member";


  const title =
    notification.title ||
    "Group notification";


  const message =
    notification.message ||
    "";


  const time =
    formatRelativeTime(
      notification.createdAt
    );


  const avatarHTML =
    notification.actorPhotoURL
      ? `<img
           src="${escapeAttribute(
             notification.actorPhotoURL
           )}"
           alt=""
         >`
      : `
        <span>
          ${escapeHTML(
            actorName.charAt(0).toUpperCase()
          )}
        </span>
      `;


  item.innerHTML = `

    <div class="group-notification-avatar">
      ${avatarHTML}
    </div>

    <div class="group-notification-icon">
      <i class="${icon}"></i>
    </div>

    <div class="group-notification-content">

      <div class="group-notification-title">
        ${escapeHTML(title)}
      </div>

      <div class="group-notification-message">
        ${escapeHTML(message)}
      </div>

      <div class="group-notification-time">
        ${escapeHTML(time)}
      </div>

    </div>

    ${
      !notification.read
        ? `<span class="notification-unread-dot"></span>`
        : ""
    }

  `;


  item.addEventListener(
    "click",
    () => markNotificationAsRead(notification)
  );


  return item;
}


// ============================================================
// MARK ONE AS READ
// ============================================================

async function markNotificationAsRead(
  notification
) {

  if (notification.read) {
    return;
  }


  try {

    const notificationRef =
      doc(
        notificationState.db,
        "groups",
        notificationState.groupId,
        "notifications",
        notification.id
      );


    await updateDoc(
      notificationRef,
      {
        read: true,
        readAt: new Date()
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

async function markAllAsRead() {

  const unread =
    notificationState.notifications.filter(
      notification => !notification.read
    );


  if (!unread.length) {
    return;
  }


  try {

    const batch =
      writeBatch(
        notificationState.db
      );


    unread.forEach(
      notification => {

        const notificationRef =
          doc(
            notificationState.db,
            "groups",
            notificationState.groupId,
            "notifications",
            notification.id
          );


        batch.update(
          notificationRef,
          {
            read: true,
            readAt: new Date()
          }
        );

      }
    );


    await batch.commit();


    if (typeof notificationState.showToast === "function") {

      notificationState.showToast(
        "All notifications marked as read.",
        "success"
      );

    }

  } catch (error) {

    console.error(
      "Could not mark all notifications as read:",
      error
    );


    if (typeof notificationState.showToast === "function") {

      notificationState.showToast(
        "Could not mark notifications as read.",
        "error"
      );

    }

  }
}


// ============================================================
// UPDATE BADGE
// ============================================================

function updateUnreadBadge() {

  const unreadCount =
    notificationState.notifications.filter(
      notification => !notification.read
    ).length;


  const badge =
    notificationState.unreadDotEl;


  if (!badge) {
    return;
  }


  badge.classList.toggle(
    "is-visible",
    unreadCount > 0
  );


  // Support either a dot or a number badge.
  if (
    badge.dataset &&
    badge.dataset.numeric === "true"
  ) {

    badge.textContent =
      unreadCount > 99
        ? "99+"
        : String(unreadCount);

  }

}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

  return escapeHTML(value);

}


// ============================================================
// CLEANUP
// ============================================================

export function destroy() {

  if (unsubscribeNotifications) {

    unsubscribeNotifications();

    unsubscribeNotifications = null;

  }

}


// ============================================================
// CREATE NOTIFICATION HELPER
//
// Other group modules can import this function.
//
// Example:
//
// import {
//   createGroupNotification
// } from "./group-notifications.js";
//
// await createGroupNotification(db, groupId, {
//   recipientId: userId,
//   actorId: currentUser.uid,
//   actorName: currentUser.displayName,
//   actorPhotoURL: currentUser.photoURL,
//   type: "post",
//   title: "New group post",
//   message: "John created a new post."
// });
// ============================================================

export async function createGroupNotification(
  db,
  groupId,
  data
) {

  if (!db || !groupId || !data?.recipientId) {

    console.warn(
      "createGroupNotification: missing required data."
    );

    return null;
  }


  try {

    const notificationsRef =
      collection(
        db,
        "groups",
        groupId,
        "notifications"
      );


    const notificationData = {

      recipientId:
        data.recipientId,

      actorId:
        data.actorId || "",

      actorName:
        data.actorName ||
        "VitalStar Member",

      actorPhotoURL:
        data.actorPhotoURL ||
        "",

      type:
        data.type ||
        "system",

      title:
        data.title ||
        "Group notification",

      message:
        data.message ||
        "",

      read: false,

      createdAt:
        data.createdAt ||
        new Date()

    };


    const notificationRef =
      await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
      ).then(
        firestore =>
          firestore.addDoc(
            notificationsRef,
            notificationData
          )
      );


    return notificationRef.id;

  } catch (error) {

    console.error(
      "Could not create group notification:",
      error
    );

    return null;

  }
}