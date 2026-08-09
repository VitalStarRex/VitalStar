// ============================================================
// VITALSTAR — online-users.js
// Shows ALL currently online users, including the current user
// ============================================================

import { auth, db, rtdb } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const usersDiv = document.getElementById("users");

if (!usersDiv) {
  console.error("VitalStar: #users element not found.");
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {
    location.href = "login.html";
    return;
  }

  loadOnlineUsers();

});


// ============================================================
// LOAD ONLINE USERS
// ============================================================

function loadOnlineUsers() {

  const statusRef = ref(rtdb, "status");

  onValue(
    statusRef,

    async (snapshot) => {

      usersDiv.innerHTML = "";

      if (!snapshot.exists()) {

        usersDiv.innerHTML = `
          <div class="no-users">
            No users online
          </div>
        `;

        return;
      }


      const onlineUsers = [];


      // Get EVERY online user
      snapshot.forEach((child) => {

        const uid = child.key;
        const status = child.val();

        if (
          uid &&
          status &&
          status.online === true
        ) {
          onlineUsers.push(uid);
        }

      });


      if (onlineUsers.length === 0) {

        usersDiv.innerHTML = `
          <div class="no-users">
            No users online
          </div>
        `;

        return;
      }


      // ========================================================
      // LOAD EACH USER FROM FIRESTORE
      // ========================================================

      for (const uid of onlineUsers) {

        try {

          const userSnap = await getDoc(
            doc(db, "users", uid)
          );


          if (!userSnap.exists()) {
            continue;
          }


          const data = userSnap.data();


          const fullName =
            data.fullName ||
            data.fullname ||
            data.displayName ||
            "VitalStar User";


          const username =
            data.username ||
            "user";


          const photoURL =
            data.photoURL ||
            data.profilePicture ||
            data.avatar ||
            "default-avatar.png";


          const userLink = document.createElement("a");

          userLink.className = "user";

          userLink.href =
            "profile.html?uid=" +
            encodeURIComponent(uid);


          userLink.innerHTML = `

            <img
              src="${escapeHTML(photoURL)}"
              alt="${escapeHTML(fullName)}"
              onerror="this.src='default-avatar.png'"
            >

            <div class="user-details">

              <div class="name">
                ${escapeHTML(fullName)}
              </div>

              <div class="username">
                @${escapeHTML(username)}
              </div>

            </div>

            <div class="online"></div>

          `;


          usersDiv.appendChild(userLink);


        } catch (error) {

          console.error(
            "Error loading online user:",
            uid,
            error
          );

        }

      }


      if (!usersDiv.children.length) {

        usersDiv.innerHTML = `
          <div class="no-users">
            No users online
          </div>
        `;

      }

    },


    // ========================================================
    // RTDB ERROR
    // ========================================================

    (error) => {

      console.error(
        "Realtime Database error:",
        error
      );

      usersDiv.innerHTML = `
        <div class="no-users">
          Unable to load online users.
        </div>
      `;

    }

  );

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}