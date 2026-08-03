import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";     
                                         
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const feed = document.getElementById("feed");



// LOAD POSTS

const postsQuery = query(
    collection(db,"posts"),
    orderBy("createdAt","desc"),
    limit(10)
);



onSnapshot(postsQuery,(snapshot)=>{


    feed.innerHTML = "";


    if(snapshot.empty){

        feed.innerHTML = `
        <p style="
        text-align:center;
        padding:20px;
        ">
        No posts yet. Be the first to post ⭐
        </p>
        `;

        return;

    }



    snapshot.forEach((docSnap)=>{


        const post = docSnap.data();

        const postId = docSnap.id;



        let date = "Just now";


        if(post.createdAt){

            try{

                date = post.createdAt
                .toDate()
                .toLocaleString();

            }catch(e){}

        }



        feed.innerHTML += `

<div class="post-card">


<div class="user-info">


<div class="avatar">

👤

</div>


<div>

<h3>

<a href="profile.html?uid=${post.uid}">

${post.fullName || "VitalStar User"}

</a>

</h3>


<small>
${date}
</small>


</div>


</div>




<p>
${post.text || ""}
</p>




${post.image ? 

`
<img class="post-photo"
src="${post.image}">
`

:""}





<div class="post-buttons">


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



},(error)=>{


console.error(error);


feed.innerHTML = `

<p style="color:red;text-align:center">

Unable to load posts

</p>

`;


});






// LIKE SYSTEM


window.likePost = async function(postId){


const user = auth.currentUser;


if(!user){

alert("Please login first");

return;

}



const likeId = postId+"_"+user.uid;


const likeRef = doc(db,"likes",likeId);


const likeSnap = await getDoc(likeRef);


const postRef = doc(db,"posts",postId);



if(likeSnap.exists()){


await deleteDoc(likeRef);


await updateDoc(postRef,{

likes:increment(-1)

});


// Send like notification

const postSnap = await getDoc(postRef);

if (postSnap.exists()) {

    const postData = postSnap.data();

    // Don't notify yourself
    if (postData.uid !== user.uid) {

        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists()) {

            const currentUser = userSnap.data();

            await addDoc(collection(db, "notifications"), {

                receiverId: postData.uid,
                senderId: user.uid,
                senderName: currentUser.fullName || currentUser.username,
                senderPhoto: currentUser.profilePicture || "",
                text: "liked your post ❤️",
                postId: postId,
                read: false,
                createdAt: serverTimestamp()

            });

        }

    }

}






}

else{


await setDoc(likeRef,{

uid:user.uid,

postId:postId,

createdAt:new Date()

});



await updateDoc(postRef,{

likes:increment(1)

});


}


};






// OPEN COMMENTS


window.openComments=function(postId){

window.location.href =
"comments.html?postId="+postId;

};























// WELCOME MESSAGE

auth.onAuthStateChanged(async(user)=>{

if(!user) return;

// Set user online
await updateDoc(doc(db, "users", user.uid), {
    online: true,
    lastSeen: serverTimestamp()
});

const userSnap =
await getDoc(doc(db,"users",user.uid));

if(userSnap.exists()){

const fullName =
userSnap.data().fullName || "User";

const hour =
new Date().getHours();

let greeting =
"Good Evening";

if(hour < 12){
    greeting="Good Morning";
}
else if(hour < 17){
    greeting="Good Afternoon";
}

const welcome =
document.getElementById("welcomeText");

if(welcome){
    welcome.innerHTML =
`${greeting}, <span style="color:#FFD54F">
${fullName}
</span> 👋`;
}

}

});






// ===============================
// UNREAD NOTIFICATION BADGE
// ===============================

const notificationBadge =
document.getElementById("notificationBadge");

onAuthStateChanged(auth, (user) => {

    if (!user) return;

    const notificationQuery = query(
        collection(db, "notifications"),
        where("receiverId", "==", user.uid)
    );

    onSnapshot(notificationQuery, (snapshot) => {

        let unreadNotifications = 0;

        snapshot.forEach((notificationDoc) => {

            const notification = notificationDoc.data();

            if (notification.read === false) {
                unreadNotifications++;
            }

        });

        if (unreadNotifications > 0) {

            notificationBadge.textContent = unreadNotifications;

        } else {

            notificationBadge.textContent = "0";

        }

    });

});