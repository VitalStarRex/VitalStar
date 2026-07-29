import { db } from "./firebase.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");

const userRef = doc(db, "users", uid);
const userSnap = await getDoc(userRef);

if (userSnap.exists()) {

    const user = userSnap.data();

}