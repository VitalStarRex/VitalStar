
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentUser = null;

// Check login
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
});

// ----------------------
// Image Preview
// ----------------------

const coverInput = document.getElementById("coverInput");
const profileInput = document.getElementById("profileInput");

coverInput.addEventListener("change", () => {
    const file = coverInput.files[0];

    if (!file) return;

    document.getElementById("coverPreview").src =
        URL.createObjectURL(file);
});

profileInput.addEventListener("change", () => {
    const file = profileInput.files[0];

    if (!file) return;

    document.getElementById("profilePreview").src =
        URL.createObjectURL(file);
});

// ----------------------
// Premium Price
// ----------------------

const groupType =
document.getElementById("groupType");

groupType.addEventListener("change", () => {

    document.getElementById("priceBox").style.display =
        groupType.value === "premium"
        ? "block"
        : "none";

});

// ----------------------
// Cloudinary Upload
// ----------------------

async function uploadToCloudinary(file){

    const type = file.type.startsWith("video")
        ? "video"
        : "image";

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
        "upload_preset",
        "vitalstar_upload"
    );

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/m0scmqqv/${type}/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    return data.secure_url || "";

}







// ----------------------
// Create Group
// ----------------------

const createBtn = document.getElementById("createBtn");

createBtn.addEventListener("click", createGroup);

async function createGroup() {

    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    const name = document.getElementById("groupName").value.trim();
    const description = document.getElementById("description").value.trim();
    const category = document.getElementById("category").value;
    const privacy = document.getElementById("privacy").value;
    const type = document.getElementById("groupType").value;
    const rules = document.getElementById("rules").value.trim();

    let price = 0;

    if (type === "premium") {
        price = Number(document.getElementById("price").value);

        if (!price || price <= 0) {
            alert("Enter a valid subscription price.");
            return;
        }
    }

    if (!name) {
        alert("Enter a group name.");
        return;
    }

    const coverFile = document.getElementById("coverInput").files[0];
    const profileFile = document.getElementById("profileInput").files[0];

    let coverPhoto = "";
    let profilePhoto = "";

    if (coverFile) {
        coverPhoto = await uploadToCloudinary(coverFile);

        if (!coverPhoto) {
            alert("Cover photo upload failed.");
            return;
        }
    }

    if (profileFile) {
        profilePhoto = await uploadToCloudinary(profileFile);

        if (!profilePhoto) {
            alert("Profile picture upload failed.");
            return;
        }
    }

    // Get owner's profile
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    let ownerName = "VitalStar User";

    if (userSnap.exists()) {
        ownerName = userSnap.data().fullName || ownerName;
    }

    // Create group document
    const groupRef = await addDoc(collection(db, "groups"), {
        name,
        description,
        category,
        privacy,
        type,
        price,
        rules,
        coverPhoto,
        profilePhoto,
        ownerId: currentUser.uid,
        ownerName,
        memberCount: 1,
        postCount: 0,
        createdAt: serverTimestamp()
    });

    // Add owner as first member
    await setDoc(
       