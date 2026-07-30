import { auth } from "./firebase.js";

import {
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const logoutBtn=document.getElementById("logoutBtn");


logoutBtn.addEventListener("click",()=>{

signOut(auth)
.then(()=>{

window.location.href="login.html";

});

});