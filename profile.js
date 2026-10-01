// ============================================================
// VITALSTAR — PROFILE PAGE
// Dark Theme + Friends + Privacy Protection
// Loading Indicator + See More Posts + Cancel Request
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
// ELEMENTS
// ============================================================

const loader =
    document.getElementById("loader");

const profileName =
    document.getElementById("fullName");

const username =
    document.getElementById("username");

const profileImage =
    document.getElementById("profilePicture");

const coverImage =
    document.getElementById("coverPhoto");

const bio =
    document.getElementById("bio");

const country =
    document.getElementById("country");

const dob =
    document.getElementById("dob");

const gender =
    document.getElementById("gender");

const rank =
    document.getElementById("rank");

const lastSeen =
    document.getElementById("lastSeen");

const followersCount =
    document.getElementById("followers");

const followingCount =
    document.getElementById("following");

const postsCount =
    document.getElementById("posts");

const gallery =
    document.getElementById("gallery");

const editButton =
    document.getElementById("editProfileBtn");

const followButton =
    document.getElementById("followBtn");

const messageButton =
    document.getElementById("messageBtn");


// ============================================================
// PROFILE UID
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

let profileUid =
    params.get("uid") ||
    params.get("id");


// ============================================================
// STATE
// ============================================================

let currentUser = null;

let isFriend = false;

let requestSent = false;

let requestReceived = false;

let allProfilePosts = [];

let visiblePostCount = 10;

let postsLoading = false;


// ============================================================
// LOADING INDICATOR
// ============================================================

function showLoadingIndicator(
    text = "Loading..."
) {

    if (!gallery)
        return;

    gallery.innerHTML = `
        <div id="profileLoadingIndicator" style="
            width:100%;
            max-width:500px;
            margin:35px auto;
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
                rgba(40,130,255,.4);
            box-shadow:
                0 0 30px
                rgba(0,100,255,.16);
            color:white;
        ">

            <div style="
                width:48px;
                height:48px;
                margin:0 auto 18px;
                border:4px solid
                    rgba(255,255,255,.15);
                border-top-color:#168cff;
                border-right-color:#a855f7;
                border-radius:50%;
                animation:
                    vitalStarSpin .8s linear infinite;
            "></div>

            <div style="
                font-size:16px;
                font-weight:700;
                color:#dce9ff;
            ">
                ${escapeHTML(text)}
            </div>

        </div>

        <style>
            @keyframes vitalStarSpin {
                from {
                    transform:rotate(0deg);
                }

                to {
                    transform:rotate(360deg);
                }
            }
        </style>
    `;
}


function showPostsLoadingIndicator() {

    if (!gallery)
        return;

    const indicator =
        document.createElement("div");

    indicator.id =
        "postsLoadingIndicator";

    indicator.style.cssText = `
        width:100%;
        padding:30px 20px;
        box-sizing:border-box;
        text-align:center;
        color:#9fb4d8;
    `;

    indicator.innerHTML = `
        <div style="
            width:32px;
            height:32px;
            margin:0 auto 12px;
            border:3px solid
                rgba(255,255,255,.12);
            border-top-color:#168cff;
            border-right-color:#a855f7;
            border-radius:50%;
            animation:
                vitalStarSpin .8s linear infinite;
        "></div>

        <div style="
            font-size:14px;
            font-weight:600;
        ">
            Loading posts...
        </div>
    `;

    gallery.appendChild(
        indicator
    );
}


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
// BUTTON STYLE
// ============================================================

function styleButton(button) {

    if (!button)
        return;

    button.style.color =
        "#ffffff";

    button.style.border =
        "1px solid #168cff";

    button.style.borderRadius =
        "12px";

    button.style.cursor =
        "pointer";

    button.style.transition =
        "all .2s ease";

    button.style.textAlign =
        "center";

    button.style.justifyContent =
        "center";

    button.style.alignItems =
        "center";

    button.style.display =
        button.style.display === "none"
            ? "none"
            : "inline-flex";

    button.style.minHeight =
        "42px";

    button.style.padding =
        "10px 18px";

    button.style.fontWeight =
        "700";
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
                ".buttons"
            ) ||
            followButton?.parentElement ||
            messageButton?.parentElement;

        if (actions) {

            actions.appendChild(
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

    if (dob)
        dob.style.display = "";

    if (gender)
        gender.style.display = "";

    if (rank)
        rank.style.display = "";

    if (lastSeen)
        lastSeen.style.display = "";

    if (profileImage)
        profileImage.style.display = "";

    if (coverImage)
        coverImage.style.display = "";
}


// ============================================================
// PRIVATE PROFILE
// ============================================================

function showPrivateProfileMessage() {

    if (profileName)
        profileName.style.display = "none";

    if (username)
        username.style.display = "none";

    if (bio)
        bio.style.display = "none";

    if (country)
        country.style.display = "none";

    if (dob)
        dob.style.display = "none";

    if (gender)
        gender.style.display = "none";

    if (rank)
        rank.style.display = "none";

    if (lastSeen)
        lastSeen.style.display = "none";

    if (profileImage)
        profileImage.style.display = "none";

    if (coverImage)
        coverImage.style.display = "none";

    if (followButton)
        followButton.style.display = "none";

    if (messageButton)
        messageButton.style.display = "none";


    // Friend button remains available
    const friendBtn =
        createFriendButton();


    if (
        currentUser &&
        currentUser.uid !== profileUid
    ) {

        friendBtn.style.display =
            "inline-flex";

    } else {

        friendBtn.style.display =
            "none";
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

        const snap =
            await getDoc(
                doc(
                    db,
                    "users",
                    viewerUid
                )
            );

        if (!snap.exists())
            return false;

        const data =
            snap.data();

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
// FRIEND CHECK
// ============================================================

async function checkIfFriends(
    viewerUid,
    targetUid
) {

    if (!viewerUid || !targetUid) {
        return false;
    }

    if (
        viewerUid === targetUid
    ) {
        return true;
    }

    try {

        // Friendship documents are created
        // using this exact deterministic ID.
        const friendshipId =
            friendKey(
                viewerUid,
                targetUid
            );

        const friendshipRef =
            doc(
                db,
                "friends",
                friendshipId
            );

        const friendshipSnap =
            await getDoc(
                friendshipRef
            );

        if (!friendshipSnap.exists()) {
            return false;
        }

        const data =
            friendshipSnap.data();

        return (
            Array.isArray(data.users) &&
            data.users.includes(viewerUid) &&
            data.users.includes(targetUid)
        );

    } catch (error) {

        console.error(
            "Friend check failed:",
            error
        );

        return false;
    }
}


// ============================================================
// FRIEND REQUEST STATUS
// ============================================================

async function checkFriendRequestStatus(
    viewerUid,
    targetUid
) {

    requestSent =
        false;

    requestReceived =
        false;


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

                requestSent =
                    true;

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

                requestReceived =
                    true;

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
// FIND SENT REQUEST DOCUMENT
// ============================================================

async function findSentFriendRequest() {

    if (
        !currentUser ||
        !profileUid
    ) {

        return null;
    }

    try {

        const q =
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


        const snapshot =
            await getDocs(q);


        for (
            const requestDoc
            of snapshot.docs
        ) {

            const data =
                requestDoc.data();

            if (
                data.to === profileUid &&
                data.status === "pending"
            ) {

                return requestDoc;
            }
        }

    } catch (error) {

        console.error(
            "Find request error:",
            error
        );
    }

    return null;
}


// ============================================================
// NOTIFICATION
// ============================================================

async function createFriendNotification(
    targetUid,
    type,
    extra = {}
) {

    if (!currentUser)
        return;

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
                uid:
                    targetUid,

                fromUid:
                    currentUser.uid,

                type,

                read:
                    false,

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
        !profileUid ||
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

    button.style.opacity =
        "1";

    button.style.textAlign =
        "center";

    button.style.justifyContent =
        "center";

    button.style.alignItems =
        "center";


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

        button.style.background =
            "linear-gradient(135deg,#3b0b19,#66152b)";

        button.style.boxShadow =
            "0 0 12px rgba(255,77,109,.3)";

        return;
    }


    if (requestSent) {

        button.innerHTML =
            "⏳ Cancel Request";

        button.style.borderColor =
            "#ffc107";

        button.style.background =
            "linear-gradient(135deg,#3d2a00,#664800)";

        button.style.boxShadow =
            "0 0 12px rgba(255,193,7,.25)";

        return;
    }


    if (requestReceived) {

        button.innerHTML =
            "✅ Accept Friend";

        button.style.borderColor =
            "#00ff88";

        button.style.background =
            "linear-gradient(135deg,#063d25,#087044)";

        button.style.boxShadow =
            "0 0 12px rgba(0,255,136,.25)";

        return;
    }


    button.innerHTML =
        "👥 Add Friend";

    button.style.borderColor =
        "#168cff";

    button.style.background =
        "linear-gradient(135deg,#071a38,#102f66)";

    button.style.boxShadow =
        "0 0 12px rgba(22,140,255,.18)";
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

    button.style.justifyContent =
        "center";


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

                requestSent =
                    true;

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
// CANCEL FRIEND REQUEST
// ============================================================

async function cancelFriendRequest() {

    if (
        !currentUser ||
        !profileUid
    ) {
        return;
    }


    const button =
        createFriendButton();

    button.disabled =
        true;

    button.innerHTML =
        "⏳ Cancelling...";

    button.style.justifyContent =
        "center";


    try {

        const requestDoc =
            await findSentFriendRequest();


        if (requestDoc) {

            await deleteDoc(
                requestDoc.ref
            );
        }


        requestSent =
            false;


        await updateFriendButton();

    } catch (error) {

        console.error(
            "Cancel friend request error:",
            error
        );

        alert(
            "Unable to cancel friend request."
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
        !profileUid ||
        currentUser.uid === profileUid
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

        const friendshipId =
            friendKey(
                currentUser.uid,
                profileUid
            );


        const friendshipRef =
            doc(
                db,
                "friends",
                friendshipId
            );


        const friendshipSnap =
            await getDoc(
                friendshipRef
            );


        if (friendshipSnap.exists()) {

            await deleteDoc(
                friendshipRef
            );
        }


        isFriend =
            false;


        await updateFriendButton();

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


        if (
            !currentUser ||
            currentUser.uid === profileUid
        ) {
            return;
        }


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

    // Own profile
    if (
        viewerUid === targetUid
    ) {
        return true;
    }


    // Owner/admin can view private profiles
    const isAdmin =
        await checkViewerIsAdmin(
            viewerUid
        );

    if (isAdmin) {
        return true;
    }


    // Normalize privacy value
    const privacy =
        String(
            profileData?.profilePrivacy ||
            "public"
        )
        .trim()
        .toLowerCase();


    // Public
    if (
        privacy === "public"
    ) {
        return true;
    }


    // Friends only
    if (
        privacy === "friends"
    ) {

        return await checkIfFriends(
            viewerUid,
            targetUid
        );
    }


    // Unknown value
    // Keep old profiles public
    return true;
}


// ============================================================
// GET NUMERIC COUNT
// ============================================================

function getStoredCount(
    data,
    possibleNames
) {

    for (
        const name
        of possibleNames
    ) {

        const value =
            data[name];


        if (
            typeof value === "number"
        ) {

            return value;
        }


        if (
            typeof value === "string" &&
            value.trim() !== ""
        ) {

            const number =
                Number(value);

            if (
                Number.isFinite(number)
            ) {

                return number;
            }
        }


        if (
            Array.isArray(value)
        ) {

            return value.length;
        }
    }


    return null;
}


// ============================================================
// LOAD FOLLOWER COUNT
// ============================================================

async function loadFollowersCount(
    uid,
    profileData
) {

    if (!followersCount)
        return;


    const stored =
        getStoredCount(
            profileData,
            [
                "followersCount",
                "followerCount",
                "followers"
            ]
        );


    if (stored !== null) {

        followersCount.textContent =
            stored;

        return;
    }


    try {

        const followersRef =
            collection(
                db,
                "users",
                uid,
                "followers"
            );


        const snapshot =
            await getDocs(
                followersRef
            );


        followersCount.textContent =
            snapshot.size;

    } catch (error) {

        console.error(
            "Followers count error:",
            error
        );

        followersCount.textContent =
            "0";
    }
}


// ============================================================
// LOAD FOLLOWING COUNT
// ============================================================

async function loadFollowingCount(
    uid,
    profileData
) {

    if (!followingCount)
        return;


    const stored =
        getStoredCount(
            profileData,
            [
                "followingCount",
                "followingsCount",
                "following"
            ]
        );


    if (stored !== null) {

        followingCount.textContent =
            stored;

        return;
    }


    try {

        const followingRef =
            collection(
                db,
                "users",
                uid,
                "following"
            );


        const snapshot =
            await getDocs(
                followingRef
            );


        followingCount.textContent =
            snapshot.size;

    } catch (error) {

        console.error(
            "Following count error:",
            error
        );

        followingCount.textContent =
            "0";
    }
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


    showLoadingIndicator(
        "Loading profile..."
    );


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


        // ====================================================
        // PRIVACY CHECK
        // ====================================================

        const allowed =
            await canViewProfile(
                currentUser.uid,
                profileUid,
                data
            );


        // ====================================================
        // PRIVATE PROFILE
        // ====================================================

        if (!allowed) {

            showPrivateProfileMessage();

            // Keep Add Friend / request button available
            await updateFriendButton();

            hideLoader();

            return;
        }


        // ====================================================
        // RESTORE PROFILE ELEMENTS
        // ====================================================

        showProfileElements();


        // ====================================================
        // NAME
        // ====================================================

        if (profileName) {

            profileName.textContent =
                data.fullName ||
                data.name ||
                "VitalStar User";
        }


        // ====================================================
        // USERNAME
        // ====================================================

        if (username) {

            if (data.username) {

                username.textContent =
                    data.username.startsWith("@")
                        ? data.username
                        : "@" + data.username;

            } else {

                username.textContent =
                    "@username";
            }
        }


        // ====================================================
        // BIO
        // ====================================================

        if (bio) {

            bio.textContent =
                data.bio ||
                "No bio yet.";
        }


        // ====================================================
        // COUNTRY
        // ====================================================

        if (country) {

            country.textContent =
                data.country
                    ? `🌍 ${data.country}`
                    : "🌍 Country";
        }


        // ====================================================
        // DATE OF BIRTH
        // ====================================================

        if (dob) {

            const birthday =
                data.dob ||
                data.dateOfBirth ||
                "";

            dob.textContent =
                birthday
                    ? `🎂 ${birthday}`
                    : "🎂 Birthday";
        }


        // ====================================================
        // GENDER
        // ====================================================

        if (gender) {

            gender.textContent =
                data.gender
                    ? `🚻 ${data.gender}`
                    : "🚻 Gender";
        }


        // ====================================================
        // PROFILE PICTURE
        // ====================================================

        if (profileImage) {

            const imageURL =
                data.profilePicture ||
                data.photoURL ||
                data.profileImage ||
                data.avatar ||
                data.photo ||
                "";

            profileImage.src =
                imageURL ||
                "https://via.placeholder.com/300?text=VS";

            profileImage.style.display =
                "";

            profileImage.onerror =
                () => {

                    profileImage.onerror =
                        null;

                    profileImage.src =
                        "https://via.placeholder.com/300?text=VS";
                };
        }


        // ====================================================
        // COVER PHOTO
        // ====================================================

        if (coverImage) {

            const coverURL =
                data.coverPicture ||
                data.coverPhoto ||
                data.coverImage ||
                data.coverURL ||
                "";

            coverImage.src =
                coverURL ||
                "https://via.placeholder.com/1200x350?text=VitalStar";

            coverImage.style.display =
                "";

            coverImage.onerror =
                () => {

                    coverImage.onerror =
                        null;

                    coverImage.src =
                        "https://via.placeholder.com/1200x350?text=VitalStar";
                };
        }


        // ====================================================
        // RANK
        // ====================================================

        if (rank) {

            if (
                profileUid ===
                VITALSTAR_OWNER_UID
            ) {

                rank.textContent =
                    "👑 Owner";

            } else {

                rank.textContent =
                    data.rank
                        ? `🏅 ${data.rank}`
                        : "🏅 Member";
            }
        }


        // ====================================================
        // OWN PROFILE
        // ====================================================

        const viewingOwnProfile =
            currentUser.uid === profileUid;


        if (viewingOwnProfile) {

            const friendBtn =
                createFriendButton();

            friendBtn.style.display =
                "none";


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
        }


        // ====================================================
        // FOLLOW STATUS
        // ====================================================

        if (
            !viewingOwnProfile &&
            followButton
        ) {

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


                followButton.textContent =
                    followingSnap.exists()
                        ? "Following"
                        : "Follow";

            } catch (error) {

                console.error(
                    "Follow status error:",
                    error
                );
            }
        }


        // ====================================================
        // COUNTS
        // ====================================================

        await Promise.allSettled([

            loadFollowersCount(
                profileUid,
                data
            ),

            loadFollowingCount(
                profileUid,
                data
            )

        ]);


        // ====================================================
        // REALTIME STATUS
        // ====================================================

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
                            "⚪ Offline";

                        lastSeen.style.color =
                            "#8ea4c8";
                    }
                }
            );
        }


        // ====================================================
        // POSTS
        // ====================================================

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
                    color:#8ea4c8;
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
        return "⚪ Offline";


    let time =
        timestamp;


    if (
        typeof timestamp === "object" &&
        typeof timestamp.toMillis === "function"
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
// LOAD POSTS
// ============================================================

async function loadProfilePosts(
    uid
) {

    if (!gallery)
        return;


    if (postsLoading)
        return;


    postsLoading =
        true;


    try {

        showPostsLoadingIndicator();


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


        allProfilePosts =
            snapshot.docs.sort(
                (a, b) => {

                    const aTime =
                        getPostTime(
                            a.data().createdAt
                        );

                    const bTime =
                        getPostTime(
                            b.data().createdAt
                        );

                    return bTime - aTime;
                }
            );


        visiblePostCount =
            10;


        renderVisiblePosts();


    } catch (error) {

        console.error(
            "Posts loading error:",
            error
        );


        if (postsCount)
            postsCount.textContent =
                "0";


        gallery.innerHTML = `
            <div style="
                text-align:center;
                padding:30px;
                color:#8ea4c8;
            ">
                Unable to load posts.
            </div>
        `;

    } finally {

        postsLoading =
            false;
    }
}


// ============================================================
// RENDER VISIBLE POSTS
// ============================================================

function renderVisiblePosts() {

    if (!gallery)
        return;


    gallery.innerHTML =
        "";


    if (
        allProfilePosts.length ===
        0
    ) {

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


    const visiblePosts =
        allProfilePosts.slice(
            0,
            visiblePostCount
        );


    visiblePosts.forEach(
        postDoc => {

            renderPostCard(
                postDoc
            );
        }
    );


    if (
        visiblePostCount <
        allProfilePosts.length
    ) {

        const seeMore =
            document.createElement(
                "button"
            );


        seeMore.type =
            "button";

        seeMore.id =
            "seeMorePostsBtn";

        seeMore.innerHTML =
            "⬇️ See More Posts";


        seeMore.style.cssText = `
            display:flex;
            justify-content:center;
            align-items:center;
            width:calc(100% - 30px);
            max-width:420px;
            margin:20px auto 30px;
            padding:13px 20px;
            border:1px solid #168cff;
            border-radius:14px;
            background:
                linear-gradient(
                    135deg,
                    #071a38,
                    #102f66
                );
            color:#ffffff;
            font-size:15px;
            font-weight:800;
            text-align:center;
            cursor:pointer;
            box-shadow:
                0 0 16px
                rgba(22,140,255,.18);
            transition:
                transform .2s ease,
                box-shadow .2s ease;
        `;


        seeMore.addEventListener(
            "click",
            () => {

                seeMore.disabled =
                    true;

                seeMore.innerHTML =
                    "⏳ Loading...";

                seeMore.style.opacity =
                    ".7";


                setTimeout(
                    () => {

                        visiblePostCount +=
                            10;

                        renderVisiblePosts();

                    },
                    150
                );
            }
        );


        gallery.appendChild(
            seeMore
        );
    }
}


// ============================================================
// RENDER SINGLE POST
// ============================================================

function renderPostCard(
    postDoc
) {

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
                src="${escapeAttribute(
                    post.image
                )}"
                alt="Post image"
                style="
                    width:100%;
                    max-height:450px;
                    object-fit:cover;
                    border-radius:14px;
                    margin-top:12px;
                    display:block;
                "
            >
        `;
    }


    if (post.video) {

        mediaHTML += `
            <video
                src="${escapeAttribute(
                    post.video
                )}"
                controls
                style="
                    width:100%;
                    max-height:450px;
                    border-radius:14px;
                    margin-top:12px;
                    display:block;
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


// ============================================================
// POST TIME
// ============================================================

function getPostTime(
    timestamp
) {

    if (!timestamp)
        return 0;


    if (
        typeof timestamp === "object" &&
        typeof timestamp.toMillis === "function"
    ) {

        return timestamp.toMillis();
    }


    if (
        typeof timestamp === "number"
    ) {

        return timestamp;
    }


    if (
        typeof timestamp === "string"
    ) {

        const parsed =
            Date.parse(timestamp);

        return Number.isNaN(parsed)
            ? 0
            : parsed;
    }


    return 0;
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
// ATTRIBUTE ESCAPE
// ============================================================

function escapeAttribute(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        );
}


// ============================================================
// EDIT PROFILE
// ============================================================

if (editButton) {

    editButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "edit-profile.html";
        }
    );
}


// ============================================================
// MESSAGE
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


        if (!profileUid) {

            profileUid =
                user.uid;
        }


        if (
            currentUser.uid ===
            profileUid
        ) {

            const friendBtn =
                document.getElementById(
                    "friendBtn"
                );

            if (friendBtn) {

                friendBtn.style.display =
                    "none";
            }
        }


        await loadProfile();
    }
);