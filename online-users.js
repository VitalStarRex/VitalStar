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

onAuthStateChanged(auth,(user)=>{

if(!user){
location.href="login.html";
return;
}

const statusRef = ref(rtdb,"status");

onValue(statusRef,async(snapshot)=>{

usersDiv.innerHTML="";

if(!snapshot.exists()) return;

const promises=[];

snapshot.forEach(child=>{

const uid=child.key;
const data=child.val();

if(data.state==="online" && uid!==user.uid){

promises.push(loadUser(uid));

}

});

await Promise.all(promises);

});

});

async function loadUser(uid){

const snap=await getDoc(doc(db,"users",uid));

if(!snap.exists()) return;

const u=snap.data();

usersDiv.innerHTML+=`

<a class="user" href="profile.html?uid=${uid}">
<img src="${u.photoURL || 'default-avatar.png'}">

<div>
<div class="name">${u.fullName}</div>
<div class="username">@${u.username}</div>
</div>

<div class="online"></div>

</a>

`;

}