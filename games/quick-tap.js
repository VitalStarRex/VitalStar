import {
    auth,
    rtdb
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    ref,
    set,
    update,
    get,
    onValue,
    remove,
    onDisconnect,
    runTransaction,
    push,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* =========================================================
   ELEMENTS
========================================================= */

const connectionStatus =
    document.getElementById("connectionStatus");

const roomStatus =
    document.getElementById("roomStatus");

const myScoreElement =
    document.getElementById("myScore");

const opponentScoreElement =
    document.getElementById("opponentScore");

const timerElement =
    document.getElementById("timer");

const tapButton =
    document.getElementById("tapButton");

const startButton =
    document.getElementById("startButton");

const leaveButton =
    document.getElementById("leaveButton");

const messageElement =
    document.getElementById("message");

const chatMessages =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatSend =
    document.getElementById("chatSend");


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let playerId = null;
let roomId = null;
let roomRef = null;

let countdownInterval = null;

let gameFinished = false;
let gameStarted = false;
let leavingGame = false;


/* =========================================================
   FIREBASE PATHS
========================================================= */

const waitingPath =
    "games/quickTap/waiting";

const roomsPath =
    "games/quickTap/rooms";


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if(!user){

            currentUser = null;
            playerId = null;

            startButton.disabled = true;
            tapButton.disabled = true;
            chatInput.disabled = true;
            chatSend.disabled = true;

            connectionStatus.textContent =
                "● Login required";

            messageElement.textContent =
                "Please log in to play.";

            return;
        }

        currentUser = user;
        playerId = user.uid;

        connectionStatus.textContent =
            "● Online";

        startButton.disabled = false;

        messageElement.textContent =
            "Ready to find an opponent.";

    }
);


/* =========================================================
   FIND OPPONENT
========================================================= */

startButton.addEventListener(
    "click",
    findOpponent
);


async function findOpponent(){

    if(!currentUser){

        messageElement.textContent =
            "Please log in first.";

        return;
    }

    if(roomId){

        return;
    }

    startButton.disabled = true;

    roomStatus.textContent =
        "🔎 Searching";

    messageElement.textContent =
        "Searching for another player...";


    try{

        const waitingRef =
            ref(
                rtdb,
                waitingPath
            );

        const snapshot =
            await get(waitingRef);


        if(
            snapshot.exists() &&
            snapshot.val()?.uid &&
            snapshot.val().uid !== playerId
        ){

            const waiting =
                snapshot.val();

            roomId =
                waiting.roomId;

            await joinExistingRoom(
                waiting.roomId,
                waiting.uid,
                waiting.name || "Player"
            );

            await remove(
                waitingRef
            );

        }
        else{

            await createWaitingRoom();

        }

    }
    catch(error){

        console.error(
            "Matching error:",
            error
        );

        roomId = null;

        roomStatus.textContent =
            "Unable to connect";

        messageElement.textContent =
            "Could not find a game. Try again.";

        startButton.disabled = false;

    }

}


/* =========================================================
   CREATE WAITING ROOM
========================================================= */

async function createWaitingRoom(){

    roomId =
        `${playerId}_${Date.now()}`;

    const waitingRef =
        ref(
            rtdb,
            waitingPath
        );


    await set(
        waitingRef,
        {

            uid: playerId,

            name:
                currentUser.displayName ||
                "Player",

            roomId: roomId,

            createdAt:
                serverTimestamp()

        }
    );


    onDisconnect(
        waitingRef
    ).remove();


    roomStatus.textContent =
        "⏳ Waiting for opponent";

    messageElement.textContent =
        "Keep this page open while we find an opponent.";

    startButton.textContent =
        "Waiting...";


    await createOwnRoom();

}


/* =========================================================
   CREATE OWN ROOM
========================================================= */

async function createOwnRoom(){

    roomRef =
        ref(
            rtdb,
            `${roomsPath}/${roomId}`
        );


    await set(
        roomRef,
        {

            status: "waiting",

            createdAt:
                serverTimestamp(),

            players: {

                [playerId]: {

                    name:
                        currentUser.displayName ||
                        "Player",

                    score: 0,

                    joinedAt:
                        serverTimestamp()

                }

            },

            state: {

                startTime: null,

                endTime: null

            }

        }
    );


    onDisconnect(
        roomRef
    ).remove();


    startRoomListener();

    startChatListener();

}


/* =========================================================
   JOIN EXISTING ROOM
========================================================= */

async function joinExistingRoom(
    id,
    opponentId,
    opponentName
){

    roomId = id;

    roomRef =
        ref(
            rtdb,
            `${roomsPath}/${roomId}`
        );


    const snapshot =
        await get(roomRef);


    if(!snapshot.exists()){

        roomId = null;

        throw new Error(
            "Room no longer exists."
        );

    }


    const room =
        snapshot.val();


    if(
        room.players &&
        Object.keys(room.players).length >= 2
    ){

        roomId = null;

        throw new Error(
            "Room is already full."
        );

    }


    await update(
        roomRef,
        {

            status: "ready",

            [`players/${playerId}`]: {

                name:
                    currentUser.displayName ||
                    "Player",

                score: 0,

                joinedAt:
                    serverTimestamp()

            }

        }
    );


    onDisconnect(
        roomRef
    ).remove();


    startRoomListener();

    startChatListener();

    roomStatus.textContent =
        "👥 Opponent found!";

    messageElement.textContent =
        "Get ready...";

}


/* =========================================================
   ROOM LISTENER
========================================================= */

function startRoomListener(){

    if(!roomRef) return;


    onValue(
        roomRef,
        snapshot => {

            const room =
                snapshot.val();


            if(!room){

                if(!leavingGame){

                    roomStatus.textContent =
                        "Room closed";

                    messageElement.textContent =
                        "The game room has closed.";

                }

                return;

            }


            updateRoomUI(
                room
            );

        }
    );

}


/* =========================================================
   ROOM UI
========================================================= */

function updateRoomUI(room){

    const players =
        room.players || {};

    const playerIds =
        Object.keys(players);


    const opponentId =
        playerIds.find(
            id =>
                id !== playerId
        );


    const me =
        players[playerId];

    const opponent =
        opponentId
        ? players[opponentId]
        : null;


    myScoreElement.textContent =
        me?.score || 0;

    opponentScoreElement.textContent =
        opponent?.score || 0;


    if(playerIds.length < 2){

        roomStatus.textContent =
            "⏳ Waiting for opponent";

        tapButton.disabled =
            true;

        chatInput.disabled =
            true;

        chatSend.disabled =
            true;

        return;

    }


    chatInput.disabled = false;
    chatSend.disabled = false;


    leaveButton.classList.remove(
        "hidden"
    );


    if(room.status === "ready"){

        roomStatus.textContent =
            "👥 Opponent found!";

        tapButton.disabled =
            true;

        messageElement.textContent =
            "Get ready...";

        startGameIfNeeded(
            room
        );

        return;

    }


    if(room.status === "playing"){

        gameStarted = true;

        roomStatus.textContent =
            "⚡ GAME ON";

        tapButton.disabled =
            false;

        startCountdown(
            room.state?.endTime
        );

        return;

    }


    if(room.status === "finished"){

        tapButton.disabled =
            true;

        finishGame(
            room
        );

    }

}


/* =========================================================
   START GAME
========================================================= */

async function startGameIfNeeded(room){

    if(gameStarted) return;

    if(!roomRef) return;


    const players =
        room.players || {};


    if(
        Object.keys(players).length < 2
    ){

        return;

    }


    const state =
        room.state || {};


    if(
        state.startTime ||
        state.endTime
    ){

        return;

    }


    gameStarted = true;


    const startTime =
        Date.now() + 3000;

    const endTime =
        startTime + 10000;


    try{

        await update(
            roomRef,
            {

                status: "playing",

                "state/startTime":
                    startTime,

                "state/endTime":
                    endTime

            }
        );

    }
    catch(error){

        gameStarted = false;

        console.error(
            "Start game error:",
            error
        );

    }

}


/* =========================================================
   TAP
========================================================= */

tapButton.addEventListener(
    "click",
    async () => {

        if(
            !roomRef ||
            gameFinished ||
            !gameStarted
        ){

            return;

        }


        const scoreRef =
            ref(
                rtdb,
                `${roomsPath}/${roomId}/players/${playerId}/score`
            );


        try{

            await runTransaction(
                scoreRef,
                score => {

                    if(
                        typeof score !== "number"
                    ){

                        return 1;

                    }

                    return score + 1;

                }
            );

        }
        catch(error){

            console.error(
                "Score update error:",
                error
            );

        }

    }
);


/* =========================================================
   COUNTDOWN
========================================================= */

let countdownStarted = false;


function startCountdown(endTime){

    if(
        !endTime ||
        countdownStarted
    ){

        return;

    }


    countdownStarted = true;


    clearInterval(
        countdownInterval
    );


    countdownInterval =
        setInterval(
            () => {

                const remaining =
                    Math.max(
                        0,
                        endTime - Date.now()
                    );


                timerElement.textContent =
                    Math.ceil(
                        remaining / 1000
                    );


                if(remaining <= 0){

                    clearInterval(
                        countdownInterval
                    );

                    countdownStarted =
                        false;

                    finishRoom();

                }

            },
            100
        );

}


/* =========================================================
   FINISH ROOM
========================================================= */

async function finishRoom(){

    if(!roomRef) return;


    try{

        const snapshot =
            await get(roomRef);

        const room =
            snapshot.val();


        if(!room) return;


        if(room.status === "finished"){

            return;

        }


        await update(
            roomRef,
            {
                status: "finished"
            }
        );

    }
    catch(error){

        console.error(
            "Finish error:",
            error
        );

    }

}


/* =========================================================
   FINISH GAME
========================================================= */

function finishGame(room){

    if(gameFinished) return;

    gameFinished = true;


    clearInterval(
        countdownInterval
    );


    const players =
        room.players || {};

    const ids =
        Object.keys(players);


    if(ids.length < 2){

        roomStatus.textContent =
            "Game ended.";

        return;

    }


    const myScore =
        players[playerId]?.score || 0;


    const opponentId =
        ids.find(
            id =>
                id !== playerId
        );


    const opponentScore =
        players[opponentId]?.score || 0;


    timerElement.textContent =
        "0";


    if(myScore > opponentScore){

        roomStatus.textContent =
            "🏆 YOU WIN!";

        messageElement.textContent =
            `You scored ${myScore} taps.`;

    }
    else if(myScore < opponentScore){

        roomStatus.textContent =
            "😅 YOU LOST";

        messageElement.textContent =
            `You scored ${myScore} taps.`;

    }
    else{

        roomStatus.textContent =
            "🤝 DRAW";

        messageElement.textContent =
            "Both players finished with the same score.";

    }


    tapButton.disabled =
        true;

    leaveButton.classList.remove(
        "hidden"
    );

}


/* =========================================================
   ROOM CHAT
========================================================= */

function startChatListener(){

    if(!roomId) return;


    const chatRef =
        ref(
            rtdb,
            `${roomsPath}/${roomId}/chat`
        );


    onValue(
        chatRef,
        snapshot => {

            const data =
                snapshot.val();


            chatMessages.innerHTML =
                "";


            if(!data){

                chatMessages.innerHTML = `
                    <div class="chat-empty">
                        No messages yet.
                        Say hello 👋
                    </div>
                `;

                return;

            }


            const messages =
                Object.entries(data)
                .sort(
                    (a,b) =>
                        (a[1].createdAt || 0) -
                        (b[1].createdAt || 0)
                )
                .slice(-50);


            messages.forEach(
                ([id,message]) => {

                    addChatMessage(
                        message
                    );

                }
            );


            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }
    );

}


/* =========================================================
   DISPLAY CHAT MESSAGE
========================================================= */

function addChatMessage(message){

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "chat-message" +
        (
            message.uid === playerId
            ? " mine"
            : ""
        );


    const safeName =
        escapeHTML(
            message.name || "Player"
        );


    const safeText =
        escapeHTML(
            message.text || ""
        );


    const time =
        formatTime(
            message.createdAt
        );


    wrapper.innerHTML = `

        <div class="chat-name">
            ${safeName}
        </div>

        <div class="chat-bubble">
            ${safeText}
        </div>

        <div class="chat-time">
            ${time}
        </div>

    `;


    chatMessages.appendChild(
        wrapper
    );

}


/* =========================================================
   SEND CHAT
========================================================= */

chatForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if(
            !roomId ||
            !currentUser
        ){

            return;

        }


        const text =
            chatInput.value.trim();


        if(!text) return;


        if(text.length > 200){

            return;

        }


        chatInput.disabled =
            true;

        chatSend.disabled =
            true;


        try{

            const messagesRef =
                ref(
                    rtdb,
                    `${roomsPath}/${roomId}/chat`
                );


            const newMessage =
                push(
                    messagesRef
                );


            await set(
                newMessage,
                {

                    uid:
                        playerId,

                    name:
                        currentUser.displayName ||
                        "Player",

                    text:
                        text,

                    createdAt:
                        serverTimestamp()

                }
            );


            chatInput.value =
                "";

        }
        catch(error){

            console.error(
                "Chat error:",
                error
            );

        }
        finally{

            chatInput.disabled =
                false;

            chatSend.disabled =
                false;

            chatInput.focus();

        }

    }
);


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value){

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(timestamp){

    if(
        !timestamp ||
        typeof timestamp !== "number"
    ){

        return "now";

    }


    return new Date(
        timestamp
    ).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   LEAVE GAME
========================================================= */

leaveButton.addEventListener(
    "click",
    leaveGame
);


async function leaveGame(){

    if(leavingGame) return;

    leavingGame = true;


    clearInterval(
        countdownInterval
    );


    tapButton.disabled =
        true;


    chatInput.disabled =
        true;

    chatSend.disabled =
        true;


    try{

        if(roomRef){

            await remove(
                roomRef
            );

        }

        const waitingRef =
            ref(
                rtdb,
                waitingPath
            );


        const waitingSnapshot =
            await get(waitingRef);


        if(
            waitingSnapshot.exists() &&
            waitingSnapshot.val()?.uid === playerId
        ){

            await remove(
                waitingRef
            );

        }

    }
    catch(error){

        console.error(
            "Leave error:",
            error
        );

    }


    window.location.href =
        "games.html";

}


/* =========================================================
   CONNECTION MONITOR
========================================================= */

const connectedRef =
    ref(
        rtdb,
        ".info/connected"
    );


onValue(
    connectedRef,
    snapshot => {

        if(snapshot.val() === true){

            connectionStatus.textContent =
                "● Online";

        }
        else{

            connectionStatus.textContent =
                "● Offline";

        }

    }
);


/* =========================================================
   PAGE CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        clearInterval(
            countdownInterval
        );

    }
);