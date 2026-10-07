// ============================================================
// VITALSTAR — VOLCANO JUMP
// Multiplayer Last-Player-Standing Road Survival
//
// SIMPLE LAVA ONLY
//
// Firebase v10.12.2
// ============================================================

import { auth, db } from "../firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    doc,
    query,
    where,
    limit,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    recordGameResult
} from "./games.js";


// ============================================================
// CONSTANTS
// ============================================================

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

const GAME_ID = "volcano-jump";

const GAME_DURATION = 180;

const ROAD_WIDTH = 390;
const ROAD_HEIGHT = 700;

const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 42;

const PLAYER_SPEED = 235;

// Strong enough to clearly jump over lava.
const JUMP_FORCE = -600;

const GRAVITY = 1350;

const STATE_SEND_INTERVAL = 250;

// Simple lava.
const LAVA_WARNING_TIME = 1.0;
const LAVA_HEIGHT = 30;

const LAVA_START_Y = 300;
const LAVA_END_Y = 705;

const PLAYER_GROUND_Y = 570;

const COLORS = [
    "#54d8ff",
    "#ff4d91",
    "#ffd34e",
    "#8cff63"
];


// ============================================================
// DOM
// ============================================================

const lobby =
    document.getElementById("lobby");

const gameArea =
    document.getElementById("gameArea");

const roomCodeEl =
    document.getElementById("roomCode");

const gameRoomCodeEl =
    document.getElementById("gameRoomCode");

const playerCountEl =
    document.getElementById("playerCount");

const playersList =
    document.getElementById("playersList");

const readyButton =
    document.getElementById("readyButton");

const lobbyStatus =
    document.getElementById("lobbyStatus");

const quickMatchButton =
    document.getElementById("quickMatchButton");

const createRoomButton =
    document.getElementById("createRoomButton");

const roomInput =
    document.getElementById("roomInput");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const leaveButton =
    document.getElementById("leaveButton");

const scoreValue =
    document.getElementById("scoreValue");

const aliveValue =
    document.getElementById("aliveValue");

const timeValue =
    document.getElementById("timeValue");

const livesValue =
    document.getElementById("livesValue");

const leaderboardRows =
    document.getElementById("leaderboardRows");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas?.getContext("2d");

const countdownOverlay =
    document.getElementById("countdownOverlay");

const countdownMessage =
    document.getElementById("countdownMessage");

const countdownNumber =
    document.getElementById("countdownNumber");

const waitingOverlay =
    document.getElementById("waitingOverlay");

const waitingTitle =
    document.getElementById("waitingTitle");

const waitingText =
    document.getElementById("waitingText");

const gameMessage =
    document.getElementById("gameMessage");

const messageIcon =
    document.getElementById("messageIcon");

const messageTitle =
    document.getElementById("messageTitle");

const messageText =
    document.getElementById("messageText");

const winnerOverlay =
    document.getElementById("winnerOverlay");

const winnerTitle =
    document.getElementById("winnerTitle");

const winnerName =
    document.getElementById("winnerName");

const winnerScore =
    document.getElementById("winnerScore");

const resultLeaderboard =
    document.getElementById("resultLeaderboard");

const returnLobbyButton =
    document.getElementById("returnLobbyButton");

const leftButton =
    document.getElementById("leftButton");

const rightButton =
    document.getElementById("rightButton");

const jumpButton =
    document.getElementById("jumpButton");


// ============================================================
// SAFETY CHECK
// ============================================================

if(!canvas || !ctx){

    console.error(
        "Volcano Jump: gameCanvas was not found."
    );

}


// ============================================================
// FIREBASE / AUTH STATE
// ============================================================

let currentUser = null;

let authResolver;

const authReady =
    new Promise(resolve => {
        authResolver = resolve;
    });


onAuthStateChanged(
    auth,
    async user => {

        currentUser =
            user || null;

        authResolver(currentUser);

        if(!currentUser){

            setLobbyStatus(
                "Please log in to play Volcano Jump."
            );

            if(readyButton)
                readyButton.disabled = true;

            if(quickMatchButton)
                quickMatchButton.disabled = true;

            if(createRoomButton)
                createRoomButton.disabled = true;

            if(joinRoomButton)
                joinRoomButton.disabled = true;

            return;
        }


        if(readyButton)
            readyButton.disabled = false;

        if(quickMatchButton)
            quickMatchButton.disabled = false;

        if(createRoomButton)
            createRoomButton.disabled = false;

        if(joinRoomButton)
            joinRoomButton.disabled = false;


        setLobbyStatus(
            `Welcome ${await getFullName(currentUser)}. Create or join a room.`
        );

    }
);


// ============================================================
// ROOM STATE
// ============================================================

let roomId = null;
let roomData = null;
let isHost = false;

let roomUnsubscribe = null;
let playersUnsubscribe = null;
let chatUnsubscribe = null;

let currentPlayerRef = null;


// ============================================================
// PLAYERS
// ============================================================

const players = new Map();


// ============================================================
// LOCAL PLAYER
// ============================================================

const player = {

    x:
        ROAD_WIDTH / 2 -
        PLAYER_WIDTH / 2,

    y:
        PLAYER_GROUND_Y -
        PLAYER_HEIGHT,

    vx: 0,
    vy: 0,

    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,

    grounded: true,
    jumping: false,

    alive: true,
    ready: false,

    lives: 3,
    score: 0,
    distance: 0,

    invulnerable: 1.5,
    lastHit: 0,

    eliminationReason: "",

    color: COLORS[0],

    fullName: "Player"

};


// ============================================================
// GAME STATE
// ============================================================

let gameStarted = false;
let gameFinished = false;

let gameStartTime = 0;
let gameElapsed = 0;

let lastFrameTime =
    performance.now();

let animationFrame = null;
let countdownTimer = null;

let resultRecorded = false;

let lastStateSend = 0;
let lastScoreUpdate = 0;

let roadScroll = 0;

let roomSeed = 1;

// LAVA ONLY.
let lavaEvents = [];

let particles = [];

let keys = {
    left: false,
    right: false
};


// ============================================================
// CHAT STATE
// ============================================================

let chatPanel = null;
let chatMessages = null;
let chatInput = null;
let chatSendButton = null;
let chatToggleButton = null;

let chatUnread = 0;


// ============================================================
// BASIC HELPERS
// ============================================================

function setLobbyStatus(text){

    if(lobbyStatus)
        lobbyStatus.textContent = text;

}


// ============================================================
// FULL NAME
// ============================================================

async function getFullName(user){

    if(!user)
        return "Player";

    try{

        const snapshot =
            await getDocs(
                query(
                    collection(db, "users"),
                    where("__name__", "==", user.uid),
                    limit(1)
                )
            );

        if(!snapshot.empty){

            const data =
                snapshot.docs[0].data();

            const fullName =
                data.fullName ||
                data.name ||
                `${data.firstName || ""} ${data.lastName || ""}`.trim();

            if(fullName)
                return fullName;

        }

    }catch(error){

        console.warn(
            "Could not load full name:",
            error
        );

    }


    if(
        user.displayName &&
        user.displayName.trim()
    ){

        return user.displayName.trim();

    }


    return "Player";

}


// ============================================================
// SYNCHRONOUS DISPLAY NAME
// ============================================================

function getUserName(user){

    if(!user)
        return "Player";

    if(
        user.fullName &&
        user.fullName.trim()
    ){

        return user.fullName.trim();

    }

    if(
        user.displayName &&
        user.displayName.trim()
    ){

        return user.displayName.trim();

    }

    return "Player";

}


// ============================================================
// USERNAME
// ============================================================

function getUsername(user){

    if(!user)
        return "player";

    const name =
        user.displayName ||
        "player";

    return name
        .replace(/\s+/g,"")
        .toLowerCase()
        .slice(0,20);

}


// ============================================================
// PLAYER COLOR
// ============================================================

function getPlayerColor(uid){

    if(!uid)
        return COLORS[0];

    let total = 0;

    for(
        let i = 0;
        i < uid.length;
        i++
    ){

        total +=
            uid.charCodeAt(i);

    }

    return COLORS[
        total % COLORS.length
    ];

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value){

    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


// ============================================================
// ROOM CODE
// ============================================================

function generateRoomCode(){

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for(let i = 0; i < 6; i++){

        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }

    return result;

}


// ============================================================
// QUICK MATCH
// ============================================================

if(quickMatchButton){

    quickMatchButton.addEventListener(
        "click",
        async () => {

            if(!currentUser){

                setLobbyStatus(
                    "Please log in first."
                );

                return;
            }

            setLobbyStatus(
                "Searching for a Volcano Jump match..."
            );

            quickMatchButton.disabled = true;

            try{

                const roomsQuery =
                    query(
                        collection(
                            db,
                            "gameRooms"
                        ),
                        where(
                            "game",
                            "==",
                            GAME_ID
                        ),
                        limit(20)
                    );

                const snapshot =
                    await getDocs(
                        roomsQuery
                    );

                let selectedRoom = null;

                for(
                    const roomDoc
                    of snapshot.docs
                ){

                    const data =
                        roomDoc.data();

                    if(
                        data.status !==
                        "waiting"
                    ){
                        continue;
                    }

                    const playerSnapshot =
                        await getDocs(
                            collection(
                                db,
                                "gameRooms",
                                roomDoc.id,
                                "players"
                            )
                        );

                    if(
                        playerSnapshot.size >=
                        MAX_PLAYERS
                    ){
                        continue;
                    }

                    selectedRoom =
                        roomDoc;

                    break;

                }

                if(selectedRoom){

                    await joinExistingRoom(
                        selectedRoom.id,
                        selectedRoom.data()
                    );

                }else{

                    await createRoom(true);

                }

            }catch(error){

                console.error(
                    "Quick match error:",
                    error
                );

                setLobbyStatus(
                    "Could not find a match. Try again."
                );

            }

            quickMatchButton.disabled = false;

        }
    );

}


// ============================================================
// CREATE ROOM
// ============================================================

if(createRoomButton){

    createRoomButton.addEventListener(
        "click",
        async () => {

            await createRoom(false);

        }
    );

}


async function createRoom(
    isQuickMatch = false
){

    if(!currentUser){

        setLobbyStatus(
            "Please log in first."
        );

        return;

    }

    try{

        const roomRef =
            doc(
                collection(
                    db,
                    "gameRooms"
                )
            );

        const roomCode =
            generateRoomCode();

        const seed =
            Math.floor(
                Math.random() *
                2147483647
            );

        await setDoc(
            roomRef,
            {

                game: GAME_ID,

                roomCode,

                hostUid:
                    currentUser.uid,

                status: "waiting",

                playersCount: 0,
                readyCount: 0,

                maxPlayers:
                    MAX_PLAYERS,

                minPlayers:
                    MIN_PLAYERS,

                seed,

                startAt: null,

                createdAt:
                    serverTimestamp(),

                winnerUid: null

            }
        );

        await joinExistingRoom(
            roomRef.id,
            {
                roomCode,
                hostUid:
                    currentUser.uid,
                status: "waiting",
                playersCount: 0,
                readyCount: 0,
                maxPlayers:
                    MAX_PLAYERS,
                minPlayers:
                    MIN_PLAYERS,
                seed
            }
        );

        if(isQuickMatch){

            setLobbyStatus(
                "Room created. Waiting for another player..."
            );

        }

    }catch(error){

        console.error(
            "Create room error:",
            error
        );

        setLobbyStatus(
            "Unable to create room."
        );

    }

}


// ============================================================
// JOIN ROOM BUTTON
// ============================================================

if(joinRoomButton){

    joinRoomButton.addEventListener(
        "click",
        async () => {

            const code =
                roomInput?.value
                    .trim()
                    .toUpperCase();

            if(!code || code.length !== 6){

                setLobbyStatus(
                    "Enter a valid 6-character room code."
                );

                return;

            }

            if(!currentUser){

                setLobbyStatus(
                    "Please log in first."
                );

                return;

            }

            joinRoomButton.disabled = true;

            try{

                const roomsQuery =
                    query(
                        collection(
                            db,
                            "gameRooms"
                        ),
                        where(
                            "roomCode",
                            "==",
                            code
                        ),
                        limit(1)
                    );

                const snapshot =
                    await getDocs(
                        roomsQuery
                    );

                if(snapshot.empty){

                    setLobbyStatus(
                        "Room not found."
                    );

                    return;

                }

                const roomDoc =
                    snapshot.docs[0];

                const data =
                    roomDoc.data();

                if(data.game !== GAME_ID){

                    setLobbyStatus(
                        "That room is not a Volcano Jump room."
                    );

                    return;

                }

                if(data.status !== "waiting"){

                    setLobbyStatus(
                        "That match has already started."
                    );

                    return;

                }

                await joinExistingRoom(
                    roomDoc.id,
                    data
                );

            }catch(error){

                console.error(
                    "Join room error:",
                    error
                );

                setLobbyStatus(
                    "Unable to join room."
                );

            }finally{

                joinRoomButton.disabled =
                    false;

            }

        }
    );

}


// ============================================================
// JOIN EXISTING ROOM
// ============================================================

async function joinExistingRoom(
    targetRoomId,
    targetRoomData
){

    if(!currentUser)
        return;

    if(
        targetRoomData.status !==
        "waiting"
    ){

        setLobbyStatus(
            "This match has already started."
        );

        return;

    }

    roomId =
        targetRoomId;

    roomData =
        targetRoomData;

    isHost =
        targetRoomData.hostUid ===
        currentUser.uid;

    const playerRef =
        doc(
            db,
            "gameRooms",
            roomId,
            "players",
            currentUser.uid
        );

    currentPlayerRef =
        playerRef;

    const existingPlayers =
        await getDocs(
            collection(
                db,
                "gameRooms",
                roomId,
                "players"
            )
        );

    const alreadyJoined =
        existingPlayers.docs.some(
            p =>
                p.id ===
                currentUser.uid
        );

    if(
        existingPlayers.size >= MAX_PLAYERS &&
        !alreadyJoined
    ){

        setLobbyStatus(
            "This room is full."
        );

        roomId = null;
        currentPlayerRef = null;

        return;

    }

    const fullName =
        await getFullName(
            currentUser
        );

    currentUser.fullName =
        fullName;

    player.fullName =
        fullName;

    player.color =
        getPlayerColor(
            currentUser.uid
        );

    player.ready = false;
    player.alive = true;
    player.lives = 3;
    player.score = 0;

    player.x =
        ROAD_WIDTH / 2 -
        PLAYER_WIDTH / 2;

    player.y =
        PLAYER_GROUND_Y -
        PLAYER_HEIGHT;

    await setDoc(
        playerRef,
        {

            uid:
                currentUser.uid,

            displayName:
                fullName,

            fullName:
                fullName,

            username:
                getUsername(
                    currentUser
                ),

            ready: false,

            alive: true,

            lives: 3,

            score: 0,

            x: player.x,

            y: player.y,

            color: player.color,

            joinedAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()

        }
    );

    showGameRoom();

    subscribeToRoom();

    subscribeToPlayers();

    createChat();

}


// ============================================================
// SHOW ROOM
// ============================================================

function showGameRoom(){

    if(lobby)
        lobby.style.display =
            "block";

    if(gameArea)
        gameArea.style.display =
            "none";

    if(roomCodeEl)
        roomCodeEl.textContent =
            roomData?.roomCode ||
            "------";

}


// ============================================================
// ROOM SUBSCRIPTION
// ============================================================

function subscribeToRoom(){

    if(roomUnsubscribe)
        roomUnsubscribe();

    const roomRef =
        doc(
            db,
            "gameRooms",
            roomId
        );

    roomUnsubscribe =
        onSnapshot(
            roomRef,
            snapshot => {

                if(!snapshot.exists()){

                    leaveRoomLocal();

                    return;

                }

                roomData =
                    snapshot.data();

                if(roomCodeEl)
                    roomCodeEl.textContent =
                        roomData.roomCode ||
                        "------";

                if(gameRoomCodeEl)
                    gameRoomCodeEl.textContent =
                        roomData.roomCode ||
                        "------";

                if(
                    roomData.status ===
                    "playing"
                ){

                    if(waitingOverlay)
                        waitingOverlay.style.display =
                            "none";

                    if(
                        roomData.startAt &&
                        !gameStarted &&
                        !gameFinished
                    ){

                        startCountdown(
                            roomData.startAt
                        );

                    }

                }

                if(
                    roomData.status ===
                    "finished"
                ){

                    if(!gameFinished){

                        finishGame(
                            "match-finished"
                        );

                    }

                }

            },
            error => {

                console.error(
                    "Room listener:",
                    error
                );

            }
        );

}


// ============================================================
// PLAYER SUBSCRIPTION
// ============================================================

function subscribeToPlayers(){

    if(playersUnsubscribe)
        playersUnsubscribe();

    const playersRef =
        collection(
            db,
            "gameRooms",
            roomId,
            "players"
        );

    playersUnsubscribe =
        onSnapshot(
            playersRef,
            snapshot => {

                players.clear();

                snapshot.forEach(
                    playerDoc => {

                        const data =
                            playerDoc.data();

                        players.set(
                            playerDoc.id,
                            {
                                uid:
                                    playerDoc.id,

                                ...data,

                                displayName:
                                    data.fullName ||
                                    data.displayName ||
                                    "Player",

                                fullName:
                                    data.fullName ||
                                    data.displayName ||
                                    "Player"

                            }
                        );

                    }
                );

                const count =
                    players.size;

                if(playerCountEl){

                    playerCountEl.textContent =
                        `Players: ${count}/${MAX_PLAYERS}`;

                }

                renderPlayersList();

                renderLeaderboard();

                if(
                    roomData &&
                    roomData.status ===
                    "waiting"
                ){

                    updateWaitingState();

                }

                if(
                    gameStarted &&
                    !gameFinished
                ){

                    checkLastPlayerStanding();

                }

            },
            error => {

                console.error(
                    "Players listener:",
                    error
                );

            }
        );

}


// ============================================================
// WAITING STATE
// ============================================================

function updateWaitingState(){

    const count =
        players.size;

    const readyCount =
        [...players.values()]
            .filter(
                p =>
                    p.ready === true
            )
            .length;

    if(count < MIN_PLAYERS){

        setLobbyStatus(
            `Waiting for players... ${count}/${MIN_PLAYERS} minimum`
        );

    }else if(
        readyCount < count
    ){

        setLobbyStatus(
            `${readyCount}/${count} players ready. Everyone must press READY.`
        );

    }else{

        setLobbyStatus(
            "All players ready. Starting..."
        );

    }

    if(
        count >= MIN_PLAYERS &&
        readyCount === count &&
        !gameStarted &&
        !roomData.startAt
    ){

        if(isHost)
            startMatch();

    }

    if(player.ready){

        readyButton.textContent =
            "✓ READY";

        readyButton.classList.add(
            "readyOn"
        );

    }else{

        readyButton.textContent =
            "🔥 READY";

        readyButton.classList.remove(
            "readyOn"
        );

    }

}


// ============================================================
// READY BUTTON
// ============================================================

if(readyButton){

    readyButton.addEventListener(
        "click",
        async () => {

            if(!currentPlayerRef)
                return;

            if(!roomData)
                return;

            if(
                roomData.status !==
                "waiting"
            )
                return;

            try{

                player.ready =
                    !player.ready;

                await updateDoc(
                    currentPlayerRef,
                    {

                        ready:
                            player.ready,

                        updatedAt:
                            serverTimestamp()

                    }
                );

                updateWaitingState();

            }catch(error){

                console.error(
                    "Ready error:",
                    error
                );

            }

        }
    );

}


// ============================================================
// HOST START MATCH
// ============================================================

async function startMatch(){

    if(!isHost || !roomData)
        return;

    if(
        roomData.status !==
        "waiting"
    )
        return;

    const playerArray =
        [...players.values()];

    if(
        playerArray.length <
        MIN_PLAYERS
    )
        return;

    const everyoneReady =
        playerArray.every(
            p =>
                p.ready === true
        );

    if(!everyoneReady)
        return;

    const startAt =
        Date.now() + 3500;

    try{

        await updateDoc(
            doc(
                db,
                "gameRooms",
                roomId
            ),
            {

                status:
                    "playing",

                startAt,

                playersCount:
                    playerArray.length,

                readyCount:
                    playerArray.length

            }
        );

    }catch(error){

        console.error(
            "Start match error:",
            error
        );

    }

}


// ============================================================
// COUNTDOWN
// ============================================================

function startCountdown(startAt){

    if(gameStarted)
        return;

    countdownOverlay?.classList.remove(
        "hidden"
    );

    if(waitingOverlay)
        waitingOverlay.style.display =
            "none";

    if(countdownTimer){

        clearInterval(
            countdownTimer
        );

    }

    function updateCountdown(){

        const remaining =
            startAt -
            Date.now();

        if(remaining <= 0){

            clearInterval(
                countdownTimer
            );

            countdownTimer = null;

            if(countdownNumber)
                countdownNumber.textContent =
                    "GO!";

            setTimeout(
                () => {

                    countdownOverlay?.classList.add(
                        "hidden"
                    );

                    beginGame();

                },
                350
            );

            return;

        }

        const seconds =
            Math.ceil(
                remaining / 1000
            );

        if(countdownMessage)
            countdownMessage.textContent =
                "ALL PLAYERS READY!";

        if(countdownNumber)
            countdownNumber.textContent =
                seconds;

    }

    updateCountdown();

    countdownTimer =
        setInterval(
            updateCountdown,
            100
        );

}


// ============================================================
// BEGIN GAME
// ============================================================

function beginGame(){

    if(gameStarted)
        return;

    gameStarted = true;
    gameFinished = false;
    resultRecorded = false;

    gameStartTime =
        roomData?.startAt ||
        Date.now();

    gameElapsed = 0;

    lastFrameTime =
        performance.now();

    player.x =
        ROAD_WIDTH / 2 -
        PLAYER_WIDTH / 2;

    player.y =
        PLAYER_GROUND_Y -
        PLAYER_HEIGHT;

    player.vx = 0;
    player.vy = 0;

    player.grounded = true;
    player.jumping = false;

    player.alive = true;

    player.lives = 3;
    player.score = 0;
    player.distance = 0;

    player.invulnerable = 1.5;

    roomSeed =
        Number(
            roomData?.seed ||
            1
        );

    // Generate only lava.
    generateLavaEvents();

    if(lobby)
        lobby.style.display =
            "none";

    if(gameArea)
        gameArea.style.display =
            "block";

    if(waitingOverlay)
        waitingOverlay.style.display =
            "none";

    if(gameMessage)
        gameMessage.style.display =
            "none";

    updateHUD();

    sendPlayerState(true);

    if(animationFrame){

        cancelAnimationFrame(
            animationFrame
        );

    }

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );

}


// ============================================================
// LAVA DIFFICULTY
// ============================================================

function getLavaDifficulty(time){

    if(time < 30){

        return {
            speedMultiplier: 1.0,
            spawnGap: 3.2
        };

    }

    if(time < 60){

        return {
            speedMultiplier: 1.15,
            spawnGap: 2.8
        };

    }

    if(time < 90){

        return {
            speedMultiplier: 1.3,
            spawnGap: 2.4
        };

    }

    if(time < 120){

        return {
            speedMultiplier: 1.5,
            spawnGap: 2.0
        };

    }

    return {
        speedMultiplier: 1.7,
        spawnGap: 1.7
    };

}


// ============================================================
// LAVA SPEED
// ============================================================

function getLavaSpeed(time){

    const difficulty =
        getLavaDifficulty(time);

    const baseSpeed =
        (
            LAVA_END_Y -
            LAVA_START_Y
        ) / 3.0;

    return (
        baseSpeed *
        difficulty.speedMultiplier
    );

}


// ============================================================
// GENERATE LAVA
// ============================================================
//
// Very simple:
//
// Every few seconds a lava wave appears.
// The timing is shared by everyone in the room.
// ============================================================

function generateLavaEvents(){

    lavaEvents = [];

    let time = 4.0;

    let index = 0;

    while(
        time <
        GAME_DURATION
    ){

        const difficulty =
            getLavaDifficulty(time);

        const speed =
            getLavaSpeed(time);

        const distance =
            LAVA_END_Y -
            LAVA_START_Y;

        const duration =
            distance /
            speed;

        lavaEvents.push({

            id:
                `lava-${index}`,

            time,

            startY:
                LAVA_START_Y,

            endY:
                LAVA_END_Y,

            duration,

            warning:
                LAVA_WARNING_TIME,

            height:
                LAVA_HEIGHT,

            speed,

            speedMultiplier:
                difficulty.speedMultiplier,

            spawnGap:
                difficulty.spawnGap

        });

        index++;

        time +=
            difficulty.spawnGap;

    }

}


// ============================================================
// ROAD PERSPECTIVE
// ============================================================

function getRoadBoundsAtY(y){

    const topY = 300;
    const bottomY = 700;

    const progress =
        Math.max(
            0,
            Math.min(
                1,
                (
                    y -
                    topY
                ) /
                (
                    bottomY -
                    topY
                )
            )
        );

    const left =
        125 +
        (
            38 -
            125
        ) *
        progress;

    const right =
        265 +
        (
            352 -
            265
        ) *
        progress;

    return {

        left,
        right,

        width:
            right -
            left

    };

}


// ============================================================
// LAVA POSITION
// ============================================================

function getLavaPosition(event){

    const elapsed =
        gameElapsed -
        event.time;

    const progress =
        Math.max(
            0,
            Math.min(
                1,
                elapsed /
                event.duration
            )
        );

    const y =
        event.startY +
        (
            event.endY -
            event.startY
        ) *
        progress;

    const road =
        getRoadBoundsAtY(
            y
        );

    return {

        y,

        left:
            road.left,

        right:
            road.right,

        width:
            road.width,

        progress

    };

}


// ============================================================
// GAME LOOP
// ============================================================

function gameLoop(now){

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );

    const delta =
        Math.min(
            (
                now -
                lastFrameTime
            ) / 1000,
            .035
        );

    lastFrameTime =
        now;

    if(
        !gameStarted ||
        gameFinished
    ){

        drawScene();

        return;

    }

    gameElapsed =
        Math.max(
            0,
            (
                Date.now() -
                gameStartTime
            ) / 1000
        );

    if(
        gameElapsed >=
        GAME_DURATION
    ){

        finishGame("time");

        return;

    }

    updatePlayer(delta);

    updateWorld(delta);

    updateParticles(delta);

    updateScore(delta);

    updateHUD();

    updateGameStateNetwork();

    drawScene();

    checkLastPlayerStanding();

}


// ============================================================
// PLAYER UPDATE
// ============================================================

function updatePlayer(delta){

    if(!player.alive)
        return;

    player.invulnerable =
        Math.max(
            0,
            player.invulnerable -
            delta
        );

    let direction = 0;

    if(keys.left)
        direction--;

    if(keys.right)
        direction++;

    player.vx =
        direction *
        PLAYER_SPEED;

    player.x +=
        player.vx *
        delta;

    player.x =
        Math.max(
            45,
            Math.min(
                ROAD_WIDTH -
                45 -
                player.width,
                player.x
            )
        );

    player.vy +=
        GRAVITY *
        delta;

    player.y +=
        player.vy *
        delta;

    if(
        player.y +
        player.height >=
        PLAYER_GROUND_Y
    ){

        player.y =
            PLAYER_GROUND_Y -
            player.height;

        player.vy = 0;

        player.grounded = true;
        player.jumping = false;

    }else{

        player.grounded = false;

    }

    // ONLY LAVA.
    checkLava();

}


// ============================================================
// JUMP
// ============================================================

function jump(){

    if(
        !player.alive ||
        gameFinished ||
        !gameStarted
    )
        return;

    if(player.grounded){

        player.vy =
            JUMP_FORCE;

        player.grounded =
            false;

        player.jumping =
            true;

        createJumpParticles();

    }

}


// ============================================================
// TOUCH CONTROLS
// ============================================================

function holdButton(
    button,
    key
){

    if(!button)
        return;

    button.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            keys[key] = true;

        }
    );

    button.addEventListener(
        "pointerup",
        event => {

            event.preventDefault();

            keys[key] = false;

        }
    );

    button.addEventListener(
        "pointercancel",
        () => {

            keys[key] = false;

        }
    );

    button.addEventListener(
        "pointerleave",
        () => {

            keys[key] = false;

        }
    );

}


holdButton(
    leftButton,
    "left"
);

holdButton(
    rightButton,
    "right"
);


if(jumpButton){

    jumpButton.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            jump();

        }
    );

}


// ============================================================
// KEYBOARD
// ============================================================

window.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "ArrowLeft" ||
            event.key.toLowerCase() === "a"
        ){

            keys.left = true;

        }

        if(
            event.key === "ArrowRight" ||
            event.key.toLowerCase() === "d"
        ){

            keys.right = true;

        }

        if(
            event.key === " " ||
            event.key === "ArrowUp" ||
            event.key.toLowerCase() === "w"
        ){

            event.preventDefault();

            jump();

        }

    }
);


window.addEventListener(
    "keyup",
    event => {

        if(
            event.key === "ArrowLeft" ||
            event.key.toLowerCase() === "a"
        ){

            keys.left = false;

        }

        if(
            event.key === "ArrowRight" ||
            event.key.toLowerCase() === "d"
        ){

            keys.right = false;

        }

    }
);


// ============================================================
// SIMPLE LAVA COLLISION
// ============================================================
//
// THIS IS THE IMPORTANT PART.
//
// If the player's FEET are above the
// top of the lava, the player is safe.
//
// Therefore jumping over the lava works.
// ============================================================

function checkLava(){

    if(
        !player.alive ||
        player.invulnerable > 0
    )
        return;

    const playerLeft =
        player.x + 3;

    const playerRight =
        player.x +
        player.width -
        3;

    const playerBottom =
        player.y +
        player.height;


    for(
        const event
        of lavaEvents
    ){

        const age =
            gameElapsed -
            event.time;

        if(age < 0)
            continue;

        if(
            age >
            event.duration
        )
            continue;


        const lava =
            getLavaPosition(
                event
            );


        const lavaTop =
            lava.y -
            event.height;


        /*
         * The lava only hurts the player
         * while it is near the player's feet.
         */
        const lavaNearPlayer =
            lava.y >
            470 &&
            lava.y <
            610;


        if(!lavaNearPlayer)
            continue;


        const horizontalHit =
            playerRight >
                lava.left &&
            playerLeft <
                lava.right;


        /*
         * MAIN JUMP CHECK.
         *
         * If player's feet are above
         * the top of the lava,
         * the jump succeeds.
         */
        const standingInLava =
            playerBottom >
            lavaTop + 3;


        if(
            horizontalHit &&
            standingInLava
        ){

            hitPlayer(
                "You hit the lava!"
            );

            return;

        }

    }

}


// ============================================================
// PLAYER HIT
// ============================================================

async function hitPlayer(reason){

    if(
        !player.alive ||
        player.invulnerable > 0
    )
        return;

    player.lastHit =
        Date.now();

    player.lives--;

    player.invulnerable =
        1.7;

    createExplosionParticles(
        player.x +
        player.width / 2,

        player.y +
        player.height / 2
    );

    if(player.lives <= 0){

        eliminatePlayer(reason);

        return;

    }

    player.x =
        ROAD_WIDTH / 2 -
        PLAYER_WIDTH / 2;

    player.y =
        PLAYER_GROUND_Y -
        PLAYER_HEIGHT;

    player.vy = 0;

    player.grounded = true;

    player.jumping = false;

    showGameMessage(
        "🔥",
        "LAVA HIT!",
        `${reason} ${player.lives} life${
            player.lives === 1
                ? ""
                : "s"
        } remaining.`,
        1000
    );

    await sendPlayerState(true);

}


// ============================================================
// ELIMINATE PLAYER
// ============================================================

async function eliminatePlayer(reason){

    if(!player.alive)
        return;

    player.alive = false;
    player.ready = false;

    player.eliminationReason =
        reason;

    player.vx = 0;
    player.vy = 0;

    await sendPlayerState(true);

    showGameMessage(
        "💀",
        "ELIMINATED!",
        reason,
        0
    );

    checkLastPlayerStanding();

}


// ============================================================
// LAST PLAYER STANDING
// ============================================================

function checkLastPlayerStanding(){

    if(
        !gameStarted ||
        gameFinished
    )
        return;

    const allPlayers =
        [...players.values()];

    if(
        allPlayers.length <
        MIN_PLAYERS
    )
        return;

    const alivePlayers =
        allPlayers.filter(
            p =>
                p.alive === true
        );

    if(
        alivePlayers.length === 1
    ){

        const winner =
            alivePlayers[0];

        if(
            winner.uid ===
            currentUser?.uid
        ){

            finishGame(
                "last-player-standing"
            );

        }else{

            finishGame(
                "another-player-won"
            );

        }

    }

    if(
        alivePlayers.length === 0
    ){

        finishGame(
            "everyone-eliminated"
        );

    }

}


// ============================================================
// WORLD
// ============================================================

function updateWorld(delta){

    roadScroll +=
        (
            120 +
            gameElapsed * 1.8
        ) *
        delta;

    if(roadScroll > 80)
        roadScroll = 0;

}


// ============================================================
// SCORE
// ============================================================

function updateScore(delta){

    if(!player.alive)
        return;

    player.distance +=
        delta *
        (
            8 +
            gameElapsed * .035
        );

    player.score =
        Math.floor(
            player.distance
        );

    if(
        player.score >
        lastScoreUpdate
    ){

        lastScoreUpdate =
            player.score;

    }

}


// ============================================================
// HUD
// ============================================================

function updateHUD(){

    if(scoreValue){

        scoreValue.textContent =
            Math.floor(
                player.score
            );

    }

    const aliveCount =
        [...players.values()]
            .filter(
                p =>
                    p.alive
            ).length;

    if(aliveValue)
        aliveValue.textContent =
            aliveCount;

    const remaining =
        Math.max(
            0,
            GAME_DURATION -
            gameElapsed
        );

    const minutes =
        Math.floor(
            remaining / 60
        );

    const seconds =
        Math.floor(
            remaining % 60
        );

    if(timeValue){

        timeValue.textContent =
            `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;

    }

    if(livesValue){

        livesValue.textContent =
            "❤️".repeat(
                Math.max(
                    0,
                    player.lives
                )
            ) ||
            "💀";

    }

}


// ============================================================
// NETWORK PLAYER STATE
// ============================================================

async function updateGameStateNetwork(){

    if(
        !currentPlayerRef ||
        !currentUser ||
        gameFinished
    )
        return;

    const now =
        performance.now();

    if(
        now -
        lastStateSend <
        STATE_SEND_INTERVAL
    )
        return;

    lastStateSend =
        now;

    try{

        await updateDoc(
            currentPlayerRef,
            {

                x:
                    Math.round(
                        player.x
                    ),

                y:
                    Math.round(
                        player.y
                    ),

                alive:
                    player.alive,

                ready:
                    player.ready,

                lives:
                    player.lives,

                score:
                    Math.floor(
                        player.score
                    ),

                displayName:
                    player.fullName,

                fullName:
                    player.fullName,

                updatedAt:
                    serverTimestamp()

            }
        );

    }catch(error){

        console.warn(
            "State update failed:",
            error
        );

    }

}


async function sendPlayerState(
    force = false
){

    if(
        !currentPlayerRef ||
        !currentUser
    )
        return;

    if(
        !force &&
        performance.now() -
        lastStateSend <
        STATE_SEND_INTERVAL
    )
        return;

    lastStateSend =
        performance.now();

    try{

        await updateDoc(
            currentPlayerRef,
            {

                x:
                    Math.round(
                        player.x
                    ),

                y:
                    Math.round(
                        player.y
                    ),

                alive:
                    player.alive,

                ready:
                    player.ready,

                lives:
                    player.lives,

                score:
                    Math.floor(
                        player.score
                    ),

                displayName:
                    player.fullName,

                fullName:
                    player.fullName,

                updatedAt:
                    serverTimestamp()

            }
        );

    }catch(error){

        console.warn(
            "Could not send player state:",
            error
        );

    }

}


// ============================================================
// PLAYERS LIST
// ============================================================

function renderPlayersList(){

    if(!playersList)
        return;

    if(players.size === 0){

        playersList.innerHTML = `
            <div class="playerRow">
                <div class="playerAvatar">?</div>
                <div class="playerDetails">
                    <div class="playerName">
                        Waiting for players...
                    </div>
                    <div class="playerUsername">
                        Join the room to play
                    </div>
                </div>
            </div>
        `;

        return;

    }

    playersList.innerHTML =
        [...players.values()]
            .map(
                p => {

                    const isYou =
                        p.uid ===
                        currentUser?.uid;

                    const fullName =
                        p.fullName ||
                        p.displayName ||
                        "Player";

                    return `
                        <div class="playerRow">

                            <div
                                class="playerAvatar"
                                style="border-color:${
                                    p.color ||
                                    "#54d8ff"
                                }"
                            >
                                ${
                                    isYou
                                        ? "⭐"
                                        : "🏃"
                                }
                            </div>

                            <div class="playerDetails">

                                <div class="playerName">
                                    ${escapeHtml(
                                        fullName
                                    )}
                                    ${
                                        isYou
                                            ? " (You)"
                                            : ""
                                    }
                                </div>

                                <div class="playerUsername">
                                    Player
                                </div>

                            </div>

                            <div class="readyBadge ${
                                p.ready
                                    ? "ready"
                                    : "notReady"
                            }">

                                ${
                                    p.ready
                                        ? "READY ✓"
                                        : "NOT READY"
                                }

                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


// ============================================================
// LEADERBOARD
// ============================================================

function renderLeaderboard(){

    if(!leaderboardRows)
        return;

    const sorted =
        [...players.values()]
            .sort(
                (a,b) => {

                    if(
                        a.alive !==
                        b.alive
                    ){

                        return a.alive
                            ? -1
                            : 1;

                    }

                    return (
                        Number(
                            b.score || 0
                        ) -
                        Number(
                            a.score || 0
                        )
                    );

                }
            );

    if(sorted.length === 0){

        leaderboardRows.textContent =
            "Waiting...";

        return;

    }

    leaderboardRows.innerHTML =
        sorted
            .map(
                (p,index) => {

                    const isYou =
                        p.uid ===
                        currentUser?.uid;

                    const fullName =
                        p.fullName ||
                        p.displayName ||
                        "Player";

                    return `
                        <div class="leaderRow">

                            <div class="rank">
                                ${index + 1}
                            </div>

                            <div class="leaderName">

                                ${
                                    isYou
                                        ? "⭐ "
                                        : ""
                                }

                                ${escapeHtml(
                                    fullName
                                )}

                                ${
                                    p.alive
                                        ? ""
                                        : " 💀"
                                }

                            </div>

                            <div class="leaderScore">
                                ${Math.floor(
                                    Number(
                                        p.score || 0
                                    )
                                )}
                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


// ============================================================
// GAME MESSAGE
// ============================================================

let gameMessageTimer = null;

function showGameMessage(
    icon,
    title,
    text,
    duration = 1500
){

    if(messageIcon)
        messageIcon.textContent =
            icon;

    if(messageTitle)
        messageTitle.textContent =
            title;

    if(messageText)
        messageText.textContent =
            text;

    if(gameMessage)
        gameMessage.style.display =
            "block";

    if(gameMessageTimer){

        clearTimeout(
            gameMessageTimer
        );

    }

    if(duration > 0){

        gameMessageTimer =
            setTimeout(
                () => {

                    if(
                        gameFinished ||
                        player.alive
                    ){

                        if(gameMessage)
                            gameMessage.style.display =
                                "none";

                    }

                },
                duration
            );

    }

}


// ============================================================
// FINISH GAME
// ============================================================

async function finishGame(reason){

    if(gameFinished)
        return;

    gameFinished = true;

    if(animationFrame){

        cancelAnimationFrame(
            animationFrame
        );

        animationFrame = null;

    }

    if(countdownTimer){

        clearInterval(
            countdownTimer
        );

        countdownTimer = null;

    }

    await sendPlayerState(true);

    const allPlayers =
        [...players.values()];

    const ranked =
        allPlayers.sort(
            (a,b) => {

                if(
                    a.alive !==
                    b.alive
                ){

                    return a.alive
                        ? -1
                        : 1;

                }

                return (
                    Number(
                        b.score || 0
                    ) -
                    Number(
                        a.score || 0
                    )
                );

            }
        );

    let winner =
        ranked[0] ||
        null;

    if(
        reason ===
        "last-player-standing"
    ){

        winner =
            ranked.find(
                p =>
                    p.uid ===
                    currentUser?.uid
            ) ||
            winner;

    }

    if(
        reason ===
        "another-player-won"
    ){

        winner =
            ranked.find(
                p =>
                    p.alive
            ) ||
            winner;

    }

    showWinnerScreen(
        winner,
        ranked
    );

    await recordLocalResult(
        winner,
        ranked
    );

    if(
        isHost &&
        roomId
    ){

        try{

            await updateDoc(
                doc(
                    db,
                    "gameRooms",
                    roomId
                ),
                {

                    status:
                        "finished",

                    winnerUid:
                        winner?.uid ||
                        null

                }
            );

        }catch(error){

            console.warn(
                "Could not finish room:",
                error
            );

        }

    }

}


// ============================================================
// RECORD RESULT
// ============================================================

async function recordLocalResult(
    winner,
    ranked
){

    if(resultRecorded)
        return;

    resultRecorded = true;

    const myUid =
        currentUser?.uid;

    if(!myUid)
        return;

    const didWin =
        winner &&
        winner.uid ===
        myUid;

    const result =
        didWin
            ? "win"
            : "loss";

    const reward =
        didWin
            ? 100
            : Math.max(
                10,
                Math.floor(
                    player.score /
                    10
                )
            );

    try{

        await recordGameResult(
            GAME_ID,
            result,
            Math.floor(
                player.score
            ),
            reward
        );

    }catch(error){

        console.warn(
            "Game result could not be saved:",
            error
        );

    }

}


// ============================================================
// WINNER SCREEN
// ============================================================

function showWinnerScreen(
    winner,
    ranked
){

    if(!winnerOverlay)
        return;

    const meWon =
        winner &&
        winner.uid ===
        currentUser?.uid;

    if(winnerTitle){

        winnerTitle.textContent =
            meWon
                ? "🏆 YOU ARE THE LAST PLAYER!"
                : "👑 LAST PLAYER STANDING!";

    }

    if(winnerName){

        winnerName.textContent =
            winner
                ? (
                    winner.uid ===
                    currentUser?.uid
                        ? player.fullName
                        : winner.fullName ||
                          winner.displayName ||
                          "Winner"
                )
                : "No Winner";

    }

    if(winnerScore){

        winnerScore.textContent =
            winner
                ? `Score: ${Math.floor(
                    Number(
                        winner.score || 0
                    )
                )}`
                : "Score: 0";

    }

    if(resultLeaderboard){

        resultLeaderboard.innerHTML =
            ranked
                .map(
                    (p,index) => {

                        const isMe =
                            p.uid ===
                            currentUser?.uid;

                        const fullName =
                            p.fullName ||
                            p.displayName ||
                            "Player";

                        return `
                            <div class="resultRow">

                                <div class="resultRank">
                                    #${index + 1}
                                </div>

                                <div class="resultPlayer">

                                    ${
                                        isMe
                                            ? "⭐ "
                                            : ""
                                    }

                                    ${escapeHtml(
                                        fullName
                                    )}

                                    ${
                                        p.alive
                                            ? " 🏆"
                                            : " 💀"
                                    }

                                </div>

                                <div class="resultScore">
                                    ${Math.floor(
                                        Number(
                                            p.score || 0
                                        )
                                    )}
                                </div>

                            </div>
                        `;

                    }
                )
                .join("");

    }

    winnerOverlay.style.display =
        "flex";

}


// ============================================================
// CHAT UI
// ============================================================

function createChat(){

    if(!roomId)
        return;

    if(chatPanel){

        chatPanel.remove();

        chatPanel = null;

    }

    chatToggleButton =
        document.createElement(
            "button"
        );

    chatToggleButton.id =
        "volcanoChatToggle";

    chatToggleButton.innerHTML =
        "💬";

    Object.assign(
        chatToggleButton.style,
        {

            position: "fixed",
            right: "18px",
            bottom: "105px",

            width: "52px",
            height: "52px",

            borderRadius: "50%",

            border:
                "1px solid rgba(84,216,255,.6)",

            background:
                "linear-gradient(135deg,#101d4a,#26104f)",

            color: "#fff",

            fontSize: "22px",

            zIndex: "9998",

            boxShadow:
                "0 8px 30px rgba(0,0,0,.45)",

            cursor: "pointer"

        }
    );

    document.body.appendChild(
        chatToggleButton
    );

    chatPanel =
        document.createElement(
            "div"
        );

    chatPanel.id =
        "volcanoChatPanel";

    Object.assign(
        chatPanel.style,
        {

            position: "fixed",

            right: "15px",
            bottom: "165px",

            width:
                "min(340px,calc(100vw - 30px))",

            height: "390px",

            display: "none",

            flexDirection: "column",

            background:
                "rgba(5,9,20,.96)",

            border:
                "1px solid rgba(84,216,255,.45)",

            borderRadius: "18px",

            overflow: "hidden",

            zIndex: "9997",

            boxShadow:
                "0 20px 60px rgba(0,0,0,.6)",

            backdropFilter:
                "blur(18px)"

        }
    );

    const header =
        document.createElement(
            "div"
        );

    Object.assign(
        header.style,
        {

            padding: "13px 15px",

            display: "flex",

            justifyContent:
                "space-between",

            alignItems: "center",

            color: "#fff",

            fontWeight: "800",

            background:
                "linear-gradient(135deg,#111d48,#251044)"

        }
    );

    header.innerHTML =
        `
            <span>💬 Volcano Chat</span>

            <button
                id="volcanoChatClose"
                style="
                    border:0;
                    background:transparent;
                    color:white;
                    font-size:20px;
                    cursor:pointer;
                "
            >
                ×
            </button>
        `;

    chatPanel.appendChild(
        header
    );

    chatMessages =
        document.createElement(
            "div"
        );

    Object.assign(
        chatMessages.style,
        {

            flex: "1",

            overflowY: "auto",

            padding: "12px",

            display: "flex",

            flexDirection: "column",

            gap: "8px"

        }
    );

    chatPanel.appendChild(
        chatMessages
    );

    const composer =
        document.createElement(
            "div"
        );

    Object.assign(
        composer.style,
        {

            display: "flex",

            gap: "7px",

            padding: "10px",

            borderTop:
                "1px solid rgba(255,255,255,.08)"

        }
    );

    chatInput =
        document.createElement(
            "input"
        );

    chatInput.placeholder =
        "Type a message...";

    chatInput.maxLength =
        120;

    Object.assign(
        chatInput.style,
        {

            flex: "1",

            minWidth: "0",

            padding: "11px",

            borderRadius: "12px",

            border:
                "1px solid rgba(255,255,255,.12)",

            outline: "none",

            background: "#10182d",

            color: "#fff"

        }
    );

    chatSendButton =
        document.createElement(
            "button"
        );

    chatSendButton.textContent =
        "➤";

    Object.assign(
        chatSendButton.style,
        {

            width: "45px",

            border: "0",

            borderRadius: "12px",

            background: "#54d8ff",

            color: "#06101d",

            fontWeight: "900",

            cursor: "pointer"

        }
    );

    composer.appendChild(
        chatInput
    );

    composer.appendChild(
        chatSendButton
    );

    chatPanel.appendChild(
        composer
    );

    document.body.appendChild(
        chatPanel
    );

    chatToggleButton.addEventListener(
        "click",
        () => {

            const open =
                chatPanel.style.display ===
                "flex";

            chatPanel.style.display =
                open
                    ? "none"
                    : "flex";

            if(!open){

                chatUnread = 0;

                updateChatButton();

                setTimeout(
                    () => {

                        chatMessages.scrollTop =
                            chatMessages.scrollHeight;

                    },
                    50
                );

            }

        }
    );

    document
        .getElementById(
            "volcanoChatClose"
        )
        ?.addEventListener(
            "click",
            () => {

                chatPanel.style.display =
                    "none";

            }
        );

    chatSendButton.addEventListener(
        "click",
        sendChatMessage
    );

    chatInput.addEventListener(
        "keydown",
        event => {

            if(event.key === "Enter"){

                event.preventDefault();

                sendChatMessage();

            }

        }
    );

    subscribeToChat();

}


// ============================================================
// CHAT SUBSCRIPTION
// ============================================================

function subscribeToChat(){

    if(chatUnsubscribe)
        chatUnsubscribe();

    if(!roomId)
        return;

    const messagesRef =
        collection(
            db,
            "gameRooms",
            roomId,
            "messages"
        );

    const messagesQuery =
        query(
            messagesRef,
            limit(100)
        );

    chatUnsubscribe =
        onSnapshot(
            messagesQuery,
            snapshot => {

                const messages =
                    snapshot.docs
                        .map(
                            d => ({
                                id:
                                    d.id,

                                ...d.data()
                            })
                        )
                        .sort(
                            (a,b) => {

                                const aTime =
                                    a.createdAt?.seconds ||
                                    0;

                                const bTime =
                                    b.createdAt?.seconds ||
                                    0;

                                return (
                                    aTime -
                                    bTime
                                );

                            }
                        );

                renderChatMessages(
                    messages
                );

            },
            error => {

                console.error(
                    "Chat listener:",
                    error
                );

            }
        );

}


// ============================================================
// SEND CHAT MESSAGE
// ============================================================

async function sendChatMessage(){

    if(
        !currentUser ||
        !roomId ||
        !chatInput
    )
        return;

    const text =
        chatInput.value
            .trim()
            .slice(0,120);

    if(!text)
        return;

    chatInput.value = "";

    try{

        await addDoc(
            collection(
                db,
                "gameRooms",
                roomId,
                "messages"
            ),
            {

                uid:
                    currentUser.uid,

                fullName:
                    player.fullName,

                displayName:
                    player.fullName,

                text,

                createdAt:
                    serverTimestamp()

            }
        );

    }catch(error){

        console.error(
            "Chat send error:",
            error
        );

    }

}


// ============================================================
// RENDER CHAT
// ============================================================

function renderChatMessages(
    messages
){

    if(!chatMessages)
        return;

    const wasAtBottom =
        chatMessages.scrollHeight -
        chatMessages.scrollTop -
        chatMessages.clientHeight <
        60;

    chatMessages.innerHTML =
        "";

    messages.forEach(
        message => {

            const mine =
                message.uid ===
                currentUser?.uid;

            const row =
                document.createElement(
                    "div"
                );

            Object.assign(
                row.style,
                {

                    alignSelf:
                        mine
                            ? "flex-end"
                            : "flex-start",

                    maxWidth:
                        "85%",

                    padding:
                        "8px 11px",

                    borderRadius:
                        mine
                            ? "14px 14px 3px 14px"
                            : "14px 14px 14px 3px",

                    background:
                        mine
                            ? "linear-gradient(135deg,#155d7a,#43318a)"
                            : "#151d32",

                    color:
                        "#fff",

                    wordBreak:
                        "break-word"

                }
            );

            const fullName =
                message.fullName ||
                message.displayName ||
                "Player";

            row.innerHTML =
                `
                    <div
                        style="
                            font-size:10px;
                            opacity:.65;
                            margin-bottom:3px;
                            font-weight:700;
                        "
                    >
                        ${escapeHtml(
                            fullName
                        )}
                    </div>

                    <div
                        style="
                            font-size:13px;
                            line-height:1.35;
                        "
                    >
                        ${escapeHtml(
                            message.text ||
                            ""
                        )}
                    </div>
                `;

            chatMessages.appendChild(
                row
            );

        }
    );

    const panelOpen =
        chatPanel?.style.display ===
        "flex";

    if(!panelOpen){

        chatUnread++;

        updateChatButton();

    }else if(wasAtBottom){

        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    }else{

        chatMessages.scrollTop =
            chatMessages.scrollHeight;

    }

}


// ============================================================
// CHAT BADGE
// ============================================================

function updateChatButton(){

    if(!chatToggleButton)
        return;

    chatToggleButton.style.position =
        "fixed";

    chatToggleButton.innerHTML =
        chatUnread > 0
            ? `💬<span style="
                    position:absolute;
                    transform:translate(10px,-25px);
                    background:#ff4d91;
                    color:white;
                    min-width:18px;
                    height:18px;
                    border-radius:9px;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    font-size:10px;
                    font-weight:900;
                ">${Math.min(
                    chatUnread,
                    99
                )}</span>`
            : "💬";

}


// ============================================================
// WINNER / RETURN
// ============================================================

if(returnLobbyButton){

    returnLobbyButton.addEventListener(
        "click",
        async () => {

            if(winnerOverlay)
                winnerOverlay.style.display =
                    "none";

            await leaveRoom();

        }
    );

}


// ============================================================
// LEAVE BUTTON
// ============================================================

if(leaveButton){

    leaveButton.addEventListener(
        "click",
        async () => {

            await leaveRoom();

        }
    );

}


// ============================================================
// LEAVE ROOM
// ============================================================

async function leaveRoom(){

    gameFinished = true;
    gameStarted = false;

    if(animationFrame){

        cancelAnimationFrame(
            animationFrame
        );

        animationFrame = null;

    }

    if(countdownTimer){

        clearInterval(
            countdownTimer
        );

        countdownTimer = null;

    }

    if(playersUnsubscribe){

        playersUnsubscribe();

        playersUnsubscribe =
            null;

    }

    if(roomUnsubscribe){

        roomUnsubscribe();

        roomUnsubscribe =
            null;

    }

    if(chatUnsubscribe){

        chatUnsubscribe();

        chatUnsubscribe =
            null;

    }

    if(chatPanel){

        chatPanel.remove();

        chatPanel = null;

    }

    if(chatToggleButton){

        chatToggleButton.remove();

        chatToggleButton = null;

    }

    if(currentPlayerRef){

        try{

            await deleteDoc(
                currentPlayerRef
            );

        }catch(error){

            console.warn(
                "Player removal failed:",
                error
            );

        }

    }

    if(
        isHost &&
        roomId &&
        roomData &&
        roomData.status ===
        "waiting"
    ){

        try{

            await updateDoc(
                doc(
                    db,
                    "gameRooms",
                    roomId
                ),
                {

                    status:
                        "finished"

                }
            );

        }catch(error){

            console.warn(
                "Room close failed:",
                error
            );

        }

    }

    leaveRoomLocal();

}


// ============================================================
// RESET LOCAL ROOM
// ============================================================

function leaveRoomLocal(){

    roomId = null;
    roomData = null;

    currentPlayerRef = null;

    isHost = false;

    players.clear();

    lavaEvents = [];
    particles = [];

    player.ready = false;
    player.alive = true;

    player.lives = 3;
    player.score = 0;
    player.distance = 0;

    player.fullName =
        getUserName(
            currentUser
        );

    winnerOverlay?.style &&
        (winnerOverlay.style.display =
            "none");

    if(gameMessage)
        gameMessage.style.display =
            "none";

    if(gameArea)
        gameArea.style.display =
            "none";

    if(lobby)
        lobby.style.display =
            "block";

    if(roomCodeEl)
        roomCodeEl.textContent =
            "------";

    if(gameRoomCodeEl)
        gameRoomCodeEl.textContent =
            "------";

    if(playerCountEl)
        playerCountEl.textContent =
            "Players: 0/4";

    if(readyButton){

        readyButton.textContent =
            "🔥 READY";

        readyButton.classList.remove(
            "readyOn"
        );

    }

    setLobbyStatus(
        "Create or join a room to begin."
    );

    renderPlayersList();

}


// ============================================================
// DRAW SCENE
// ============================================================

function drawScene(){

    if(!ctx)
        return;

    ctx.clearRect(
        0,
        0,
        ROAD_WIDTH,
        ROAD_HEIGHT
    );

    drawSky();
    drawMountains();
    drawLavaBackground();
    drawRoad();

    // ONLY LAVA.
    drawLavaEvents();

    drawOtherPlayers();
    drawLocalPlayer();

    drawParticles();
    drawSpeedLines();

}


// ============================================================
// SKY
// ============================================================

function drawSky(){

    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            ROAD_HEIGHT
        );

    gradient.addColorStop(
        0,
        "#100022"
    );

    gradient.addColorStop(
        .45,
        "#28001f"
    );

    gradient.addColorStop(
        1,
        "#100006"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        ROAD_WIDTH,
        ROAD_HEIGHT
    );

    for(
        let i = 0;
        i < 55;
        i++
    ){

        const x =
            (
                i * 83 +
                roomSeed * 13
            ) %
            ROAD_WIDTH;

        const y =
            (
                i * 47 +
                roomSeed * 7
            ) %
            260;

        const alpha =
            .25 +
            (
                Math.sin(
                    gameElapsed * 2 +
                    i
                ) + 1
            ) * .15;

        ctx.fillStyle =
            `rgba(255,220,170,${alpha})`;

        ctx.fillRect(
            x,
            y,
            2,
            2
        );

    }

}


// ============================================================
// MOUNTAINS
// ============================================================

function drawMountains(){

    ctx.fillStyle =
        "#1a0928";

    ctx.beginPath();

    ctx.moveTo(
        0,
        360
    );

    ctx.lineTo(
        55,
        250
    );

    ctx.lineTo(
        100,
        320
    );

    ctx.lineTo(
        155,
        190
    );

    ctx.lineTo(
        210,
        315
    );

    ctx.lineTo(
        275,
        215
    );

    ctx.lineTo(
        330,
        300
    );

    ctx.lineTo(
        390,
        230
    );

    ctx.lineTo(
        390,
        500
    );

    ctx.lineTo(
        0,
        500
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "#220d22";

    ctx.beginPath();

    ctx.moveTo(
        130,
        350
    );

    ctx.lineTo(
        165,
        190
    );

    ctx.lineTo(
        195,
        135
    );

    ctx.lineTo(
        225,
        190
    );

    ctx.lineTo(
        270,
        350
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
        "rgba(255,70,0,.35)";

    ctx.beginPath();

    ctx.arc(
        195,
        150,
        24 +
        Math.sin(
            gameElapsed * 3
        ) * 3,
        0,
        Math.PI * 2
    );

    ctx.fill();

}


// ============================================================
// BACKGROUND LAVA
// ============================================================

function drawLavaBackground(){

    const lavaGradient =
        ctx.createLinearGradient(
            0,
            300,
            0,
            570
        );

    lavaGradient.addColorStop(
        0,
        "#ff4a00"
    );

    lavaGradient.addColorStop(
        .5,
        "#ff1f00"
    );

    lavaGradient.addColorStop(
        1,
        "#7c0900"
    );

    ctx.fillStyle =
        lavaGradient;

    ctx.beginPath();

    ctx.moveTo(
        0,
        490
    );

    for(
        let x = 0;
        x <= ROAD_WIDTH;
        x += 12
    ){

        const y =
            500 +
            Math.sin(
                x * .045 +
                gameElapsed * 2
            ) * 8;

        ctx.lineTo(
            x,
            y
        );

    }

    ctx.lineTo(
        ROAD_WIDTH,
        ROAD_HEIGHT
    );

    ctx.lineTo(
        0,
        ROAD_HEIGHT
    );

    ctx.closePath();

    ctx.fill();

}


// ============================================================
// ROAD
// ============================================================

function drawRoad(){

    ctx.fillStyle =
        "#42120c";

    ctx.fillRect(
        38,
        315,
        314,
        385
    );

    const roadGradient =
        ctx.createLinearGradient(
            0,
            300,
            0,
            700
        );

    roadGradient.addColorStop(
        0,
        "#313039"
    );

    roadGradient.addColorStop(
        1,
        "#101016"
    );

    ctx.fillStyle =
        roadGradient;

    ctx.beginPath();

    ctx.moveTo(
        125,
        300
    );

    ctx.lineTo(
        265,
        300
    );

    ctx.lineTo(
        352,
        700
    );

    ctx.lineTo(
        38,
        700
    );

    ctx.closePath();

    ctx.fill();

    ctx.strokeStyle =
        "#ff7028";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
        125,
        300
    );

    ctx.lineTo(
        38,
        700
    );

    ctx.moveTo(
        265,
        300
    );

    ctx.lineTo(
        352,
        700
    );

    ctx.stroke();

    ctx.strokeStyle =
        "rgba(255,255,255,.55)";

    ctx.lineWidth = 4;

    ctx.setLineDash([
        28,
        25
    ]);

    const offset =
        roadScroll % 53;

    ctx.beginPath();

    ctx.moveTo(
        195,
        290 + offset
    );

    ctx.lineTo(
        195,
        700
    );

    ctx.stroke();

    ctx.setLineDash([]);

}


// ============================================================
// LAVA DRAWING
// ============================================================

function drawLavaEvents(){

    for(
        const event
        of lavaEvents
    ){

        const age =
            gameElapsed -
            event.time;

        if(
            age <
            -event.warning
        ){

            continue;

        }

        if(
            age >
            event.duration
        ){

            continue;

        }


        // -----------------------------
        // WARNING
        // -----------------------------

        if(age < 0){

            const pulse =
                .5 +
                Math.sin(
                    gameElapsed * 10
                ) * .25;

            ctx.fillStyle =
                `rgba(255,190,20,${pulse})`;

            ctx.fillRect(
                48,
                548,
                294,
                8
            );

            ctx.font =
                "bold 14px system-ui";

            ctx.textAlign =
                "center";

            ctx.fillStyle =
                "#ffe66b";

            ctx.fillText(
                "🔥 LAVA INCOMING — JUMP!",
                ROAD_WIDTH / 2,
                535
            );

            continue;

        }


        const lava =
            getLavaPosition(
                event
            );

        const lavaY =
            lava.y -
            event.height;

        const behindPlayer =
            lava.y >
            PLAYER_GROUND_Y;


        const gradient =
            ctx.createLinearGradient(
                lava.left,
                lavaY,
                lava.left,
                lava.y
            );

        gradient.addColorStop(
            0,
            "#ffe33b"
        );

        gradient.addColorStop(
            .25,
            "#ff9d00"
        );

        gradient.addColorStop(
            .65,
            "#ff4300"
        );

        gradient.addColorStop(
            1,
            "#b70900"
        );

        ctx.fillStyle =
            gradient;

        ctx.beginPath();

        const segments = 18;

        for(
            let i = 0;
            i <= segments;
            i++
        ){

            const t =
                i /
                segments;

            const x =
                lava.left +
                lava.width *
                t;

            const wave =
                Math.sin(
                    t * Math.PI * 8 +
                    gameElapsed * 12
                ) * 3;

            const top =
                lavaY +
                wave;

            if(i === 0){

                ctx.moveTo(
                    x,
                    top
                );

            }else{

                ctx.lineTo(
                    x,
                    top
                );

            }

        }

        ctx.lineTo(
            lava.right,
            lava.y
        );

        ctx.lineTo(
            lava.left,
            lava.y
        );

        ctx.closePath();

        ctx.fill();


        // Glow.

        ctx.fillStyle =
            behindPlayer
                ? "rgba(255,90,0,.12)"
                : "rgba(255,100,0,.22)";

        ctx.fillRect(
            lava.left - 6,
            lavaY - 5,
            lava.width + 12,
            6
        );


        // Bubbles.

        for(
            let i = 0;
            i < 7;
            i++
        ){

            const bx =
                lava.left +
                10 +
                (
                    i * 31
                ) %
                Math.max(
                    20,
                    lava.width - 15
                );

            const by =
                lavaY +
                7 +
                (
                    Math.sin(
                        gameElapsed * 5 +
                        i
                    ) + 1
                ) *
                6;

            ctx.fillStyle =
                "#ffd52d";

            ctx.beginPath();

            ctx.arc(
                bx,
                by,
                2.5,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }

    }

}


// ============================================================
// OTHER PLAYERS
// ============================================================

function drawOtherPlayers(){

    for(
        const other
        of players.values()
    ){

        if(
            other.uid ===
            currentUser?.uid
        )
            continue;

        if(
            other.alive === false
        )
            continue;

        const x =
            Number(
                other.x ??
                180
            );

        const y =
            Number(
                other.y ??
                528
            );

        const fullName =
            other.fullName ||
            other.displayName ||
            "Player";

        drawRunner(
            x,
            y,
            other.color ||
                "#54d8ff",
            fullName,
            false
        );

    }

}


// ============================================================
// LOCAL PLAYER
// ============================================================

function drawLocalPlayer(){

    if(!player.alive)
        return;

    if(
        player.invulnerable > 0 &&
        Math.floor(
            player.invulnerable * 12
        ) % 2 === 0
    ){

        return;

    }

    drawRunner(
        player.x,
        player.y,
        player.color,
        player.fullName ||
            getUserName(
                currentUser
            ),
        true
    );

}


// ============================================================
// RUNNER
// ============================================================

function drawRunner(
    x,
    y,
    color,
    name,
    local
){

    ctx.fillStyle =
        "rgba(0,0,0,.35)";

    ctx.beginPath();

    ctx.ellipse(
        x +
        PLAYER_WIDTH / 2,

        y +
        PLAYER_HEIGHT +
        5,

        17,
        5,

        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.font =
        local
            ? "bold 10px system-ui"
            : "bold 9px system-ui";

    ctx.textAlign =
        "center";

    const safeName =
        String(
            name ||
            "Player"
        );

    const textWidth =
        ctx.measureText(
            safeName
        ).width;

    const plateWidth =
        Math.min(
            textWidth + 10,
            350
        );

    ctx.fillStyle =
        "rgba(4,8,20,.90)";

    ctx.beginPath();

    ctx.roundRect(
        x +
        PLAYER_WIDTH / 2 -
        plateWidth / 2,

        y - 22,

        plateWidth,

        16,

        7
    );

    ctx.fill();

    ctx.fillStyle =
        "#ffffff";

    ctx.fillText(
        safeName,
        x +
        PLAYER_WIDTH / 2,
        y - 10
    );

    ctx.fillStyle =
        color;

    ctx.beginPath();

    ctx.roundRect(
        x + 5,
        y + 15,
        18,
        23,
        7
    );

    ctx.fill();

    ctx.fillStyle =
        "#f4f6ff";

    ctx.beginPath();

    ctx.arc(
        x + 14,
        y + 12,
        11,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
        "#14203b";

    ctx.beginPath();

    ctx.roundRect(
        x + 5,
        y + 7,
        18,
        9,
        5
    );

    ctx.fill();

    ctx.strokeStyle =
        "#171522";

    ctx.lineWidth = 5;

    ctx.lineCap =
        "round";

    const running =
        Math.sin(
            gameElapsed * 12 +
            x
        ) * 5;

    ctx.beginPath();

    ctx.moveTo(
        x + 10,
        y + 36
    );

    ctx.lineTo(
        x + 7 -
        running,
        y + 43
    );

    ctx.moveTo(
        x + 19,
        y + 36
    );

    ctx.lineTo(
        x + 22 +
        running,
        y + 43
    );

    ctx.stroke();

    ctx.lineCap =
        "butt";

}


// ============================================================
// PARTICLES
// ============================================================

function createJumpParticles(){

    for(let i = 0; i < 8; i++){

        particles.push({

            x:
                player.x +
                player.width / 2,

            y:
                player.y +
                player.height,

            vx:
                (
                    Math.random() -
                    .5
                ) * 80,

            vy:
                Math.random() *
                60,

            life:
                .5 +
                Math.random() *
                .4,

            maxLife:
                .8,

            size:
                2 +
                Math.random() * 3,

            type:
                "dust"

        });

    }

}


function createExplosionParticles(
    x,
    y
){

    for(let i = 0; i < 24; i++){

        particles.push({

            x,

            y,

            vx:
                (
                    Math.random() -
                    .5
                ) * 250,

            vy:
                (
                    Math.random() -
                    .5
                ) * 250,

            life:
                .5 +
                Math.random() *
                .8,

            maxLife:
                1.2,

            size:
                3 +
                Math.random() * 5,

            type:
                "fire"

        });

    }

}


function updateParticles(delta){

    for(
        let i =
        particles.length - 1;
        i >= 0;
        i--
    ){

        const particle =
            particles[i];

        particle.life -=
            delta;

        particle.x +=
            particle.vx *
            delta;

        particle.y +=
            particle.vy *
            delta;

        particle.vy +=
            200 *
            delta;

        if(
            particle.life <= 0
        ){

            particles.splice(
                i,
                1
            );

        }

    }

}


function drawParticles(){

    for(
        const particle
        of particles
    ){

        const alpha =
            Math.max(
                0,
                particle.life /
                particle.maxLife
            );

        ctx.globalAlpha =
            alpha;

        ctx.fillStyle =
            particle.type ===
            "fire"
                ? "#ff7625"
                : "#b7a49a";

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }

    ctx.globalAlpha =
        1;

}


// ============================================================
// SPEED LINES
// ============================================================

function drawSpeedLines(){

    if(
        !gameStarted ||
        !player.alive
    )
        return;

    const intensity =
        Math.min(
            .28,
            gameElapsed /
            GAME_DURATION
        );

    ctx.strokeStyle =
        `rgba(255,255,255,${intensity})`;

    ctx.lineWidth = 1;

    for(let i = 0; i < 10; i++){

        const x =
            45 +
            i * 47;

        const y =
            310 +
            (
                i * 61 +
                roadScroll
            ) %
            330;

        ctx.beginPath();

        ctx.moveTo(
            x,
            y
        );

        ctx.lineTo(
            x,
            y + 18
        );

        ctx.stroke();

    }

}


// ============================================================
// ROOM INPUT
// ============================================================

if(roomInput){

    roomInput.addEventListener(
        "keydown",
        event => {

            if(event.key === "Enter"){

                joinRoomButton?.click();

            }

        }
    );

    roomInput.addEventListener(
        "input",
        () => {

            roomInput.value =
                roomInput.value
                    .toUpperCase()
                    .replace(
                        /[^A-Z0-9]/g,
                        ""
                    )
                    .slice(
                        0,
                        6
                    );

        }
    );

}


// ============================================================
// INITIAL CANVAS
// ============================================================

drawScene();


// ============================================================
// WAITING CHECK
// ============================================================

setInterval(
    () => {

        if(
            roomData &&
            roomData.status ===
            "waiting"
        ){

            updateWaitingState();

        }

    },
    500
);


// ============================================================
// PREVENT PAGE SCROLL
// ============================================================

[
    leftButton,
    rightButton,
    jumpButton
]
.filter(Boolean)
.forEach(
    button => {

        button.addEventListener(
            "touchstart",
            event => {

                event.preventDefault();

            },
            {
                passive:false
            }
        );

    }
);


// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
    "pagehide",
    () => {

        if(animationFrame){

            cancelAnimationFrame(
                animationFrame
            );

        }

        if(roomUnsubscribe)
            roomUnsubscribe();

        if(playersUnsubscribe)
            playersUnsubscribe();

        if(chatUnsubscribe)
            chatUnsubscribe();

    }
);


// ============================================================
// DONE
// ============================================================

console.log(
    "🌋 VitalStar Volcano Jump loaded — SIMPLE LAVA ONLY."
);