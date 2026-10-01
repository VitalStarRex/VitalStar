/* =========================================================
   VITALSTAR — FRIEND SYSTEM
   Firebase v10.12.2
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
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let friends = [];
let incomingRequests = [];
let outgoingRequests = [];
let allUsers = [];

let activeTab = "friends";


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
        encodeURIComponent(getDisplayName(user)) +
        "&background=171d32&color=ffffff"
    );

}


function friendKey(uid1,uid2){

    return [uid1,uid2]
        .sort()
        .join("_");

}


function showToast(message){

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.__toastTimer);

    window.__toastTimer =
        setTimeout(function(){

            toast.classList.remove("show");

        },2500);

}


/* =========================================================
   USER CARD
   ========================================================= */

function userCard(user,actionHTML){

    const uid =
        user.uid || user.id;

    return `

        <div
            class="user-card"
            data-uid="${escapeHTML(uid)}"
        >

            <div class="avatar-wrap">

                <img
                    class="avatar"
                    src="${escapeHTML(getAvatar(user))}"
                    alt=""
                    loading="lazy"
                >

            </div>


            <div class="user-details">

                <div class="user-name">
                    ${escapeHTML(getDisplayName(user))}
                </div>

                <div class="username">
                    ${escapeHTML(getUsername(user))}
                </div>

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
                doc(db,"users",uid)
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
        fullName:"VitalStar User",
        username:"",
        profilePicture:""
    };

}


/* =========================================================
   LOAD FRIENDS
   ========================================================= */

function listenToFriends(){

    const q =
        query(
            collection(db,"friends"),
            where("users","array-contains",currentUser.uid)
        );

    onSnapshot(
        q,
        async function(snapshot){

            const results = [];

            for(
                const friendDoc
                of snapshot.docs
            ){

                const data =
                    friendDoc.data();

                const otherUid =
                    Array.isArray(data.users)
                    ? data.users.find(
                        uid =>
                            uid !== currentUser.uid
                    )
                    : null;

                if(!otherUid){
                    continue;
                }

                const user =
                    await getUser(otherUid);

                results.push(user);

            }

            friends = results;

            renderFriends();

            updateCounts();

        },
        function(error){

            console.error(
                "Friends listener:",
                error
            );

            friendsList.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">⚠️</div>
                    <strong>Could not load friends</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;

        }
    );

}


/* =========================================================
   LOAD INCOMING REQUESTS
   ========================================================= */

function listenToIncomingRequests(){

    const q =
        query(
            collection(db,"friendRequests"),
            where("to","==",currentUser.uid),
            where("status","==","pending")
        );

    onSnapshot(
        q,
        async function(snapshot){

            const results = [];

            for(
                const requestDoc
                of snapshot.docs
            ){

                const data =
                    requestDoc.data();

                const user =
                    await getUser(data.from);

                results.push({
                    id:requestDoc.id,
                    ...data,
                    user
                });

            }

            incomingRequests = results;

            renderRequests();

            updateCounts();

        },
        function(error){

            console.error(
                "Incoming requests:",
                error
            );

        }
    );

}


/* =========================================================
   LOAD SENT REQUESTS
   ========================================================= */

function listenToOutgoingRequests(){

    const q =
        query(
            collection(db,"friendRequests"),
            where("from","==",currentUser.uid),
            where("status","==","pending")
        );

    onSnapshot(
        q,
        async function(snapshot){

            const results = [];

            for(
                const requestDoc
                of snapshot.docs
            ){

                const data =
                    requestDoc.data();

                const user =
                    await getUser(data.to);

                results.push({
                    id:requestDoc.id,
                    ...data,
                    user
                });

            }

            outgoingRequests = results;

            renderSent();

            updateCounts();

        },
        function(error){

            console.error(
                "Outgoing requests:",
                error
            );

        }
    );

}


/* =========================================================
   LOAD DISCOVER USERS
   ========================================================= */

async function loadUsers(){

    try{

        const snapshot =
            await getDocs(
                collection(db,"users")
            );

        allUsers =
            snapshot.docs
                .map(function(item){

                    return {
                        uid:item.id,
                        ...item.data()
                    };

                })
                .filter(function(user){

                    return (
                        user.uid !==
                        currentUser.uid
                    );

                });

        renderDiscover();

    }catch(error){

        console.error(
            "Users:",
            error
        );

        discoverList.innerHTML = `
            <div class="empty">
                <div class="empty-icon">⚠️</div>
                <strong>Could not load users</strong>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;

    }

}


/* =========================================================
   GET RELATIONSHIP
   ========================================================= */

function relationship(uid){

    if(
        friends.some(
            user => user.uid === uid
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
   FRIENDS
   ========================================================= */

function renderFriends(){

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
                    Open Discover to find people and
                    send your first friend request.
                </p>

            </div>

        `;

        return;

    }

    friendsList.innerHTML =
        friends.map(function(user){

            return userCard(
                user,

                `

                <button
                    class="action-btn neutral"
                    onclick="window.VitalStarFriends.profile('${user.uid}')"
                >
                    Profile
                </button>

                <button
                    class="action-btn primary"
                    onclick="window.VitalStarFriends.message('${user.uid}')"
                >
                    Chat
                </button>

                <button
                    class="action-btn danger"
                    onclick="window.VitalStarFriends.remove('${user.uid}')"
                >
                    Remove
                </button>

                `

            );

        }).join("");

}


/* =========================================================
   REQUESTS
   ========================================================= */

function renderRequests(){

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
        incomingRequests.map(function(request){

            const user =
                request.user;

            return userCard(
                user,

                `

                <button
                    class="action-btn success"
                    onclick="window.VitalStarFriends.accept('${request.id}')"
                >
                    Accept
                </button>

                <button
                    class="action-btn danger"
                    onclick="window.VitalStarFriends.decline('${request.id}')"
                >
                    Decline
                </button>

                `

            );

        }).join("");

}


/* =========================================================
   SENT
   ========================================================= */

function renderSent(){

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
                    Friend requests you send will appear here.
                </p>

            </div>

        `;

        return;

    }

    sentList.innerHTML =
        outgoingRequests.map(function(request){

            const user =
                request.user;

            return userCard(
                user,

                `

                <button
                    class="action-btn neutral"
                    onclick="window.VitalStarFriends.profile('${user.uid}')"
                >
                    Profile
                </button>

                <button
                    class="action-btn danger"
                    onclick="window.VitalStarFriends.cancel('${request.id}')"
                >
                    Cancel
                </button>

                `

            );

        }).join("");

}


/* =========================================================
   DISCOVER
   ========================================================= */

function renderDiscover(){

    const term =
        searchInput.value
            .trim()
            .toLowerCase();

    let users =
        allUsers.filter(function(user){

            if(!term){
                return true;
            }

            const name =
                getDisplayName(user)
                    .toLowerCase();

            const username =
                String(
                    user.username || ""
                ).toLowerCase();

            return (
                name.includes(term) ||
                username.includes(term)
            );

        });

    document.getElementById(
        "discoverCount"
    ).textContent =
        users.length;


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
        users.map(function(user){

            const relation =
                relationship(user.uid);

            let buttons = "";

            if(relation === "friend"){

                buttons = `

                    <button
                        class="action-btn neutral"
                        onclick="window.VitalStarFriends.profile('${user.uid}')"
                    >
                        Profile
                    </button>

                    <button
                        class="action-btn primary"
                        onclick="window.VitalStarFriends.message('${user.uid}')"
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
                        onclick="window.VitalStarFriends.acceptIncomingByUser('${user.uid}')"
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
                        onclick="window.VitalStarFriends.profile('${user.uid}')"
                    >
                        Profile
                    </button>

                    <button
                        class="action-btn primary"
                        onclick="window.VitalStarFriends.add('${user.uid}')"
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
   UPDATE COUNTS
   ========================================================= */

function updateCounts(){

    document.getElementById(
        "friendsCount"
    ).textContent =
        friends.length +
        (
            friends.length === 1
            ? " friend"
            : " friends"
        );


    document.getElementById(
        "requestsCount"
    ).textContent =
        incomingRequests.length;


    document.getElementById(
        "sentCount"
    ).textContent =
        outgoingRequests.length;

    renderDiscover();

}


/* =========================================================
   SEND REQUEST
   ========================================================= */

async function addFriend(uid){

    if(!currentUser){
        return;
    }

    if(uid === currentUser.uid){
        return;
    }

    if(relationship(uid) !== "none"){

        showToast(
            "You already have a connection with this user."
        );

        return;

    }


    try{

        await addDoc(
            collection(
                db,
                "friendRequests"
            ),
            {
                from:currentUser.uid,
                to:uid,
                status:"pending",
                createdAt:serverTimestamp()
            }
        );

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

        await addDoc(
            collection(db,"friends"),
            {
                users:[
                    currentUser.uid,
                    request.from
                ],
                key:friendKey(
                    currentUser.uid,
                    request.from
                ),
                createdAt:serverTimestamp()
            }
        );


        await updateDoc(
            doc(
                db,
                "friendRequests",
                requestId
            ),
            {
                status:"accepted"
            }
        );


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
   ACCEPT BY USER
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
                status:"declined"
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
   CANCEL SENT REQUEST
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
                collection(db,"friends"),
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
                Array.isArray(data.users) &&
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

    activeTab = tab;

    document
        .querySelectorAll(".tab")
        .forEach(function(button){

            button.classList.toggle(
                "active",
                button.dataset.tab === tab
            );

        });


    document.getElementById(
        "friendsSection"
    ).style.display =
        tab === "friends"
        ? "block"
        : "none";


    document.getElementById(
        "requestsSection"
    ).style.display =
        tab === "requests"
        ? "block"
        : "none";


    document.getElementById(
        "sentSection"
    ).style.display =
        tab === "sent"
        ? "block"
        : "none";


    document.getElementById(
        "discoverSection"
    ).style.display =
        tab === "discover"
        ? "block"
        : "none";


    if(tab === "discover"){

        searchInput.focus();

    }

}


/* =========================================================
   SEARCH
   ========================================================= */

searchInput.addEventListener(
    "input",
    function(){

        renderDiscover();

    }
);


document
    .querySelectorAll(".tab")
    .forEach(function(button){

        button.addEventListener(
            "click",
            function(){

                activateTab(
                    button.dataset.tab
                );

            }
        );

    });


/* =========================================================
   PUBLIC API
   ========================================================= */

window.VitalStarFriends = {

    add:addFriend,

    accept:acceptRequest,

    acceptIncomingByUser,

    decline:declineRequest,

    cancel:cancelRequest,

    remove:removeFriend,

    profile:openProfile,

    message:messageUser

};


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async function(user){

        if(!user){

            window.location.href =
                "login.html";

            return;

        }

        currentUser = user;

        listenToFriends();

        listenToIncomingRequests();

        listenToOutgoingRequests();

        await loadUsers();

    }
);