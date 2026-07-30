import { db } from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const usersList = document.getElementById("usersList");

const q = query(
  collection(db, "users"),
  orderBy("fullname", "asc")
);

onSnapshot(q, (snapshot) => {

  usersList.innerHTML = "";

  snapshot.forEach((doc) => {

    const user = doc.data();

    usersList.innerHTML += `
      <div class="user" onclick="location.href='profile.html?uid=${doc.id}'">
        <div class="avatar">
          ${user.fullname.charAt(0).toUpperCase()}
        </div>

        <div class="info">
          <div class="name">${user.fullname}</div>
          <div class="status">Tap to chat</div>
        </div>
      </div>
    `;

  });

});