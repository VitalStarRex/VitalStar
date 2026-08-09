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

onAuthStateChanged(auth, (user) => {

  if (!user) {
    location.href = "login.html";
    return;
  }

  const statusRef = ref(rtdb, "status");

  onValue(statusRef, async (snapshot) => {

    usersDiv.innerHTML = "";

    if (!snapshot.exists()) {
      usersDiv.innerHTML = `<div class="no-users">No users online</div>`;
      return;
    }

    const promises = [];

    snapshot.forEach((child) => {

      const uid = child.key;
      const data = child.val();

      // Only show other users who are currently online
      if (data?.state === "online" && uid !== user.uid) {
        promises.push(loadUser(uid));
      }

    });

    const users = await Promise.all(promises);

    const validUsers = users.filter(Boolean);

    if (validUsers.length === 0) {
      usersDiv.innerHTML = `<div class="no-users">No other users online</div>`;
      return;
    }

    usersDiv.innerHTML = validUsers.join("");

  });

});


async function loadUser(uid) {

  try {

    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists()) return null;

    const u = snap.data();

    const fullName = u.fullName || "VitalStar User";
    const username = u.username || "user";
    const photoURL = u.photoURL || "default-avatar.png";

    return `

      <a class="user" href="profile.html?uid=${encodeURIComponent(uid)}">

        <img
          src="${photoURL}"
          alt="${fullName}"
          onerror="this.src='default-avatar.png'"
        >

        <div class="user-info">

          <div class="name">
            ${fullName}
          </div>

          <div class="username">
            @${username}
          </div>

        </div>

        <div class="online"></div>

      </a>

    `;

  } catch (error) {

    console.error("Failed to load user:", uid, error);
    return null;

  }

}