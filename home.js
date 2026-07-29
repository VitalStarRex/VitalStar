import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const feed = document.getElementById("feed");


const q = query(
  collection(db, "posts"),
  orderBy("createdAt", "desc")
);


onSnapshot(q, (snapshot) => {

  feed.innerHTML = "";


  snapshot.forEach((docSnap) => {

    const post = docSnap.data();
    const postId = docSnap.id;


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

              <a href="profile.html?uid=${post.uid}"
              style="text-decoration:none;color:black;">

              ${post.username || "VitalStar User"}

              </a>

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


          <button onclick="likePost('${postId}')">
          ❤️ ${post.likes || 0}
          </button>


         
          <button onclick="openComments('${postId}')">
💬 ${post.comments || 0}
</button>



          <button>
          🔁 ${post.reposts || 0}
          </button>


          <button>
          🔗 ${post.shares || 0}
          </button>


        </div>


      </div>

    `;


  });


});



// LIKE SYSTEM

window.likePost = async function(postId){


  const user = auth.currentUser;


  if(!user){

    alert("Please login first");

    return;

  }



  const likeId = postId + "_" + user.uid;


  const likeRef = doc(db,"likes",likeId);


  const likeSnap = await getDoc(likeRef);



  const postRef = doc(db,"posts",postId);



  if(likeSnap.exists()){


    // REMOVE LIKE

    await deleteDoc(likeRef);


    await updateDoc(postRef,{

      likes: increment(-1)

    });


  }

  else{


    // ADD LIKE

    await setDoc(likeRef,{

      postId:postId,

      uid:user.uid,

      createdAt:new Date()

    });


    await updateDoc(postRef,{

      likes:increment(1)

    });


  }


};