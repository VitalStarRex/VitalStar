import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
    }
});





import { db, auth } from "./firebase.js";

import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    getDoc,
    setDoc,
    deleteDoc
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

${post.fullname || "VitalStar User"}

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