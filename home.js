import { db, auth } from "./firebase.js";

import {
addDoc,
collection,
serverTimestamp,
doc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


window.createPost = async function(){

const text = document.getElementById("postText").value;

const user = auth.currentUser;


if(!user){
alert("Please login first");
return;
}


// Get user profile
const userSnap = await getDoc(
doc(db,"users",user.uid)
);


let username = "VitalStar User";


if(userSnap.exists()){

username = userSnap.data().username;

}



await addDoc(collection(db,"posts"),{

uid:user.uid,

username:username,

text:text,

likes:0,

comments:0,

shares:0,

reposts:0,

createdAt:serverTimestamp()

});


alert("Post created successfully");

};