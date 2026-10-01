/* =========================================================
   VITALSTAR — FRIEND SYSTEM
   Firebase v10.12.2

   Features:
   - Friends
   - Friend count
   - Online indicators
   - Last seen
   - Friend requests
   - Friend notifications
   ========================================================= */

import {
    collection,
    query,
    where,
    onSnapshot,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    onValue,
    ref
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
    auth,
    db,
    rtdb
} from "./firebase.js";


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let friends = [];
let incomingRequests = [];
let outgoingRequests = [];
let allUsers = [];

const presenceCache =
    new Map();

const presenceListeners =
    new Map();


/* =========================================================
   ELEMENTS
   ========================================================= */

const friendsList =
    document.getElementById("friendsList");

const requestsList =
    document.getElementById("requestsList");

const sentList =
    document.getElementById("sentList");

const discoverList =
    document.getElementById("discoverList");

const searchInput =
    document.getElementById("searchInput");

const friendsCount =
    document.getElementById("friendsCount");

const requestsCount =
    document.getElementById("requestsCount");

const sentCount =
    document.getElementById("sentCount");

const discoverCount =
    document.getElementById("discoverCount");


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value){

    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}


function getDisplayName(user){

    return (
        user.fullName ||
        user.displayName ||
        user.username ||
        "VitalStar User"
    );

}


function getUsername(user){

    if(!user.username){
        return "";
    }

    return user.username.startsWith("@")
        ? user.username
        : "@" + user.username;

}


function getAvatar(user){

    return (
        user.profilePicture ||
        user.photoURL ||
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(
            getDisplayName(user)
        ) +
        "&background=171d32&color=ffffff"
    );

}


function friendKey(uid1,uid2){

    return [
        uid1,
        uid2
    ]
    .sort()
    .join("_");

}


function showToast(message){

    const toast =
        document.getElementById("toast");

    if(!toast){
        return;
    }

    toast.textContent =
        message;

    toast.classList.add("show");

    clearTimeout(
        window.__toastTimer
    );

    window.__toastTimer =
        setTimeout(
            function(){

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


/* =========================================================
   FRIEND COUNT
   ========================================================= */

function updateFriendsCount(){

    const count =
        friends.length;


    if(friendsCount){

        friendsCount.textContent =
            count === 1
                ? "1 friend"
                : `${count} friends`;

    }


    window.VitalStarFriendsCount =
        count;

}


/* =========================================================
   PRESENCE
   ========================================================= */

function getPresence(uid){

    return (
        presenceCache.get(uid) || {
            online:false,
            lastSeen:null
        }
    );

}


function formatLastSeen(timestamp){

    if(!timestamp){

        return "Offline";

    }


    let time =
        timestamp;


    if(
        typeof time === "object" &&
        time !== null
    ){

        if(
            typeof time.toMillis ===
            "function"
        ){

            time =
                time.toMillis();

        }else if(
            typeof time.seconds ===
            "number"
        ){

            time =
                time.seconds * 1000;

        }

    }


    time =
        Number(time);


    if(
        !Number.isFinite(time)
    ){

        return "Offline";

    }


    const difference =
        Math.max(
            0,
            Date.now() - time
        );


    const seconds =
        Math.floor(
            difference / 1000
        );


    if(seconds < 60){

        return "last seen just now";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if(minutes < 60){

        return (
            "last seen " +
            minutes +
            (
                minutes === 1
                    ? " minute ago"
                    : " minutes ago"
            )
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if(hours < 24){

        return (
            "last seen " +
            hours +
            (
                hours === 1
                    ? " hour ago"
                    : " hours ago"
            )
        );

    }


    const days =
        Math.floor(
            hours / 24
        );


    if(days < 7){

        return (
            "last seen " +
            days +
            (
                days === 1
                    ? " day ago"
                    : " days ago"
            )
        );

    }


    const weeks =
        Math.floor(
            days / 7
        );


    if(weeks < 5){

        return (
            "last seen " +
            weeks +
            (
                weeks === 1
                    ? " week ago"
                    : " weeks ago"
            )
        );

    }


    return "Offline";

}


/* =========================================================
   START PRESENCE LISTENER
   ========================================================= */

function listenToPresence(uid){

    if(!uid){
        return;
    }


    if(
        presenceListeners.has(uid)
    ){

        return;

    }


    const presenceRef =
        ref(
            rtdb,
            "status/" + uid
        );


    const unsubscribe =
        onValue(
            presenceRef,
            snapshot => {

                const data =
                    snapshot.val();


                if(!data){

                    presenceCache.set(
                        uid,
                        {
                            online:false,
                            lastSeen:null
                        }
                    );

                }else{

                    presenceCache.set(
                        uid,
                        {
                            online:
                                data.online === true,

                            lastSeen:
                                data.lastSeen ||
                                null
                        }
                    );

                }


                renderFriends();

                renderRequests();

                renderSent();

                renderDiscover();

            },
            error => {

                console.error(
                    "Presence error:",
                    error
                );

            }
        );


    presenceListeners.set(
        uid,
        unsubscribe
    );

}


/* =========================================================
   SYNC PRESENCE
   ========================================================= */

function syncPresenceListeners(){

    const ids =
        new Set();


    friends.forEach(
        user => ids.add(
            user.uid
        )
    );


    incomingRequests.forEach(
        request => ids.add(
            request.from
        )
    );


    outgoingRequests.forEach(
        request => ids.add(
            request.to
        )
    );


    allUsers.forEach(
        user => ids.add(
            user.uid
        )
    );


    ids.forEach(
        uid => {

            listenToPresence(uid);

        }
    );

}


/* =========================================================
   PRESENCE HTML
   ========================================================= */

function getPresenceHTML(uid){

    const presence =
        getPresence(uid);


    if(presence.online){

        return `

            <div class="presence-status online">

                <span class="presence-dot"></span>

                <span>
                    Online
                </span>

            </div>

        `;

    }


    return `

        <div class="presence-status offline">

            <span class="presence-dot"></span>

            <span>
                ${escapeHTML(
                    formatLastSeen(
                        presence.lastSeen
                    )
                )}
            </span>

        </div>

    `;

}


/* =========================================================
   USER CARD
   ========================================================= */

function userCard(
    user,
    actionHTML
){

    const uid =
        user.uid ||
        user.id;


    return `

        <div
            class="user-card"
            data-uid="${escapeHTML(uid)}"
        >

            <div class="avatar-wrap">

                <img
                    class="avatar"
                    src="${escapeHTML(
                        getAvatar(user)
                    )}"
                    alt=""
                    loading="lazy"
                >

            </div>


            <div class="user-details">

                <div class="user-name">

                    ${escapeHTML(
                        getDisplayName(user)
                    )}

                </div>


                <div class="username">

                    ${escapeHTML(
                        getUsername(user)
                    )}

                </div>


                ${getPresenceHTML(uid)}

            </div>


            <div class="user-actions">

                ${actionHTML}

            </div>

        </div>

    `;

}


/* =========================================================
   LOAD USER
   ========================================================= */

async function getUser(uid){

    try{

        const snapshot =
            await getDoc(
                doc(
                    db,
                    "users",
                    uid
                )
            );


        if(snapshot.exists()){

            return {
                uid,
                ...snapshot.data()
            };

        }

    }catch(error){

        console.error(
            "Could not load user:",
            error
        );

    }


    return {

        uid,

        fullName:
            "VitalStar User",

        username:"",

        profilePicture:""

    };

}


/* =========================================================
   FRIENDS LISTENER
   ========================================================= */

function listenToFriends(){

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


    onSnapshot(
        q,
        async snapshot => {

            const results = [];


            for(
                const friendDoc
                of snapshot.docs
            ){

                const data =
                    friendDoc.data();


                if(
                    !Array.isArray(
                        data.users
                    ) ||
                    data.users.length !== 2
                ){

                    continue;

                }


                const otherUid =
                    data.users.find(
                        uid =>
                            uid !==
                            currentUser.uid
                    );


                if(!otherUid){
                    continue;
                }


                const user =
                    await getUser(
                        otherUid
                    );


                results.push({

                    ...user,

                    friendshipId:
                        friendDoc.id

                });

            }


            friends =
                results;


            updateFriendsCount();

            syncPresenceListeners();

            renderFriends();

            renderDiscover();

        },

        error => {

            console.error(
                "Friends listener:",
                error
            );


            if(friendsList){

                friendsList.innerHTML = `

                    <div class="empty">

                        <div class="empty-icon">
                            ⚠️
                        </div>

                        <strong>
                            Could not load friends
                        </strong>

                        <p>
                            ${escapeHTML(
                                error.message
                            )}
                        </p>

                    </div>

                `;

            }

        }
    );

}


/* =========================================================
   INCOMING REQUESTS
   ========================================================= */

function listenToIncomingRequests(){

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
            ),

            where(
                "status",
                "==",
                "pending"
            )
        );


    onSnapshot(
        q,
        async snapshot => {

            const results = [];


            for(
                const requestDoc
                of snapshot.docs
            ){

                const data =
                    requestDoc.data();


                const user =
                    await getUser(
                        data.from
                    );


                results.push({

                    id:
                        requestDoc.id,

                    ...data,

                    user

                });

            }


            incomingRequests =
                results;


            updateRequestCounts();

            syncPresenceListeners();

            renderRequests();

            renderDiscover();

        },

        error => {

            console.error(
                "Incoming requests:",
                error
            );

        }
    );

}


/* =========================================================
   OUTGOING REQUESTS
   ========================================================= */

function listenToOutgoingRequests(){

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
            ),

            where(
                "status",
                "==",
                "pending"
            )
        );


    onSnapshot(
        q,
        async snapshot => {

            const results = [];


            for(
                const requestDoc
                of snapshot.docs
            ){

                const data =
                    requestDoc.data();


                const user =
                    await getUser(
                        data.to
                    );


                results.push({

                    id:
                        requestDoc.id,

                    ...data,

                    user

                });

            }


            outgoingRequests =
                results;


            updateRequestCounts();

            syncPresenceListeners();

            renderSent();

            renderDiscover();

        },

        error => {

            console.error(
                "Outgoing requests:",
                error
            );

        }
    );

}


/* =========================================================
   REQUEST COUNTS
   ========================================================= */

function updateRequestCounts(){

    if(requestsCount){

        requestsCount.textContent =
            incomingRequests.length;

    }


    if(sentCount){

        sentCount.textContent =
            outgoingRequests.length;

    }

}


/* =========================================================
   LOAD USERS
   ========================================================= */

async function loadUsers(){

    try{

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        allUsers =
            snapshot.docs
                .map(item => ({

                    uid:
                        item.id,

                    ...item.data()

                }))
                .filter(
                    user =>
                        user.uid !==
                        currentUser.uid
                );


        syncPresenceListeners();

        renderDiscover();

    }catch(error){

        console.error(
            "Users:",
            error
        );


        if(discoverList){

            discoverList.innerHTML = `

                <div class="empty">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <strong>
                        Could not load users
                    </strong>

                    <p>
                        ${escapeHTML(
                            error.message
                        )}
                    </p>

                </div>

            `;

        }

    }

}


/* =========================================================
   RELATIONSHIP
   ========================================================= */

function relationship(uid){

    if(
        friends.some(
            user =>
                user.uid === uid
        )
    ){

        return "friend";

    }


    if(
        incomingRequests.some(
            request =>
                request.from === uid
        )
    ){

        return "incoming";

    }


    if(
        outgoingRequests.some(
            request =>
                request.to === uid
        )
    ){

        return "sent";

    }


    return "none";

}


/* =========================================================
   RENDER FRIENDS
   ========================================================= */

function renderFriends(){

    if(!friendsList){
        return;
    }


    if(!friends.length){

        friendsList.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    👥
                </div>

                <strong>
                    No friends yet
                </strong>

                <p>
                    Discover people and send your first
                    friend request.
                </p>

            </div>

        `;

        return;

    }


    friendsList.innerHTML =
        friends.map(user => {

            return userCard(
                user,

                `

                <button
                    class="action-btn neutral"
                    onclick="
                        window.VitalStarFriends.profile('${user.uid}')
                    "
                >
                    Profile
                </button>

                <button
                    class="action-btn primary"
                    onclick="
                        window.VitalStarFriends.message('${user.uid}')
                    "
                >
                    Chat
                </button>

                <button
                    class="action-btn danger"
                    onclick="
                        window.VitalStarFriends.remove('${user.uid}')
                    "
                >
                    Remove
                </button>

                `

            );

        }).join("");

}


/* =========================================================
   RENDER REQUESTS
   ========================================================= */

function renderRequests(){

    if(!requestsList){
        return;
    }


    if(!incomingRequests.length){

        requestsList.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    📭
                </div>

                <strong>
                    No friend requests
                </strong>

                <p>
                    New requests will appear here.
                </p>

            </div>

        `;

        return;

    }


    requestsList.innerHTML =
        incomingRequests.map(
            request => {

                const user =
                    request.user;


                return userCard(
                    user,

                    `

                    <button
                        class="action-btn success"
                        onclick="
                            window.VitalStarFriends.accept('${request.id}')
                        "
                    >
                        Accept
                    </button>

                    <button
                        class="action-btn danger"
                        onclick="
                            window.VitalStarFriends.decline('${request.id}')
                        "
                    >
                        Decline
                    </button>

                    `

                );

            }
        ).join("");

}


/* =========================================================
   RENDER SENT
   ========================================================= */

function renderSent(){

    if(!sentList){
        return;
    }


    if(!outgoingRequests.length){

        sentList.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    📤
                </div>

                <strong>
                    No pending requests
                </strong>

                <p>
                    Requests you send will appear here.
                </p>

            </div>

        `;

        return;

    }


    sentList.innerHTML =
        outgoingRequests.map(
            request => {

                const user =
                    request.user;


                return userCard(
                    user,

                    `

                    <button
                        class="action-btn neutral"
                        onclick="
                            window.VitalStarFriends.profile('${user.uid}')
                        "
                    >
                        Profile
                    </button>

                    <button
                        class="action-btn danger"
                        onclick="
                            window.VitalStarFriends.cancel('${request.id}')
                        "
                    >
                        Cancel
                    </button>

                    `

                );

            }
        ).join("");

}


/* =========================================================
   RENDER DISCOVER
   ========================================================= */

function renderDiscover(){

    if(!discoverList){
        return;
    }


    const term =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const users =
        allUsers.filter(
            user => {

                if(!term){
                    return true;
                }


                const name =
                    getDisplayName(
                        user
                    ).toLowerCase();


                const username =
                    String(
                        user.username ||
                        ""
                    ).toLowerCase();


                return (
                    name.includes(term) ||
                    username.includes(term)
                );

            }
        );


    if(discoverCount){

        discoverCount.textContent =
            users.length;

    }


    if(!users.length){

        discoverList.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    🔎
                </div>

                <strong>
                    No people found
                </strong>

                <p>
                    Try another name or username.
                </p>

            </div>

        `;

        return;

    }


    discoverList.innerHTML =
        users.map(user => {

            const relation =
                relationship(
                    user.uid
                );


            let buttons = "";


            if(
                relation === "friend"
            ){

                buttons = `

                    <button
                        class="action-btn neutral"
                        onclick="
                            window.VitalStarFriends.profile('${user.uid}')
                        "
                    >
                        Profile
                    </button>

                    <button
                        class="action-btn primary"
                        onclick="
                            window.VitalStarFriends.message('${user.uid}')
                        "
                    >
                        Chat
                    </button>

                `;

            }else if(
                relation === "incoming"
            ){

                buttons = `

                    <button
                        class="action-btn success"
                        onclick="
                            window.VitalStarFriends.acceptIncomingByUser('${user.uid}')
                        "
                    >
                        Accept
                    </button>

                `;

            }else if(
                relation === "sent"
            ){

                buttons = `

                    <button
                        class="action-btn neutral"
                        disabled
                    >
                        Request Sent
                    </button>

                `;

            }else{

                buttons = `

                    <button
                        class="action-btn neutral"
                        onclick="
                            window.VitalStarFriends.profile('${user.uid}')
                        "
                    >
                        Profile
                    </button>

                    <button
                        class="action-btn primary"
                        onclick="
                            window.VitalStarFriends.add('${user.uid}')
                        "
                    >
                        + Add
                    </button>

                `;

            }


            return userCard(
                user,
                buttons
            );

        }).join("");

}


/* =========================================================
   CREATE FRIEND NOTIFICATION
   ========================================================= */

async function createFriendNotification({

    receiverId,
    senderId,
    type,
    text,
    requestId

}){

    if(
        !receiverId ||
        !senderId ||
        !type
    ){

        return;

    }


    if(
        receiverId === senderId
    ){

        return;

    }


    try{

        const sender =
            await getUser(
                senderId
            );


        /*
           Deterministic notification IDs prevent
           duplicate notifications caused by repeated
           listeners or button clicks.
        */

        const notificationId =
            requestId
                ? `${type}_${requestId}`
                : `${type}_${senderId}_${receiverId}`;


        await updateDoc(
            doc(
                db,
                "notifications",
                notificationId
            ),
            {
                receiverId,
                recipientId:
                    receiverId,

                senderId,

                senderName:
                    getDisplayName(
                        sender
                    ),

                senderPhoto:
                    sender.profilePicture ||
                    sender.photoURL ||
                    "",

                senderPhotoURL:
                    sender.profilePicture ||
                    sender.photoURL ||
                    "",

                type,

                text,

                message:
                    text,

                read:false,

                createdAt:
                    serverTimestamp(),

                ...(requestId
                    ? { requestId }
                    : {})
            }
        );

    }catch(error){

        /*
           The notification may not exist yet.
           Firestore updateDoc() cannot create a document.

           Create it with setDoc below.
        */

        try{

            const sender =
                await getUser(
                    senderId
                );


            const notificationRef =
                doc(
                    db,
                    "notifications",
                    notificationId
                );


            const {
                setDoc
            } = await import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
            );


            await setDoc(
                notificationRef,
                {

                    receiverId,

                    recipientId:
                        receiverId,

                    senderId,

                    senderName:
                        getDisplayName(
                            sender
                        ),

                    senderPhoto:
                        sender.profilePicture ||
                        sender.photoURL ||
                        "",

                    senderPhotoURL:
                        sender.profilePicture ||
                        sender.photoURL ||
                        "",

                    type,

                    text,

                    message:
                        text,

                    read:false,

                    createdAt:
                        serverTimestamp(),

                    ...(requestId
                        ? { requestId }
                        : {})

                }
            );

        }catch(notificationError){

            console.error(
                "Could not create friend notification:",
                notificationError
            );

        }

    }

}


/* =========================================================
   SEND FRIEND REQUEST
   ========================================================= */

async function addFriend(uid){

    if(!currentUser){
        return;
    }


    if(
        uid === currentUser.uid
    ){

        return;

    }


    if(
        relationship(uid) !== "none"
    ){

        showToast(
            "You already have a connection with this user."
        );

        return;

    }


    try{

        const requestRef =
            await addDoc(
                collection(
                    db,
                    "friendRequests"
                ),
                {

                    from:
                        currentUser.uid,

                    to:
                        uid,

                    status:
                        "pending",

                    createdAt:
                        serverTimestamp()

                }
            );


        /*
           Create notification for recipient.
        */

        const sender =
            await getUser(
                currentUser.uid
            );


        await createFriendNotification({

            receiverId:
                uid,

            senderId:
                currentUser.uid,

            type:
                "friend_request",

            text:
                `${getDisplayName(sender)} sent you a friend request.`,

            requestId:
                requestRef.id

        });


        showToast(
            "Friend request sent!"
        );


    }catch(error){

        console.error(
            "Add friend:",
            error
        );


        showToast(
            "Could not send request."
        );

    }

}


/* =========================================================
   ACCEPT REQUEST
   ========================================================= */

async function acceptRequest(requestId){

    const request =
        incomingRequests.find(
            item =>
                item.id === requestId
        );


    if(!request){
        return;
    }


    try{

        /*
           Create friendship.
        */

        await addDoc(
            collection(
                db,
                "friends"
            ),
            {

                users:[
                    currentUser.uid,
                    request.from
                ],

                key:
                    friendKey(
                        currentUser.uid,
                        request.from
                    ),

                createdAt:
                    serverTimestamp()

            }
        );


        /*
           Mark request as accepted.
        */

        await updateDoc(
            doc(
                db,
                "friendRequests",
                requestId
            ),
            {

                status:
                    "accepted"

            }
        );


        /*
           Notify the person who originally
           sent the request.
        */

        const sender =
            await getUser(
                currentUser.uid
            );


        await createFriendNotification({

            receiverId:
                request.from,

            senderId:
                currentUser.uid,

            type:
                "friend_accepted",

            text:
                `${getDisplayName(sender)} accepted your friend request.`,

            requestId:
                requestId

        });


        showToast(
            "You are now friends!"
        );


    }catch(error){

        console.error(
            "Accept request:",
            error
        );


        showToast(
            "Could not accept request."
        );

    }

}


/* =========================================================
   ACCEPT INCOMING
   ========================================================= */

async function acceptIncomingByUser(uid){

    const request =
        incomingRequests.find(
            item =>
                item.from === uid
        );


    if(request){

        await acceptRequest(
            request.id
        );

    }

}


/* =========================================================
   DECLINE
   ========================================================= */

async function declineRequest(requestId){

    try{

        await updateDoc(
            doc(
                db,
                "friendRequests",
                requestId
            ),
            {

                status:
                    "declined"

            }
        );


        showToast(
            "Friend request declined."
        );


    }catch(error){

        console.error(
            "Decline:",
            error
        );


        showToast(
            "Could not decline request."
        );

    }

}


/* =========================================================
   CANCEL
   ========================================================= */

async function cancelRequest(requestId){

    try{

        await deleteDoc(
            doc(
                db,
                "friendRequests",
                requestId
            )
        );


        showToast(
            "Friend request cancelled."
        );


    }catch(error){

        console.error(
            "Cancel:",
            error
        );


        showToast(
            "Could not cancel request."
        );

    }

}


/* =========================================================
   REMOVE FRIEND
   ========================================================= */

async function removeFriend(uid){

    const confirmed =
        confirm(
            "Remove this person from your friends?"
        );


    if(!confirmed){
        return;
    }


    try{

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


        for(
            const friendDoc
            of snapshot.docs
        ){

            const data =
                friendDoc.data();


            if(
                Array.isArray(
                    data.users
                ) &&
                data.users.includes(uid)
            ){

                await deleteDoc(
                    doc(
                        db,
                        "friends",
                        friendDoc.id
                    )
                );

                break;

            }

        }


        showToast(
            "Friend removed."
        );


    }catch(error){

        console.error(
            "Remove friend:",
            error
        );


        showToast(
            "Could not remove friend."
        );

    }

}


/* =========================================================
   PROFILE
   ========================================================= */

function openProfile(uid){

    window.location.href =
        "profile.html?uid=" +
        encodeURIComponent(uid);

}


/* =========================================================
   MESSAGE
   ========================================================= */

function messageUser(uid){

    window.location.href =
        "message.html?uid=" +
        encodeURIComponent(uid);

}


/* =========================================================
   TABS
   ========================================================= */

function activateTab(tab){

    document
        .querySelectorAll(".tab")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.tab ===
                    tab
                );

            }
        );


    const friendsSection =
        document.getElementById(
            "friendsSection"
        );

    const requestsSection =
        document.getElementById(
            "requestsSection"
        );

    const sentSection =
        document.getElementById(
            "sentSection"
        );

    const discoverSection =
        document.getElementById(
            "discoverSection"
        );


    if(friendsSection){

        friendsSection.style.display =
            tab === "friends"
                ? "block"
                : "none";

    }


    if(requestsSection){

        requestsSection.style.display =
            tab === "requests"
                ? "block"
                : "none";

    }


    if(sentSection){

        sentSection.style.display =
            tab === "sent"
                ? "block"
                : "none";

    }


    if(discoverSection){

        discoverSection.style.display =
            tab === "discover"
                ? "block"
                : "none";

    }


    if(
        tab === "discover" &&
        searchInput
    ){

        searchInput.focus();

    }

}


/* =========================================================
   SEARCH
   ========================================================= */

if(searchInput){

    searchInput.addEventListener(
        "input",
        function(){

            renderDiscover();

        }
    );

}


/* =========================================================
   TAB EVENTS
   ========================================================= */

document
    .querySelectorAll(".tab")
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function(){

                    activateTab(
                        button.dataset.tab
                    );

                }
            );

        }
    );


/* =========================================================
   PUBLIC API
   ========================================================= */

window.VitalStarFriends = {

    add:
        addFriend,

    accept:
        acceptRequest,

    acceptIncomingByUser,

    decline:
        declineRequest,

    cancel:
        cancelRequest,

    remove:
        removeFriend,

    profile:
        openProfile,

    message:
        messageUser,

    getCount:
        function(){

            return friends.length;

        }

};


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if(!user){

            window.location.href =
                "login.html";

            return;

        }


        currentUser =
            user;


        listenToFriends();

        listenToIncomingRequests();

        listenToOutgoingRequests();

        await loadUsers();

    }
);