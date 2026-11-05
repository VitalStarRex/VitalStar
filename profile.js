// ============================================================
// VITALSTAR — PROFILE PAGE
// Friends + Privacy Protection + Posts + Footer + Button Control
// Small loading indicators (no full-screen loader)
// Theme is controlled by home.html (theme.css / theme.js)
// Firebase v10.12.2
// ============================================================

import { auth, db, rtdb } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// OWNER
// ============================================================

const VITALSTAR_OWNER_UID = "FvbfTXi65VgpuPtBxr8kGzBRLRr1";


// ============================================================
// OFFLINE PLACEHOLDERS (no external image service needed)
// ============================================================

const PLACEHOLDER_AVATAR =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect width="200" height="200" fill="#151a2d"/>
            <circle cx="100" cy="78" r="38" fill="#7c35ff"/>
            <path d="M35 180 C42 130 70 112 100 112 C130 112 158 130 165 180Z" fill="#00cfff"/>
        </svg>
    `);

const PLACEHOLDER_COVER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="350" viewBox="0 0 1200 350">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#0a1f5c"/>
                    <stop offset="1" stop-color="#050b1f"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="350" fill="url(#g)"/>
        </svg>
    `);


// ============================================================
// ELEMENTS
// ============================================================

const profileName = document.getElementById("fullName");
const username = document.getElementById("username");
const profileImage = document.getElementById("profilePicture");
const coverImage = document.getElementById("coverPhoto");
const bio = document.getElementById("bio");
const country = document.getElementById("country");
const dob = document.getElementById("dob");
const gender = document.getElementById("gender");
const rank = document.getElementById("rank");
const lastSeen = document.getElementById("lastSeen");
const followersCount = document.getElementById("followers");
const followingCount = document.getElementById("following");
const postsCount = document.getElementById("posts");
const gallery = document.getElementById("gallery");
const editButton = document.getElementById("editProfileBtn");
const followButton = document.getElementById("followBtn");
const messageButton = document.getElementById("messageBtn");


// ============================================================
// PROFILE UID
// ============================================================

const params = new URLSearchParams(window.location.search);

let profileUid = params.get("uid") || params.get("id");


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let isFriend = false;
let requestSent = false;
let requestReceived = false;
let allProfilePosts = [];
let postsLoading = false;
let statusUnsubscribe = null;


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value || "";

    return div.innerHTML;
}

function escapeAttribute(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// ============================================================
// FOOTER + BUTTON (locked until the profile finishes loading)
// ============================================================

function getFooterCreatePostButton() {

    return (
        document.getElementById("createPostBtn") ||
        document.getElementById("footerCreatePost") ||
        document.getElementById("createPost") ||
        document.querySelector(".bottom-nav .create-btn")
    );
}

function lockFooterPlus() {

    const plus = getFooterCreatePostButton();

    if (!plus)
        return;

    plus.classList.add("vitalstar-plus-locked");
    plus.classList.remove("vitalstar-plus-unlocked");
    plus.setAttribute("aria-disabled", "true");
}

function unlockFooterPlus() {

    const plus = getFooterCreatePostButton();

    if (!plus)
        return;

    plus.classList.remove("vitalstar-plus-locked");
    plus.classList.add("vitalstar-plus-unlocked");
    plus.removeAttribute("aria-disabled");
}

function setupFooterPlus() {

    lockFooterPlus();

    const plus = getFooterCreatePostButton();

    if (!plus)
        return;

    if (plus.dataset.vitalstarCreatePostBound === "true")
        return;

    plus.dataset.vitalstarCreatePostBound = "true";

    plus.addEventListener("click", event => {

        event.preventDefault();

        if (plus.classList.contains("vitalstar-plus-locked"))
            return;

        window.location.href = "create-post.html";
    });
}

setupFooterPlus();


// ============================================================
// SMALL LOADING INDICATORS
// ============================================================

function createMiniLoader(text = "Loading") {

    const wrapper = document.createElement("div");

    wrapper.className = "vs-mini-loader";

    wrapper.setAttribute("role", "status");

    wrapper.innerHTML = `
        <div class="vs-mini-pill">
            <div class="vs-mini-ring"><span>VS</span></div>
            <span class="vs-mini-text">${escapeHTML(text)}<i>.</i><i>.</i><i>.</i></span>
        </div>
    `;

    return wrapper;
}

function showLoadingIndicator(text = "Loading profile") {

    const slot = document.getElementById("profileLoading");

    if (!slot)
        return;

    slot.innerHTML = "";

    slot.appendChild(createMiniLoader(text));
}

function removeLoadingIndicator() {

    const slot = document.getElementById("profileLoading");

    if (slot)
        slot.innerHTML = "";
}

function showPostsLoadingIndicator() {

    if (!gallery)
        return;

    const existing = document.getElementById("postsLoadingIndicator");

    if (existing)
        existing.remove();

    const holder = document.createElement("div");

    holder.id = "postsLoadingIndicator";

    holder.appendChild(createMiniLoader("Loading posts"));

    gallery.appendChild(holder);
}

function hideLoader() {

    removeLoadingIndicator();
}


// ============================================================
// FRIEND BUTTON
// ============================================================

function createFriendButton() {

    let button = document.getElementById("friendBtn");

    if (!button) {

        button = document.createElement("button");

        button.id = "friendBtn";
        button.type = "button";
        button.className = "friend-add";
        button.innerHTML = "👥 Add Friend";

        const actions =
            document.querySelector(".buttons") ||
            followButton?.parentElement ||
            messageButton?.parentElement;

        if (actions)
            actions.appendChild(button);
    }

    return button;
}

function setFriendButton(button, html, stateClass) {

    button.innerHTML = html;

    button.classList.remove(
        "friend-add",
        "friend-remove",
        "friend-pending",
        "friend-accept"
    );

    button.classList.add(stateClass);
}


// ============================================================
// SHOW / HIDE PROFILE ELEMENTS
// ============================================================

function profileElements() {

    return [
        profileName,
        username,
        bio,
        country,
        dob,
        gender,
        rank,
        lastSeen,
        profileImage,
        coverImage
    ];
}

function showProfileElements() {

    profileElements().forEach(element => {

        if (element)
            element.style.display = "";
    });
}

function showPrivateProfileMessage() {

    profileElements().forEach(element => {

        if (element)
            element.style.display = "none";
    });

    if (followButton)
        followButton.style.display = "none";

    if (messageButton)
        messageButton.style.display = "none";

    const friendBtn = createFriendButton();

    friendBtn.style.display =
        currentUser && currentUser.uid !== profileUid
            ? ""
            : "none";

    if (gallery) {

        gallery.innerHTML = `
            <div class="vs-private">
                <div class="lock">🔒</div>
                <h2>Private Profile</h2>
                <p>This profile is visible only to friends.</p>
                <p class="small">Send a friend request to connect.</p>
            </div>
        `;
    }
}


// ============================================================
// ADMIN CHECK
// ============================================================

async function checkViewerIsAdmin(viewerUid) {

    if (!viewerUid)
        return false;

    if (viewerUid === VITALSTAR_OWNER_UID)
        return true;

    try {

        const snap = await getDoc(doc(db, "users", viewerUid));

        if (!snap.exists())
            return false;

        const data = snap.data();

        return (
            data.isAdmin === true ||
            data.admin === true ||
            data.role === "admin"
        );

    } catch (error) {

        console.error("Admin check failed:", error);

        return false;
    }
}


// ============================================================
// FRIEND KEY
// ============================================================

function friendKey(uid1, uid2) {

    return [uid1, uid2].sort().join("_");
}


// ============================================================
// FRIEND CHECK
// ============================================================

async function checkIfFriends(viewerUid, targetUid) {

    if (!viewerUid || !targetUid)
        return false;

    if (viewerUid === targetUid)
        return true;

    try {

        const friendshipSnap =
            await getDoc(doc(db, "friends", friendKey(viewerUid, targetUid)));

        if (friendshipSnap.exists()) {

            const data = friendshipSnap.data();

            if (
                Array.isArray(data.users) &&
                data.users.includes(viewerUid) &&
                data.users.includes(targetUid)
            ) {
                return true;
            }
        }

        const friendsSnapshot = await getDocs(
            query(
                collection(db, "friends"),
                where("users", "array-contains", viewerUid)
            )
        );

        for (const friendDoc of friendsSnapshot.docs) {

            const data = friendDoc.data();

            if (
                Array.isArray(data.users) &&
                data.users.includes(viewerUid) &&
                data.users.includes(targetUid)
            ) {
                return true;
            }
        }

        return false;

    } catch (error) {

        console.error("Friend check failed:", error);

        return false;
    }
}


// ============================================================
// FRIEND REQUEST STATUS
// ============================================================

async function checkFriendRequestStatus(viewerUid, targetUid) {

    requestSent = false;
    requestReceived = false;

    try {

        const sentSnapshot = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", viewerUid)
            )
        );

        for (const requestDoc of sentSnapshot.docs) {

            const data = requestDoc.data();

            if (data.to === targetUid && data.status === "pending") {

                requestSent = true;

                break;
            }
        }

        const receivedSnapshot = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("to", "==", viewerUid)
            )
        );

        for (const requestDoc of receivedSnapshot.docs) {

            const data = requestDoc.data();

            if (data.from === targetUid && data.status === "pending") {

                requestReceived = true;

                break;
            }
        }

    } catch (error) {

        console.error("Friend request check failed:", error);
    }
}


// ============================================================
// FIND SENT REQUEST
// ============================================================

async function findSentFriendRequest() {

    if (!currentUser || !profileUid)
        return null;

    try {

        const snapshot = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", currentUser.uid)
            )
        );

        for (const requestDoc of snapshot.docs) {

            const data = requestDoc.data();

            if (data.to === profileUid && data.status === "pending")
                return requestDoc;
        }

    } catch (error) {

        console.error("Find request error:", error);
    }

    return null;
}


// ============================================================
// NOTIFICATION
// ============================================================

async function createFriendNotification(targetUid, type, extra = {}) {

    if (!currentUser)
        return;

    try {

        const notificationId =
            `${type}_${currentUser.uid}_${targetUid}_${Date.now()}`;

        await setDoc(
            doc(db, "notifications", notificationId),
            {
                uid: targetUid,
                fromUid: currentUser.uid,
                type,
                read: false,
                createdAt: Date.now(),
                ...extra
            }
        );

    } catch (error) {

        console.error("Notification error:", error);
    }
}


// ============================================================
// UPDATE FRIEND BUTTON
// ============================================================

async function updateFriendButton() {

    const button = createFriendButton();

    if (!button)
        return;

    if (
        !currentUser ||
        !profileUid ||
        currentUser.uid === profileUid
    ) {

        button.style.display = "none";

        return;
    }

    button.style.display = "";
    button.disabled = false;

    isFriend = await checkIfFriends(currentUser.uid, profileUid);

    if (!isFriend)
        await checkFriendRequestStatus(currentUser.uid, profileUid);

    if (isFriend) {

        setFriendButton(button, "❌ Remove Friend", "friend-remove");

        return;
    }

    if (requestSent) {

        setFriendButton(button, "⏳ Cancel Request", "friend-pending");

        return;
    }

    if (requestReceived) {

        setFriendButton(button, "✅ Accept Friend", "friend-accept");

        return;
    }

    setFriendButton(button, "👥 Add Friend", "friend-add");
}


// ============================================================
// SEND FRIEND REQUEST
// ============================================================

async function sendFriendRequest() {

    if (
        !currentUser ||
        !profileUid ||
        currentUser.uid === profileUid
    ) {
        return;
    }

    const button = createFriendButton();

    button.disabled = true;
    button.innerHTML = "⏳ Sending...";

    try {

        const existing = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("from", "==", currentUser.uid)
            )
        );

        for (const requestDoc of existing.docs) {

            const data = requestDoc.data();

            if (data.to === profileUid && data.status === "pending") {

                requestSent = true;

                await updateFriendButton();

                return;
            }
        }

        const requestRef = doc(collection(db, "friendRequests"));

        await setDoc(
            requestRef,
            {
                from: currentUser.uid,
                to: profileUid,
                status: "pending",
                createdAt: Date.now()
            }
        );

        await createFriendNotification(
            profileUid,
            "friend_request",
            { requestId: requestRef.id }
        );

        requestSent = true;

        await updateFriendButton();

    } catch (error) {

        console.error("Send friend request error:", error);

        alert("Unable to send friend request.");

        await updateFriendButton();
    }
}


// ============================================================
// CANCEL FRIEND REQUEST
// ============================================================

async function cancelFriendRequest() {

    if (!currentUser || !profileUid)
        return;

    const button = createFriendButton();

    button.disabled = true;
    button.innerHTML = "⏳ Cancelling...";

    try {

        const requestDoc = await findSentFriendRequest();

        if (requestDoc)
            await deleteDoc(requestDoc.ref);

        requestSent = false;

        await updateFriendButton();

    } catch (error) {

        console.error("Cancel friend request error:", error);

        alert("Unable to cancel friend request.");

        await updateFriendButton();
    }
}


// ============================================================
// ACCEPT FRIEND REQUEST
// ============================================================

async function acceptFriendRequest() {

    if (!currentUser || !profileUid)
        return;

    try {

        const snapshot = await getDocs(
            query(
                collection(db, "friendRequests"),
                where("to", "==", currentUser.uid)
            )
        );

        let requestDoc = null;

        for (const item of snapshot.docs) {

            const data = item.data();

            if (data.from === profileUid && data.status === "pending") {

                requestDoc = item;

                break;
            }
        }

        if (!requestDoc) {

            await updateFriendButton();

            return;
        }

        const friendshipId = friendKey(currentUser.uid, profileUid);

        await setDoc(
            doc(db, "friends", friendshipId),
            {
                users: [currentUser.uid, profileUid],
                key: friendshipId,
                createdAt: Date.now()
            }
        );

        await setDoc(
            requestDoc.ref,
            {
                status: "accepted",
                acceptedAt: Date.now()
            },
            { merge: true }
        );

        await createFriendNotification(
            profileUid,
            "friend_accepted",
            { friendId: currentUser.uid }
        );

        isFriend = true;
        requestReceived = false;

        await updateFriendButton();

        await loadProfile();

    } catch (error) {

        console.error("Accept friend request error:", error);

        alert("Unable to accept friend request.");
    }
}


// ============================================================
// REMOVE ACCEPTED REQUESTS (keeps the home stories list in sync)
// ============================================================

async function deleteAcceptedRequestsBetween(uidA, uidB) {

    try {

        const pairs = [[uidA, uidB], [uidB, uidA]];

        for (const [from, to] of pairs) {

            const snapshot = await getDocs(
                query(
                    collection(db, "friendRequests"),
                    where("from", "==", from)
                )
            );

            for (const requestDoc of snapshot.docs) {

                const data = requestDoc.data();

                if (data.to === to && data.status === "accepted")
                    await deleteDoc(requestDoc.ref);
            }
        }

    } catch (error) {

        console.warn("Could not clean accepted requests:", error);
    }
}


// ============================================================
// REMOVE FRIEND
// ============================================================

async function removeFriend() {

    if (
        !currentUser ||
        !profileUid ||
        currentUser.uid === profileUid
    ) {
        return;
    }

    if (!confirm("Remove this person from your friends?"))
        return;

    const button = createFriendButton();

    button.disabled = true;
    button.innerHTML = "⏳ Removing...";

    try {

        let removed = false;

        const friendshipRef =
            doc(db, "friends", friendKey(currentUser.uid, profileUid));

        const friendshipSnap = await getDoc(friendshipRef);

        if (friendshipSnap.exists()) {

            const data = friendshipSnap.data();

            if (
                Array.isArray(data.users) &&
                data.users.includes(currentUser.uid) &&
                data.users.includes(profileUid)
            ) {

                await deleteDoc(friendshipRef);

                removed = true;
            }
        }

        if (!removed) {

            const friendsSnapshot = await getDocs(
                query(
                    collection(db, "friends"),
                    where("users", "array-contains", currentUser.uid)
                )
            );

            for (const friendDoc of friendsSnapshot.docs) {

                const data = friendDoc.data();

                if (
                    Array.isArray(data.users) &&
                    data.users.includes(currentUser.uid) &&
                    data.users.includes(profileUid)
                ) {

                    await deleteDoc(friendDoc.ref);

                    removed = true;

                    break;
                }
            }
        }

        if (removed)
            await deleteAcceptedRequestsBetween(currentUser.uid, profileUid);

        isFriend = false;
        requestSent = false;
        requestReceived = false;

        await updateFriendButton();

        if (!removed)
            alert("The friendship could not be found.");

    } catch (error) {

        console.error("Remove friend error:", error);

        alert("Unable to remove friend. Check your Firestore permissions.");

        await updateFriendButton();
    }
}


// ============================================================
// FRIEND BUTTON CLICK
// ============================================================

document.addEventListener("click", async event => {

    const button = event.target.closest("#friendBtn");

    if (!button || button.disabled)
        return;

    if (!currentUser || currentUser.uid === profileUid)
        return;

    if (isFriend) {

        await removeFriend();

        return;
    }

    if (requestReceived) {

        await acceptFriendRequest();

        return;
    }

    if (requestSent) {

        await cancelFriendRequest();

        return;
    }

    await sendFriendRequest();
});


// ============================================================
// PRIVACY SYSTEM
// ============================================================

async function canViewProfile(viewerUid, targetUid, profileData) {

    if (viewerUid === targetUid)
        return true;

    if (await checkViewerIsAdmin(viewerUid))
        return true;

    let privacy = profileData?.profilePrivacy;

    if (
        privacy === undefined ||
        privacy === null ||
        String(privacy).trim() === ""
    ) {
        privacy = "public";
    }

    privacy = String(privacy).trim().toLowerCase();

    if (privacy === "public")
        return true;

    if (privacy === "friends")
        return await checkIfFriends(viewerUid, targetUid);

    return true;
}


// ============================================================
// STORED COUNTS
// ============================================================

function getStoredCount(data, possibleNames) {

    for (const name of possibleNames) {

        const value = data[name];

        if (typeof value === "number")
            return value;

        if (typeof value === "string" && value.trim() !== "") {

            const number = Number(value);

            if (Number.isFinite(number))
                return number;
        }

        if (Array.isArray(value))
            return value.length;
    }

    return null;
}

async function loadCount(target, uid, profileData, names, subcollection) {

    if (!target)
        return;

    const stored = getStoredCount(profileData, names);

    if (stored !== null) {

        target.textContent = stored;

        return;
    }

    try {

        const snapshot =
            await getDocs(collection(db, "users", uid, subcollection));

        target.textContent = snapshot.size;

    } catch (error) {

        console.error(`${subcollection} count error:`, error);

        target.textContent = "0";
    }
}

function loadFollowersCount(uid, profileData) {

    return loadCount(
        followersCount,
        uid,
        profileData,
        ["followersCount", "followerCount", "followers"],
        "followers"
    );
}

function loadFollowingCount(uid, profileData) {

    return loadCount(
        followingCount,
        uid,
        profileData,
        ["followingCount", "followingsCount", "following"],
        "following"
    );
}


// ============================================================
// LAST SEEN
// ============================================================

function formatLastSeen(timestamp) {

    if (!timestamp)
        return "⚪ Offline";

    let time = timestamp;

    if (
        typeof timestamp === "object" &&
        typeof timestamp.toMillis === "function"
    ) {
        time = timestamp.toMillis();
    }

    const seconds = Math.floor((Date.now() - time) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (seconds < 60)
        return "🟢 Last seen just now";

    if (minutes < 60)
        return `⚪ Last seen ${minutes}m ago`;

    if (hours < 24)
        return `⚪ Last seen ${hours}h ago`;

    if (days < 7)
        return `⚪ Last seen ${days}d ago`;

    return `⚪ Last seen ${weeks}w ago`;
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (!currentUser || !profileUid) {

        hideLoader();

        unlockFooterPlus();

        return;
    }

    lockFooterPlus();

    showLoadingIndicator("Loading profile");

    try {

        const profileSnap = await getDoc(doc(db, "users", profileUid));

        if (!profileSnap.exists()) {

            if (gallery) {

                gallery.innerHTML = `
                    <div class="vs-note"><h2>Profile Not Found</h2></div>
                `;
            }

            return;
        }

        const data = profileSnap.data();

        const allowed =
            await canViewProfile(currentUser.uid, profileUid, data);

        if (!allowed) {

            showPrivateProfileMessage();

            await updateFriendButton();

            return;
        }

        showProfileElements();

        if (profileName) {

            profileName.textContent =
                data.fullName || data.name || "VitalStar User";
        }

        if (username) {

            const handle =
                typeof data.username === "string" ? data.username : "";

            username.textContent =
                handle
                    ? (handle.startsWith("@") ? handle : "@" + handle)
                    : "@username";
        }

        if (bio)
            bio.textContent = data.bio || "No bio yet.";

        if (country) {

            country.textContent =
                data.country ? `🌍 ${data.country}` : "🌍 Country";
        }

        if (dob) {

            const birthday = data.dob || data.dateOfBirth || "";

            dob.textContent = birthday ? `🎂 ${birthday}` : "🎂 Birthday";
        }

        if (gender) {

            gender.textContent =
                data.gender ? `🚻 ${data.gender}` : "🚻 Gender";
        }

        if (profileImage) {

            const imageURL =
                data.profilePicture ||
                data.photoURL ||
                data.profileImage ||
                data.avatar ||
                data.photo ||
                "";

            profileImage.onerror = () => {

                profileImage.onerror = null;

                profileImage.src = PLACEHOLDER_AVATAR;
            };

            profileImage.src = imageURL || PLACEHOLDER_AVATAR;
        }

        if (coverImage) {

            const coverURL =
                data.coverPicture ||
                data.coverPhoto ||
                data.coverImage ||
                data.coverURL ||
                "";

            coverImage.onerror = () => {

                coverImage.onerror = null;

                coverImage.src = PLACEHOLDER_COVER;
            };

            coverImage.src = coverURL || PLACEHOLDER_COVER;
        }

        if (rank) {

            if (profileUid === VITALSTAR_OWNER_UID) {

                rank.textContent = "👑 Owner";

            } else {

                rank.textContent =
                    data.rank ? `🏅 ${data.rank}` : "🏅 Member";
            }
        }

        const viewingOwnProfile = currentUser.uid === profileUid;

        if (viewingOwnProfile) {

            createFriendButton().style.display = "none";

            if (editButton)
                editButton.style.display = "";

            if (followButton)
                followButton.style.display = "none";

            if (messageButton)
                messageButton.style.display = "none";

        } else {

            if (editButton)
                editButton.style.display = "none";

            if (followButton)
                followButton.style.display = "";

            if (messageButton)
                messageButton.style.display = "";

            await updateFriendButton();
        }

        if (!viewingOwnProfile && followButton) {

            try {

                const followingSnap = await getDoc(
                    doc(db, "users", currentUser.uid, "following", profileUid)
                );

                followButton.textContent =
                    followingSnap.exists() ? "Following" : "Follow";

            } catch (error) {

                console.error("Follow status error:", error);
            }
        }

        await Promise.allSettled([
            loadFollowersCount(profileUid, data),
            loadFollowingCount(profileUid, data)
        ]);

        if (lastSeen) {

            // Replace any earlier listener so reloads never stack them
            if (statusUnsubscribe) {

                statusUnsubscribe();

                statusUnsubscribe = null;
            }

            statusUnsubscribe = onValue(
                ref(rtdb, `status/${profileUid}`),
                snapshot => {

                    const status = snapshot.val();

                    if (status && status.online === true) {

                        lastSeen.textContent = "🟢 Online";
                        lastSeen.style.color = "#32df72";

                    } else if (status && status.lastSeen) {

                        lastSeen.textContent = formatLastSeen(status.lastSeen);
                        lastSeen.style.color = "";

                    } else {

                        lastSeen.textContent = "⚪ Offline";
                        lastSeen.style.color = "";
                    }
                }
            );
        }

        await loadProfilePosts(profileUid);

    } catch (error) {

        console.error("Profile loading error:", error);

        if (gallery) {

            gallery.innerHTML = `
                <div class="vs-note">Unable to load profile.</div>
            `;
        }

    } finally {

        unlockFooterPlus();

        hideLoader();
    }
}


// ============================================================
// LOAD POSTS
// ============================================================

async function loadProfilePosts(uid) {

    if (!gallery || postsLoading)
        return;

    postsLoading = true;

    try {

        showPostsLoadingIndicator();

        const snapshot = await getDocs(
            query(collection(db, "posts"), where("uid", "==", uid))
        );

        if (postsCount)
            postsCount.textContent = snapshot.size;

        allProfilePosts = snapshot.docs.sort((a, b) =>
            getPostTime(b.data().createdAt) - getPostTime(a.data().createdAt)
        );

        renderVisiblePosts();

    } catch (error) {

        console.error("Posts loading error:", error);

        if (postsCount)
            postsCount.textContent = "0";

        gallery.innerHTML = `
            <div class="vs-note">Unable to load posts.</div>
        `;

    } finally {

        postsLoading = false;
    }
}


// ============================================================
// RENDER POSTS
// ============================================================

function renderVisiblePosts() {

    if (!gallery)
        return;

    gallery.innerHTML = "";

    if (allProfilePosts.length === 0) {

        gallery.innerHTML = `<div class="vs-note">No posts yet.</div>`;

        return;
    }

    // Show only the first 10 posts
    allProfilePosts.slice(0, 10).forEach(renderPostCard);

    // VIEW MORE → user-posts.html
    if (allProfilePosts.length > 10) {

        const seeMore = document.createElement("button");

        seeMore.type = "button";
        seeMore.id = "seeMorePostsBtn";
        seeMore.className = "view-more-btn";
        seeMore.textContent = "View More Posts";

        seeMore.addEventListener("click", () => {

            if (!profileUid)
                return;

            seeMore.disabled = true;
            seeMore.textContent = "Opening...";

            window.location.href =
                `user-posts.html?uid=${encodeURIComponent(profileUid)}`;
        });

        gallery.appendChild(seeMore);
    }
}


// ============================================================
// RENDER SINGLE POST
// ============================================================

function renderPostCard(postDoc) {

    const post = postDoc.data();

    const card = document.createElement("div");

    card.className = "post-card";

    const text = post.text || post.content || "";

    let mediaHTML = "";

    if (post.image) {

        mediaHTML += `
            <img
                src="${escapeAttribute(post.image)}"
                alt="Post image"
                loading="lazy"
            >
        `;
    }

    if (post.video) {

        mediaHTML += `
            <video
                src="${escapeAttribute(post.video)}"
                controls
                preload="metadata"
                playsinline
            ></video>
        `;
    }

    card.innerHTML = `
        ${text ? `<div class="post-text">${escapeHTML(text)}</div>` : ""}
        ${mediaHTML}
    `;

    gallery.appendChild(card);
}


// ============================================================
// POST TIME
// ============================================================

function getPostTime(timestamp) {

    if (!timestamp)
        return 0;

    if (
        typeof timestamp === "object" &&
        typeof timestamp.toMillis === "function"
    ) {
        return timestamp.toMillis();
    }

    if (typeof timestamp === "number")
        return timestamp;

    if (typeof timestamp === "string") {

        const parsed = Date.parse(timestamp);

        return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}


// ============================================================
// EDIT PROFILE
// ============================================================

if (editButton) {

    editButton.addEventListener("click", () => {

        window.location.href = "edit-profile.html";
    });
}


// ============================================================
// MESSAGE
// ============================================================

if (messageButton) {

    messageButton.addEventListener("click", () => {

        if (!profileUid)
            return;

        window.location.href =
            `chat.html?uid=${encodeURIComponent(profileUid)}`;
    });
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async user => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }

    currentUser = user;

    if (!profileUid)
        profileUid = user.uid;

    setupFooterPlus();

    if (currentUser.uid === profileUid) {

        const friendBtn = document.getElementById("friendBtn");

        if (friendBtn)
            friendBtn.style.display = "none";
    }

    await loadProfile();
});
