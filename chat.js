import { auth, db } from "./firebase.js";


import {
doc,
getDoc,
collection,
addDoc,
query,
orderBy,
limit,
onSnapshot,
serverTimestamp,
setDoc,
updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// HTML Elements
const backBtn = document.getElementById("backBtn");
const chatAvatar = document.getElementById("chatAvatar");
const chatName = document.getElementById("chatName");
const chatStatus = document.getElementById("chatStatus");

const messages = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");

const imageBtn = document.getElementById("imageBtn");
const videoBtn = document.getElementById("videoBtn");
const recordBtn = document.getElementById("recordBtn");

// Cloudinary Upload

async function uploadToCloudinary(file){

const formData = new FormData();

formData.append("file", file);

formData.append(
"upload_preset",
"vitalstar_upload"
);

const response = await fetch(
"https://api.cloudinary.com/v1_1/m0scmqqv/auto/upload",
{
method:"POST",
body:formData
}
);

const data = await response.json();

console.log(data);

return data.secure_url;

}

// Open file picker

imageBtn.onclick = ()=>{
imageInput.click();
};

videoBtn.onclick = ()=>{
videoInput.click();
};

// Voice recording

let recorder;
let audioChunks=[];

recordBtn.onclick = async()=>{

if(!recorder || recorder.state==="inactive"){

const stream =
await navigator.mediaDevices.getUserMedia({
audio:true
});

recorder = new MediaRecorder(stream);

audioChunks=[];

recorder.ondataavailable=(e)=>{

audioChunks.push(e.data);

};

recorder.onstop=async()=>{

const audioBlob =
new Blob(audioChunks,{
type:"audio/webm"
});

const url =
await uploadToCloudinary(audioBlob);

window.voiceUrl=url;

alert("Voice note ready 🎤");

};

recorder.start();

recordBtn.textContent="⏹";

}
else{

recorder.stop();

recordBtn.textContent="🎤";

}

};

// Get receiver UID

const params =
new URLSearchParams(window.location.search);

const receiverUid =
params.get("uid");

// Back button

backBtn.onclick=()=>{

history.back();

};

// Login check

auth.onAuthStateChanged(async(user)=>{

if(!user){

window.location.href="login.html";

return;

}


const chatId =
user.uid < receiverUid
?
user.uid + "_" + receiverUid
:
receiverUid + "_" + user.uid;


await updateDoc(doc(db, "chats", chatId), {
    lastRead: true,
    lastDelivered: true
});



const receiverRef =
doc(db,"users",receiverUid);

const receiverSnap =
await getDoc(receiverRef);

if(receiverSnap.exists()){

const data =
receiverSnap.data();

chatName.textContent =
data.fullName || data.username;

chatName.style.cursor = "pointer";

chatName.onclick = () => {
    window.location.href = `profile.html?uid=${receiverUid}`;
};

chatAvatar.src =
data.profilePicture ||
"https://via.placeholder.com/50";

chatStatus.textContent="Online";

}

const messagesRef =
collection(db,"chats",chatId,"messages");

// Send message

messageForm.addEventListener(
"submit",
async(e)=>{

e.preventDefault();

const text =
messageInput.value.trim();

let image="";
let video="";
let audio="";

try{

if(imageInput.files[0]){

image =
await uploadToCloudinary(
imageInput.files[0]
);

}

if(videoInput.files[0]){

video =
await uploadToCloudinary(
videoInput.files[0]
);

}

if(window.voiceUrl){

audio =
window.voiceUrl;

window.voiceUrl="";

}

if(!text && !image && !video && !audio)
return;

await addDoc(messagesRef, {
senderId: user.uid,
receiverId: receiverUid,

text: text,  
image: image,  
video: video,  
audio: audio,  

timestamp: serverTimestamp(),  

sent: true,  
delivered: false,  
read: false

});

await setDoc(
doc(db, "chats", chatId),
{
participants: [user.uid, receiverUid],

lastMessage:
text ||
(image ? "📷 Photo" :
video ? "🎥 Video" :
audio ? "🎤 Voice message" : ""),

lastImage: image,
lastVideo: video,
lastAudio: audio,

lastTimestamp: serverTimestamp(),  

    lastSenderId: user.uid,  
    lastReceiverId: receiverUid,  

    lastRead: false,  
    lastDelivered: false  
},  
{ merge: true }

);

messageInput.value="";

imageInput.value="";

videoInput.value="";

}
catch(err){

console.error(err);

alert("Failed to send message");

}

});

// Display messages




const q =
query(
messagesRef,
orderBy("timestamp","desc"),
limit(15)
);





























onSnapshot(q, (snapshot) => {

messages.innerHTML = "";

snapshot.forEach(async (messageDoc) => {

const msg = messageDoc.data();

let delivered = msg.delivered || false;
let read = msg.read || false;


// Mark received messages as delivered and read
if(msg.receiverId === user.uid && (!delivered || !read)){

    await updateDoc(messageDoc.ref,{
        delivered:true,
        read:true
    });

    delivered = true;
    read = true;

}



await updateDoc(doc(db, "chats", chatId), {
    lastDelivered: true,
    lastRead: true
});



// Message bubble

const div = document.createElement("div");

div.className =
msg.senderId === user.uid
?
"message sent"
:
"message received";


// Time

let messageTime="";

const date = msg.timestamp?.toDate?.();

if(date){

messageTime =
date.toLocaleTimeString([],{
hour:"numeric",
minute:"2-digit"
});

}


// Status

let status="";

if(msg.senderId === user.uid){

status="✓ Sent";

if(delivered){
status="✓✓ Delivered";
}

if(read){
status="✓✓ Read";
}

}


// HTML

div.innerHTML = `

${msg.text ? `<p>${msg.text}</p>` : ""}


${msg.image ?
`<img src="${msg.image}" width="200">`
:
""}


${msg.video ?
`
<video controls width="220">
<source src="${msg.video}">
</video>
`
:
""}


${msg.audio ?
`
<audio controls>
<source src="${msg.audio}">
</audio>
`
:
""}



<div class="message-footer">

<span class="message-time">
${messageTime}
</span>


<span class="message-status">
${status}
</span>

</div>

`;


messages.appendChild(div);

});

messages.scrollTop = messages.scrollHeight;

}); // End onSnapshot

}); // End auth.onAuthStateChanged