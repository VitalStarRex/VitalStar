import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    updateDoc,
    increment,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const followBtn = document.getElementById("followBtn");
const followers = document.getElementById("followers");

followBtn.addEventListener("click", async () => {

    const user = auth.currentUser;

    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("uid");

    if (!profileUid || profileUid === user.uid) return;

    try {

        const followingRef = doc(db, "users", user.uid, "following", profileUid);
        const followerRef = doc(db, "users", profileUid, "followers", user.uid);

        const followingSnap = await getDoc(followingRef);

        if (followingSnap.exists()) {

            await deleteDoc(followingRef);
            await deleteDoc(followerRef);

            await updateDoc(doc(db, "users", user.uid), {
                followingCount: increment(-1)
            });

            await updateDoc(doc(db, "users", profileUid), {
                followersCount: increment(-1)
            });

            followBtn.textContent = "➕ Follow";
            followers.textContent = Number(followers.textContent) - 1;

        } else {

            await setDoc(followingRef, {
                followedAt: serverTimestamp()
            });

            await setDoc(followerRef, {
                followedAt: serverTimestamp()
            });

            await updateDoc(doc(db, "users", user.uid), {
                followingCount: increment(1)
            });

            await updateDoc(doc(db, "users", profileUid), {
                followersCount: increment(1)
            });

            const currentUser = (await getDoc(doc(db, "users", user.uid))).data();

            await addDoc(collection(db, "notifications"), {
                userId: profileUid,
                senderId: user.uid,
                type: "follow",
                message: `${currentUser.fullName} started following you.`,
                read: false,
                createdAt: serverTimestamp()
            });

            followBtn.textContent = "✓ Following";
            followers.textContent = Number(followers.textContent) + 1;
        }

    } catch (err) {
        console.error(err);
        alert(err.message);
    }

});
