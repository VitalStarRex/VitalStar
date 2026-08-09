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
  console.error("❌ Element #users was not found in the HTML.");
}

onAuthStateChanged(auth, (user) => {

  console.log("AUTH USER:", user);

  if (!user) {
    console.log("❌ No logged-in user");
    location.href = "login.html";
    return;
  }

  console.log("✅ Logged in:", user.uid);

  const statusRef = ref(rtdb, "status");

  onValue(
    statusRef,
    async (snapshot) => {

      console.log("RTDB STATUS:", snapshot.val());

      usersDiv.innerHTML = "";

      if (!snapshot.exists()) {
        usersDiv.innerHTML = "<p>No online users</p>";
        console.log("❌ status does not exist");
        return;
      }

      const onlineUsers = [];

      snapshot.forEach((child) => {

        const uid = child.key;
        const data = child.val();

        console.log("USER STATUS:", uid, data);

        if (
          data &&
          data.state === "online" &&
          uid !== user.uid
        ) {
          onlineUsers.push(uid);
        }

      });

      console.log("ONLINE OTHER USERS:", onlineUsers);

      if (onlineUsers.length === 0) {
        usersDiv.innerHTML = "<p>No other users online</p>";
        return;
      }

      for (const uid of onlineUsers) {

        try {

          const userSnap = await getDoc(
            doc(db, "users", uid)
          );

          console.log(
            "FIRESTORE USER:",
            uid,
            userSnap.exists() ? userSnap.data() : "NOT FOUND"
          );

          if (!userSnap.exists()) continue;

          const u = userSnap.data();

          const fullName =
            u.fullName ||
            u.fullname ||
            u.displayName ||
            "VitalStar User";

          const username =
            u.username ||
            "user";

          const photoURL =
            u.photoURL ||
            u.profilePicture ||
            u.avatar ||
            "default-avatar.png";

          usersDiv.innerHTML += `

            <a class="user" href="profile.html?uid=${encodeURIComponent(uid)}">

              <img
                src="${photoURL}"
                alt="${fullName}"
                onerror="this.src='default-avatar.png'"
              >

              <div>
                <div class="name">${fullName}</div>
                <div class="username">@${username}</div>
              </div>

              <div class="online"></div>

            </a>

          `;

        } catch (error) {

          console.error(
            "❌ Firestore error for user:",
            uid,
            error
          );

        }

      }

    },

    (error) => {

      console.error("❌ RTDB ERROR:", error);

      usersDiv.innerHTML =
        "<p>Unable to load online users.</p>";

    }
  );

});