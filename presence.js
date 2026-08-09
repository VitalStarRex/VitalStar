// ============================================================
// VITALSTAR — online-users.js
// Shows other users who are currently online
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
  throw new Error("#users element not found");
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, (user) => {

  if (!user) {
    location.href = "login.html";
    return;
  }

  loadOnlineUsers(user.uid);

});


// ============================================================
// LOAD ONLINE USERS
// ============================================================

function loadOnlineUsers(currentUid) {

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


      const onlineUIDs = [];


      // ========================================================
      // CHECK EACH USER'S ONLINE STATUS
      // ========================================================

      snapshot.forEach((child) => {

        const uid = child.key;
        const data = child.val();


        /*
          IMPORTANT:

          Your presence code uses:

          online: true

          NOT:

          state: "online"
        */

        if (
          uid &&
          uid !== currentUid &&
          data &&
          data.online === true
        ) {

          onlineUIDs.push(uid);

        }

      });


      console.log(
        "VitalStar online users:",
        onlineUIDs
      );


      if (onlineUIDs.length === 0) {

        usersDiv.innerHTML = `
          <div class="no-users">
            No other users online
          </div>
        `;

        return;
      }


      // ========================================================
      // LOAD USER PROFILES FROM FIRESTORE
      // ========================================================

      const userCards = await Promise.all(

        onlineUIDs.map(async (uid) => {

          try {

            const userRef = doc(db, "users", uid);

            const userSnap = await getDoc(userRef);


            if (!userSnap.exists()) {
              console.warn(
                "User profile not found:",
                uid
              );

              return "";
            }


            const user = userSnap.data();


            const fullName =
              user.fullName ||
              user.fullname ||
              user.displayName ||
              "VitalStar User";


            const username =
              user.username ||
              "user";


            const photoURL =
              user.photoURL ||
              user.profilePicture ||
              user.avatar ||
              "default-avatar.png";


            return `

              <a
                class="user"
                href="profile.html?uid=${encodeURIComponent(uid)}"
              >

                <img
                  class="user-avatar"
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

                <span class="online"></span>

              </a>

            `;

          } catch (error) {

            console.error(
              "Error loading user:",
              uid,
              error
            );

            return "";

          }

        })

      );


      const validCards =
        userCards.filter(Boolean);


      if (validCards.length === 0) {

        usersDiv.innerHTML = `
          <div class="no-users">
            No other users online
          </div>
        `;

        return;
      }


      usersDiv.innerHTML =
        validCards.join("");

    },


    // ========================================================
    // RTDB ERROR
    // ========================================================

    (error) => {

      console.error(
        "VitalStar RTDB error:",
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