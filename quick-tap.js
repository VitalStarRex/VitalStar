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

let chatStarted = false;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if(!user){

            messageElement.textContent =
                "Please log in to play.";

            startButton.disabled = true;

            connectionStatus.textContent =
                "● Login required";

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

    startButton.disabled = true;

    messageElement.textContent =
        "Searching for another player...";

    roomStatus.textContent =
        "🔎 Searching";


    try{

        const waitingRef =
            ref(
                rtdb,
                "quickTapWaiting"
            );

        const waitingSnapshot =
            await get(waitingRef);


        if(
            waitingSnapshot.exists() &&
            waitingSnapshot.val().uid !== playerId
        ){

            const waiting =
                waitingSnapshot.val();

            roomId =
                waiting.roomId;

            await createRoomWithOpponent(
                roomId,
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

        console.error(error);

        messageElement.textContent =
            "Unable to find a game. Try again.";

        startButton.disabled = false;

    }

}


/* =========================================================
   WAITING ROOM
========================================================= */

async function createWaitingRoom(){

    roomId =
        playerId + "_" + Date.now();


    const waitingRef =
        ref(
            rtdb,
            "quickTapWaiting"
        );


    await set(
        waitingRef,
        {
            uid:playerId,

            name:
                currentUser.displayName ||
                "Player",

            roomId:roomId
        }
    );


    onDisconnect(
        waitingRef
    ).remove();


    roomStatus.textContent =
        "⏳ Waiting for opponent";

    messageElement.textContent =
        "Keep this page open while we find an opponent.";

    startListeningToRoom(
        roomId
    );

}


/* =========================================================
   CREATE ROOM
========================================================= */

async function createRoomWithOpponent(
    id,
    opponentId,
    opponentName
){

    roomId = id;

    roomRef =
        ref(
            rtdb,
            "quickTapRooms/" + roomId
        );


    await update(
        roomRef,
        {

            status:"ready",

            players:{

                [playerId]:{

                    name:
                        currentUser.displayName ||
                        "Player",

                    score:0

                },

                [opponentId]:{

                    name:
                        opponentName,

                    score:0

                }

            }

        }
    );


    startListeningToRoom(
        roomId
    );

}


/* =========================================================
   LISTEN TO ROOM
========================================================= */

function startListeningToRoom(id){

    roomRef =
        ref(
            rtdb,
            "quickTapRooms/" + id
        );


    onValue(
        roomRef,
        snapshot => {

            const room =
                snapshot.val();


            if(!room){

                messageElement.textContent =
                    "Room closed.";

                return;

            }


            updateRoomUI(
                room
            );

        }
    );


    startChatListener(
        id
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

        return;

    }


    if(room.status === "ready"){

        roomStatus.textContent =
            "👥 Opponent found!";

        tapButton.disabled =
            true;

        messageElement.textContent =
            "Get ready...";

    }


    if(room.status === "playing"){

        tapButton.disabled =
            false;

        roomStatus.textContent =
            "⚡ GAME ON";

        startCountdown(
            room.endTime
        );

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

async function startGame(){

    if(!roomRef) return;


    const snapshot =
        await get(roomRef);

    const room =
        snapshot.val();


    if(!room) return;

    if(room.status !== "ready") return;


    const endTime =
        Date.now() + 10000;


    await update(
        roomRef,
        {

            status:"playing",

            endTime:endTime

        }
    );

}


/* =========================================================
   TAP
========================================================= */

tapButton.addEventListener(
    "click",
    async () => {

        if(
            !roomRef ||
            gameFinished
        ){

            return;

        }


        const scoreRef =
            ref(
                rtdb,
                `quickTapRooms/${roomId}/players/${playerId}/score`
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

    if(countdownStarted) return;


    countdownStarted = true;

    clearInterval(
        countdownInterval
    );


    countdownInterval =
        setInterval(
            async () => {

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

                    await finishRoom();

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
            status:"finished"
        }
    );

}


/* =========================================================
   FINISH GAME
========================================================= */

function finishGame(room){

    if(gameFinished) return;


    gameFinished = true;


    const players =
        room.players || {};

    const ids =
        Object.keys(players);


    if(ids.length < 2){

        messageElement.textContent =
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


    timerElement.textContent = "0";


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


    tapButton.disabled = true;

    leaveButton.classList.remove(
        "hidden"
    );

}


/* =========================================================
   ROOM CHAT
========================================================= */

function startChatListener(id){

    if(chatStarted) return;

    chatStarted = true;


    const chatRef =
        ref(
            rtdb,
            `quickTapRooms/${id}/chat`
        );


    onValue(
        chatRef,
        snapshot => {

            const data =
                snapshot.val();


            chatMessages.innerHTML = "";


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
        document.createElement("div");


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


        chatInput.disabled = true;

        chatSend.disabled = true;


        try{

            const messagesRef =
                ref(
                    rtdb,
                    `quickTapRooms/${roomId}/chat`
                );


            const newMessage =
                push(messagesRef);


            await set(
                newMessage,
                {

                    uid:playerId,

                    name:
                        currentUser.displayName ||
                        "Player",

                    text:text,

                    createdAt:
                        serverTimestamp()

                }
            );


            chatInput.value = "";

        }
        catch(error){

            console.error(
                "Chat error:",
                error
            );

        }
        finally{

            chatInput.disabled = false;

            chatSend.disabled = false;

            chatInput.focus();

        }

    }
);


/* =========================================================
   ENABLE CHAT WHEN ROOM EXISTS
========================================================= */

function enableChat(){

    chatInput.disabled = false;

    chatSend.disabled = false;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value){

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;

}


/* =========================================================
   TIME
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
            hour:"2-digit",
            minute:"2-digit"
        }
    );

}


/* =========================================================
   LEAVE
========================================================= */

leaveButton.addEventListener(
    "click",
    leaveGame
);


async function leaveGame(){

    clearInterval(
        countdownInterval
    );


    if(roomRef){

        try{

            await remove(
                roomRef
            );

        }
        catch(error){

            console.error(
                error
            );

        }

    }


    window.location.href =
        "games.html";

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        clearInterval(
            countdownInterval
        );

    }
);


/* =========================================================
   WATCH FOR READY ROOM
========================================================= */

setInterval(
    async () => {

        if(
            !roomRef ||
            gameFinished
        ){

            return;

        }


        try{

            const snapshot =
                await get(roomRef);

            const room =
                snapshot.val();


            if(
                room &&
                room.status === "ready"
            ){

                enableChat();

                await startGame();

            }

        }
        catch(error){

            console.error(error);

        }

    },
    1000
);