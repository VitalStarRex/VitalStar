 import { db } from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const feed = document.getElementById("feed");

const q = query(
  collection(db, "posts"),
  orderBy("createdAt", "desc")
);

onSnapshot(q, (snapshot) => {

  feed.innerHTML = "";

  snapshot.forEach((doc) => {

    const post = doc.data();
    const postId = doc.id;

    feed.innerHTML += `

      <div style="
        background:white;
        margin:15px;
        padding:15px;
        border-radius:15px;
        box-shadow:0 2px 8px rgba(0,0,0,.15);
      ">

        <div style="display:flex;align-items:center;gap:10px;">

          <div style="
            width:45px;
            height:45px;
            border-radius:50%;
            background:#1877f2;
            color:white;
            display:flex;
            justify-content:center;
            align-items:center;
            font-size:20px;
          ">
            👤
          </div>

          <div>
            <h3 style="margin:0;">
              ${post.username || "VitalStar User"}
            </h3>

            <small>
              ${
                post.createdAt
                  ? post.createdAt.toDate().toLocaleString()
                  : "Just now"
              }
            </small>
          </div>

        </div>

        <p style="margin-top:15px;font-size:16px;">
          ${post.text || ""}
        </p>

        <hr>

        <div style="
          display:flex;
          justify-content:space-around;
          margin-top:10px;
          font-size:17px;
        ">

          <button>❤️ ${post.likes || 0}</button>

          <button>💬 ${post.comments || 0}</button>

          <button>🔁 ${post.reposts || 0}</button>

          <button>🔗 ${post.shares || 0}</button>

        </div>

      </div>

    `;

  });

});