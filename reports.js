import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OWNER_UID = "FvbfTXi65VgpuPtBxr8kGzBRLRr1";
const reports = document.getElementById("reports");

onAuthStateChanged(auth, (user) => {

    if (!user) {
        location.href = "login.html";
        return;
    }

    if (user.uid !== OWNER_UID) {
        alert("Access Denied!");
        location.href = "index.html";
        return;
    }

    loadReports();

});

function loadReports() {

    const q = query(
        collection(db, "reports"),
        orderBy("createdAt", "desc")
    );

    onSnapshot