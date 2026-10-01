// ============================================================
// VITALSTAR — PROFILE PAGE
// Dark Theme + Friends + Privacy Protection
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
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ============================================================
// OWNER
// ============================================================

const VITALSTAR_OWNER_UID =
    "FvbfTXi65VgpuPtBxr8kGzBRLRr1";


// ============================================================
// DARK THEME
// ============================================================

function applyDarkTheme() {

    document.documentElement.style.background =
        "#050914";

    if (document.body) {

        document.body.style.background = `
            radial-gradient(
                circle at top,
                #101d3d 0%,
                #050914 45%,
                #02040a 100%
            )
        `;

        document.body.style.color =
            "#ffffff";
    }
}

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        applyDarkTheme,
        { once: true }
    );

} else {

    applyDarkTheme();
}


// ============================================================
// LOADER
// ============================================================

const loader =
    document.getElementById("loader");

function hideLoader() {

    if (!loader)
        return;

    loader.style.opacity =
        "0";

    setTimeout(() => {

        loader.style.display =
            "none";

    }, 400);
}


// ============================================================
// ELEMENTS
// ============================================================

const profileName =
    document.getElementById("profileName");

const username =
    document.getElementById("username");

const profileImage =
    document.getElementById("profileImage");

const coverImage =
    document.getElementById("coverImage");

const bio =
    document.getElementById("bio");

const country =
    document.getElementById("country");

const gender =
    document.getElementById("gender");

const rank =
    document.getElementById("rank");

const lastSeen =
    document.getElementById("lastSeen");

const followersCount =
    document.getElementById("followersCount");

const followingCount =
    document.getElementById("followingCount");

const postsCount =
    document.getElementById("postsCount");

const gallery =
    document.getElementById("gallery");

const editButton =
    document.getElementById("editProfile");

const followButton =
    document.getElementById("followBtn");

const messageButton =
    document.getElementById("messageBtn");


// ============================================================
// GET PROFILE UID
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const profileUid =
    params.get("uid") ||
    params.get("id");


// ============================================================
// STATE
// ============================================================

let currentUser = null;

let isFriend = false;

let requestSent = false;

let requestReceived = false;


// ============================================================
// DARK BUTTON
// ============================================================

function styleButton(button) {

    if (!button)
        return;

    button.style.background =
        "linear-gradient(135deg,#071a38,#102f66)";

    button.style.color =
        "#ffffff";

    button.style.border =
        "1px solid #168cff";

    button.style.boxShadow =
        "0 0 12px rgba(22,140,255,.35)";

    button.style.borderRadius =
        "12px";

    button.style.cursor =
        "pointer";

    button.style.transition =
        "all .2s ease";
}


// ============================================================
// FRIEND BUTTON
// ============================================================

function createFriendButton() {

    let button =
        document.getElementById(
            "friendBtn"
        );

    if (!button) {

        button =
            document.createElement(
                "button"
            );

        button.id =
            "friendBtn";

        button.type =
            "button";

        button.innerHTML =
            "👥 Add Friend";

        const actions =
            document.querySelector(
                ".profile-actions"
            ) ||
            document.querySelector(
                ".actions"
            ) ||
            followButton?.parentElement ||
            messageButton?.parentElement;

        if (actions) {

            actions.appendChild(
                button
            );

        } else if (document.body) {

            document.body.appendChild(
                button
            );
        }
    }

    styleButton(button);

    return button;
}


// ============================================================
// SHOW PROFILE ELEMENTS
// ============================================================

function showProfileElements() {

    if (profileName)
        profileName.style.display = "";

    if (username)
        username.style.display = "";

    if (bio)
        bio.style.display = "";

    if (country)
        country.style.display = "";

    if (gender)
        gender.style.display = "";

    if (rank)
        rank.style.display = "";

    if (lastSeen)
        lastSeen.style.display = "";
}


// ============================================================
// PRIVATE PROFILE
// ============================================================

function showPrivateProfileMessage() {

    if (profileName)
        profileName.style.display =
            "none";

    if (username)
        username.style.display =
            "none";

    if (bio)
        bio.style.display =
            "none";

    if (country)
        country.style.display =
            "none";

    if (gender)
        gender.style.display =
            "none";

    if (rank)
        rank.style.display =
            "none";

    if (lastSeen)
        lastSeen.style.display =
            "none";


    if (followButton)
        followButton.style.display =
            "none";

    if (messageButton)
        messageButton.style.display =
            "none";


    // Keep Add Friend available
    const friendBtn =
        createFriendButton();

    if (
        friendBtn &&
        currentUser &&
        currentUser.uid !== profileUid
    ) {

        friendBtn.style.display =
            "inline-flex";
    }


    if (gallery) {

        gallery.innerHTML = `
            <div style="
                width:100%;
                max-width:500px;
                margin:40px auto;
                padding:35px 20px;
                box-sizing:border-box;
                text-align:center;
                border-radius:22px;
                background:
                    linear-gradient(
                        145deg,
                        rgba(8,20,45,.98),
                        rgba(3,8,20,.98)
                    );
                border:1px solid
                    rgba(40,130,255,.45);
                box-shadow:
                    0 0 30px
                    rgba(0,100,255,.18);
                color:white;
            ">

                <div style="
                    font-size:55px;
                    margin-bottom:15px;
                ">🔒</div>

                <h2 style="
                    margin:0 0 10px;
                    color:#fff;
                ">
                    Private Profile
                </h2>

                <p style="
                    margin:0;
                    color:#9fb4d8;
                    line-height:1.6;
                ">
                    This profile is visible only
                    to friends.
                </p>

                <p style="
                    margin:12px 0 0;
                    color:#6f8fbd;
                    font-size:13px;
                ">
                    Send a friend request to connect.
                </p>

            </div>
        `;
    }
}


// ============================================================
// ADMIN CHECK
// ============================================================

async function checkViewerIsAdmin(
    viewerUid
) {

    if (!viewerUid)
        return false;

    if (
        viewerUid ===
        VITALSTAR_OWNER_UID
    ) {

        return true;
    }

    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    viewerUid
                )
            );

        if (!userSnap.exists())
            return false;

        const data =
            userSnap.data();

        return (
            data.isAdmin === true ||
            data.admin === true ||
            data.role === "admin"
        );

    } catch (error) {

        console.error(
            "Admin check failed:",
            error
        );

        return false;
    }
}


// ============================================================
// FRIEND CHECK
// ============================================================

async function checkIfFriends(
    viewerUid,
    targetUid
) {

    if (!viewerUid || !targetUid)
        return false;

    if (
        viewerUid ===
        targetUid
    ) {

        return true;
    }

    try {

        const q =
            query(
                collection(
                    db,
                    "friends"
                ),
                where(
                    "users",
                    "array-contains",
                    viewerUid
                )
            );

        const snapshot =
            await getDocs(q);

        for (
            const friendDoc
            of snapshot.docs
        ) {

            const data =
                friendDoc.data();

            if (
                Array.isArray(
                    data.users
                ) &&
                data.users.includes(
                    targetUid
                )
            ) {

                return true;
            }
        }

    } catch (error) {

        console.error(
            "Friend check failed:",
            error
        );
    }

    return false;
}


// ============================================================
// FRIEND REQUEST STATUS
// ============================================================

async function checkFriendRequestStatus(
    viewerUid,
    targetUid
) {

    requestSent = false;

    requestReceived = false;

    try {

        const sentQuery =
            query(
                collection(
                    db,
                    "friendRequests"
                ),
                where(
                    "from",
                    "==",
                    viewerUid
                )
            );

        const sentSnapshot =
            await getDocs(
                sentQuery
            );

        for (
            const requestDoc
            of sentSnapshot.docs
        ) {

            const data =
                requestDoc.data();

            if (
                data.to === targetUid &&
                data.status === "pending"
            ) {

                requestSent = true;

                break;
            }
        }


        const receivedQuery =
            query(
                collection(
                    db,
                    "friendRequests"
                ),
                where(
                    "to",
                    "==",
                    viewerUid
                )
            );

        const receivedSnapshot =
            await getDocs(
                receivedQuery
            );

        for (
            const requestDoc
            of receivedSnapshot.docs
        ) {

            const data =
                requestDoc.data();

            if (
                data.from === targetUid &&
                data.status === "pending"
            ) {

                requestReceived = true;

                break;
            }
        }

    } catch (error) {

        console.error(
            "Friend request check failed:",
            error
        );
    }
}


// ============================================================
// FRIEND KEY
// ============================================================

function friendKey(
    uid1,
    uid2
) {

    return [
        uid1,
        uid2
    ]
        .sort()
        .join("_");
}


// ============================================================
// NOTIFICATION
// ============================================================

async function createFriendNotification(
    targetUid,
    type,
    extra = {}
) {

    try {

        const notificationId =
            `${type}_${currentUser.uid}_${targetUid}_${Date.now()}`;

        await setDoc(
            doc(
                db,
                "notifications",
                notificationId
            ),
            {
                uid: targetUid,

                fromUid:
                    currentUser.uid,

                type,

                read: false,

                createdAt:
                    Date.now(),

                ...extra
            }
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );
    }
}


// ============================================================
// UPDATE FRIEND BUTTON
// ============================================================

async function updateFriendButton() {

    const button =
        createFriendButton();

    if (!button)
        return;

    if (
        !currentUser ||
        currentUser.uid === profileUid
    ) {

        button.style.display =
            "none";

        return;
    }

    button.style.display =
        "inline-flex";

    button.disabled =
        false;


    isFriend =
        await checkIfFriends(
            currentUser.uid,
            profileUid
        );


    if (!isFriend) {

        await checkFriendRequestStatus(
            currentUser.uid,
            profileUid
        );
    }


    if (isFriend) {

        button.innerHTML =
            "❌ Remove Friend";

        button.style.borderColor =
            "#ff4d6d";

        button.style.boxShadow =
            "0 0 12px rgba(255,77,109,.3)";

        return;
    }


    if (requestSent) {

        button.innerHTML =
            "⏳ Request Sent";

        button.style.borderColor =
            "#ffc107";

        button.style.boxShadow =
            "0 0 12px rgba(255,193,7,.25)";

        return;
    }


    if (requestReceived) {

        button.innerHTML =
            "✅ Accept Friend";

        button.style.borderColor =
            "#00ff88";

        button.style.boxShadow =
            "0 0 12px rgba(0,255,136,.3)";

        return;
    }


    button.innerHTML =
        "👥 Add Friend";

    button.style.borderColor =
        "#168cff";

    button.style.boxShadow =
        "0 0 12px rgba(22,140,255,.35)";
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

    const button =
        createFriendButton();

    button.disabled =
        true;

    button.innerHTML =
        "⏳ Sending...";

    try {

        const existingQuery =
            query(
                collection(
                    db,
                    "friendRequests"
                ),
                where(
                    "from",
                    "==",
                    currentUser.uid
                )
            );

        const existing =
            await getDocs(
                existingQuery
            );

        for (
            const requestDoc
            of existing.docs
        ) {

            const data =
                requestDoc.data();

            if (
                data.to === profileUid &&
                data.status === "pending"
            ) {

                await updateFriendButton();

                return;
            }
        }


        const requestRef =
            doc(
                collection(
                    db,
                    "friendRequests"
                )
            );


        await setDoc(
            requestRef,
            {
                from:
                    currentUser.uid,

                to:
                    profileUid,

                status:
                    "pending",

                createdAt:
                    Date.now()
            }
        );


        await createFriendNotification(
            profileUid,
            "friend_request",
            {
                requestId:
                    requestRef.id
            }
        );


        requestSent =
            true;


        await updateFriendButton();

    } catch (error) {

        console.error(
            "Send friend request error:",
            error
        );

        alert(
            "Unable to send friend request."
        );

        await updateFriendButton();
    }
}


// ============================================================
// ACCEPT FRIEND REQUEST
// ============================================================

async function acceptFriendRequest() {

    if (
        !currentUser ||
        !profileUid
    ) {

        return;
    }

    try {

        const q =
            query(
                collection(
                    db,
                    "friendRequests"
                ),
                where(
                    "to",
                    "==",
                    currentUser.uid
                )
            );

        const snapshot =
            await getDocs(q);

        let requestDoc =
            null;

        for (
            const item
            of snapshot.docs
        ) {

            const data =
                item.data();

            if (
                data.from === profileUid &&
                data.status === "pending"
            ) {

                requestDoc =
                    item;

                break;
            }
        }


        if (!requestDoc) {

            await updateFriendButton();

            return;
        }


        const friendshipId =
            friendKey(
                currentUser.uid,
                profileUid
            );


        await setDoc(
            doc(
                db,
                "friends",
                friendshipId
            ),
            {
                users: [
                    currentUser.uid,
                    profileUid
                ],

                key:
                    friendshipId,

                createdAt:
                    Date.now()
            }
        );


        await setDoc(
            requestDoc.ref,
            {
                status:
                    "accepted",

                acceptedAt:
                    Date.now()
            },
            {
                merge: true
            }
        );


        await createFriendNotification(
            profileUid,
            "friend_accepted",
            {
                friendId:
                    currentUser.uid
            }
        );


        isFriend =
            true;

        requestReceived =
            false;


        await updateFriendButton();


        // Reload profile after becoming friends
        await loadProfile();

    } catch (error) {

        console.error(
            "Accept friend request error:",
            error
        );

        alert(
            "Unable to accept friend request."
        );
    }
}


// ============================================================
// REMOVE FRIEND
// ============================================================

async function removeFriend() {

    if (
        !currentUser ||
        !profileUid
    ) {

        return;
    }

    const confirmed =
        confirm(
            "Remove this person from your friends?"
        );

    if (!confirmed)
        return;


    const button =
        createFriendButton();

    button.disabled =
        true;

    button.innerHTML =
        "⏳ Removing...";


    try {

        const q =
            query(
                collection(
                    db,
                    "friends"
                ),
                where(
                    "users",
                    "array-contains",
                    currentUser.uid
                )
            );

        const snapshot =
            await getDocs(q);


        for (
            const friendDoc
            of snapshot.docs
        ) {

            const data =
                friendDoc.data();

            if (
                Array.isArray(
                    data.users
                ) &&
                data.users.includes(
                    profileUid
                )
            ) {

                await deleteDoc(
                    friendDoc.ref
                );

                break;
            }
        }


        isFriend =
            false;


        await updateFriendButton();


        const profileSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    profileUid
                )
            );


        if (profileSnap.exists()) {

            const profileData =
                profileSnap.data();

            const allowed =
                await canViewProfile(
                    currentUser.uid,
                    profileUid,
                    profileData
                );

            if (!allowed) {

                showPrivateProfileMessage();
            }
        }

    } catch (error) {

        console.error(
            "Remove friend error:",
            error
        );

        alert(
            "Unable to remove friend."
        );

        await updateFriendButton();
    }
}


// ============================================================
// FRIEND BUTTON CLICK
// ============================================================

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "#friendBtn"
            );

        if (!button)
            return;

        if (button.disabled)
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

            return;
        }


        await sendFriendRequest();
    }
);


// ============================================================
// PROFILE PRIVACY
// ============================================================

async function canViewProfile(
    viewerUid,
    targetUid,
    profileData
) {

    if (
        viewerUid ===
        targetUid
    ) {

        return true;
    }


    const isAdmin =
        await checkViewerIsAdmin(
            viewerUid
        );

    if (isAdmin)
        return true;


    const privacy =
        profileData.profilePrivacy ||
        "public";


    if (
        privacy === "public"
    ) {

        return true;
    }


    if (
        privacy === "friends"
    ) {

        return await checkIfFriends(
            viewerUid,
            targetUid
        );
    }


    return true;
}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    if (
        !currentUser ||
        !profileUid
    ) {

        hideLoader();

        return;
    }


    try {

        const profileRef =
            doc(
                db,
                "users",
                profileUid
            );

        const profileSnap =
            await getDoc(
                profileRef
            );


        if (!profileSnap.exists()) {

            if (gallery) {

                gallery.innerHTML = `
                    <div style="
                        text-align:center;
                        padding:50px 20px;
                        color:#9fb4d8;
                    ">
                        <h2>
                            Profile Not Found
                        </h2>
                    </div>
                `;
            }

            hideLoader();

            return;
        }


        const data =
            profileSnap.data();


        const allowed =
            await canViewProfile(
                currentUser.uid,
                profileUid,
                data
            );


        // ----------------------------------------------------
        // PRIVATE
        // ----------------------------------------------------

        if (!allowed) {

            showPrivateProfileMessage();

            await updateFriendButton();

            hideLoader();

            return;
        }


        // ----------------------------------------------------
        // IMPORTANT: RESTORE ELEMENTS
        // ----------------------------------------------------

        showProfileElements();


        // ----------------------------------------------------
        // NAME
        // ----------------------------------------------------

        if (profileName) {

            profileName.textContent =
                data.fullName ||
                data.name ||
                "VitalStar User";
        }


        // ----------------------------------------------------
        // USERNAME
        // ----------------------------------------------------

        if (username) {

            username.textContent =
                data.username
                    ? "@" +
                      data.username
                    : "";
        }


        // ----------------------------------------------------
        // BIO
        // ----------------------------------------------------

        if (bio) {

            bio.textContent =
                data.bio ||
                "";
        }


        // ----------------------------------------------------
        // COUNTRY
        // ----------------------------------------------------

        if (country) {

            country.textContent =
                data.country
                    ? `🌍 ${data.country}`
                    : "";
        }


        // ----------------------------------------------------
        // GENDER
        // ----------------------------------------------------

        if (gender) {

            gender.textContent =
                data.gender
                    ? `⚧ ${data.gender}`
                    : "";
        }


        // ----------------------------------------------------
        // PROFILE IMAGE
        // ----------------------------------------------------

        if (profileImage) {

            profileImage.src =
                data.profilePicture ||
                data.photoURL ||
                "https://via.placeholder.com/300?text=VS";
        }


        // ----------------------------------------------------
        // COVER
        // ----------------------------------------------------

        if (coverImage) {

            if (
                data.coverPicture ||
                data.coverPhoto
            ) {

                coverImage.src =
                    data.coverPicture ||
                    data.coverPhoto;

                coverImage.style.display =
                    "";

            } else {

                coverImage.style.display =
                    "none";
            }
        }


        // ----------------------------------------------------
        // RANK
        // ----------------------------------------------------

        if (rank) {

            if (
                profileUid ===
                VITALSTAR_OWNER_UID
            ) {

                rank.textContent =
                    "👑 Owner";

            } else {

                rank.textContent =
                    data.rank ||
                    "Member";
            }
        }


        // ----------------------------------------------------
        // COUNTS
        // ----------------------------------------------------

        if (followersCount) {

            followersCount.textContent =
                data.followersCount ||
                0;
        }


        if (followingCount) {

            followingCount.textContent =
                data.followingCount ||
                0;
        }


        // ----------------------------------------------------
        // OWN PROFILE
        // ----------------------------------------------------

        if (
            currentUser.uid ===
            profileUid
        ) {

            if (editButton)
                editButton.style.display =
                    "";

            if (followButton)
                followButton.style.display =
                    "none";

            if (messageButton)
                messageButton.style.display =
                    "none";

        } else {

            if (editButton)
                editButton.style.display =
                    "none";

            if (followButton)
                followButton.style.display =
                    "";

            if (messageButton)
                messageButton.style.display =
                    "";


            await updateFriendButton();


            // ------------------------------------------------
            // FOLLOW STATUS
            // ------------------------------------------------

            try {

                const followingRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid,
                        "following",
                        profileUid
                    );

                const followingSnap =
                    await getDoc(
                        followingRef
                    );


                if (followButton) {

                    followButton.textContent =
                        followingSnap.exists()
                            ? "Following"
                            : "Follow";
                }

            } catch (error) {

                console.error(
                    "Follow status error:",
                    error
                );
            }
        }


        // ----------------------------------------------------
        // REALTIME ONLINE STATUS
        // ----------------------------------------------------

        if (lastSeen) {

            const statusRef =
                ref(
                    rtdb,
                    `status/${profileUid}`
                );


            onValue(
                statusRef,
                snapshot => {

                    const status =
                        snapshot.val();


                    if (
                        status &&
                        status.online === true
                    ) {

                        lastSeen.textContent =
                            "🟢 Online";

                        lastSeen.style.color =
                            "#00ff88";

                    } else if (
                        status &&
                        status.lastSeen
                    ) {

                        lastSeen.textContent =
                            formatLastSeen(
                                status.lastSeen
                            );

                        lastSeen.style.color =
                            "#8ea4c8";

                    } else {

                        lastSeen.textContent =
                            "Offline";
                    }
                }
            );
        }


        // ----------------------------------------------------
        // POSTS
        // ----------------------------------------------------

        await loadProfilePosts(
            profileUid
        );


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        if (gallery) {

            gallery.innerHTML = `
                <div style="
                    text-align:center;
                    padding:40px 20px;
                    color:#9fb4d8;
                ">
                    Unable to load profile.
                </div>
            `;
        }

    } finally {

        hideLoader();
    }
}


// ============================================================
// LAST SEEN
// ============================================================

function formatLastSeen(
    timestamp
) {

    if (!timestamp)
        return "Offline";

    let time =
        timestamp;


    if (
        typeof timestamp ===
            "object" &&
        timestamp.toMillis
    ) {

        time =
            timestamp.toMillis();
    }


    const diff =
        Date.now() -
        time;


    const seconds =
        Math.floor(
            diff / 1000
        );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const hours =
        Math.floor(
            minutes / 60
        );

    const days =
        Math.floor(
            hours / 24
        );

    const weeks =
        Math.floor(
            days / 7
        );


    if (seconds < 60)
        return "Last seen just now";

    if (minutes < 60)
        return `Last seen ${minutes}m ago`;

    if (hours < 24)
        return `Last seen ${hours}h ago`;

    if (days < 7)
        return `Last seen ${days}d ago`;

    return `Last seen ${weeks}w ago`;
}


// ============================================================
// LOAD POSTS
// ============================================================

async function loadProfilePosts(
    uid
) {

    if (!gallery)
        return;


    try {

        const postsQuery =
            query(
                collection(
                    db,
                    "posts"
                ),
                where(
                    "uid",
                    "==",
                    uid
                ),
                orderBy(
                    "createdAt",
                    "desc"
                )
            );


        const snapshot =
            await getDocs(
                postsQuery
            );


        if (postsCount) {

            postsCount.textContent =
                snapshot.size;
        }


        gallery.innerHTML =
            "";


        if (snapshot.empty) {

            gallery.innerHTML = `
                <div style="
                    width:100%;
                    text-align:center;
                    padding:40px 20px;
                    color:#8ea4c8;
                ">
                    No posts yet.
                </div>
            `;

            return;
        }


        const posts =
            snapshot.docs.slice(
                0,
                10
            );


        posts.forEach(
            postDoc => {

                const post =
                    postDoc.data();


                const card =
                    document.createElement(
                        "div"
                    );


                card.style.cssText = `
                    width:100%;
                    margin-bottom:15px;
                    padding:16px;
                    box-sizing:border-box;
                    border-radius:18px;
                    background:
                        linear-gradient(
                            145deg,
                            #09162e,
                            #040914
                        );
                    border:
                        1px solid
                        rgba(35,115,220,.3);
                    box-shadow:
                        0 0 18px
                        rgba(0,70,160,.12);
                    color:#fff;
                `;


                const text =
                    post.text ||
                    post.content ||
                    "";


                let mediaHTML =
                    "";


                if (post.image) {

                    mediaHTML += `
                        <img
                            src="${post.image}"
                            style="
                                width:100%;
                                max-height:450px;
                                object-fit:cover;
                                border-radius:14px;
                                margin-top:12px;
                            "
                        >
                    `;
                }


                if (post.video) {

                    mediaHTML += `
                        <video
                            src="${post.video}"
                            controls
                            style="
                                width:100%;
                                max-height:450px;
                                border-radius:14px;
                                margin-top:12px;
                            "
                        ></video>
                    `;
                }


                card.innerHTML = `
                    <div style="
                        color:#ffffff;
                        line-height:1.6;
                        word-break:break-word;
                    ">
                        ${escapeHTML(text)}
                    </div>

                    ${mediaHTML}
                `;


                gallery.appendChild(
                    card
                );
            }
        );


    } catch (error) {

        console.error(
            "Posts loading error:",
            error
        );

        gallery.innerHTML = `
            <div style="
                text-align:center;
                padding:30px;
                color:#8ea4c8;
            ">
                Unable to load posts.
            </div>
        `;
    }
}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value || "";

    return div.innerHTML;
}


// ============================================================
// MESSAGE BUTTON
// ============================================================

if (messageButton) {

    messageButton.addEventListener(
        "click",
        () => {

            if (!profileUid)
                return;

            window.location.href =
                `chat.html?uid=${encodeURIComponent(
                    profileUid
                )}`;
        }
    );
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentUser =
            user;


        await loadProfile();
    }
);