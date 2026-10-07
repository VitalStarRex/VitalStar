// ============================================================
// VITALSTAR — VOLCANO JUMP
// Multiplayer Last-Player-Standing Road Survival
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
const JUMP_FORCE = -510;

const GRAVITY = 1350;

const STATE_SEND_INTERVAL = 250;

const LAVA_WARNING_TIME = 1.15;

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
    canvas.getContext("2d");

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
// FIREBASE / AUTH STATE
// ============================================================

let currentUser = null;

let authResolved = false;

let authResolver;

const authReady = new Promise(resolve => {
    authResolver = resolve;
});


onAuthStateChanged(auth, user => {

    currentUser = user || null;

    authResolved = true;

    authResolver(currentUser);

    if (!currentUser) {

        setLobbyStatus(
            "Please log in to play Volcano Jump."
        );

        readyButton.disabled = true;

        quickMatchButton.disabled = true;

        createRoomButton.disabled = true;

        joinRoomButton.disabled = true;

        return;
    }


    readyButton.disabled = false;

    quickMatchButton.disabled = false;

    createRoomButton.disabled = false;

    joinRoomButton.disabled = false;

    setLobbyStatus(
        `Welcome ${getUserName(currentUser)}. Create or join a room.`
    );

});


// ============================================================
// ROOM STATE
// ============================================================

let roomId = null;

let roomData = null;

let isHost = false;

let roomUnsubscribe = null;

let playersUnsubscribe = null;

let currentPlayerRef = null;


// ============================================================
// PLAYERS
// ============================================================

const players = new Map();


// ============================================================
// LOCAL PLAYER
// ============================================================

const player = {

    x: ROAD_WIDTH / 2,

    y: 560,

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

    lane: 1,

    invulnerable: 0,

    lastHit: 0,

    eliminationReason: "",

    color: COLORS[0]

};


// ============================================================
// GAME STATE
// ============================================================

let gameStarted = false;

let gameFinished = false;

let gameStartTime = 0;

let gameElapsed = 0;

let lastFrameTime = performance.now();

let animationFrame = null;

let countdownTimer = null;

let resultRecorded = false;

let lastStateSend = 0;

let lastScoreUpdate = 0;

let cameraOffset = 0;

let roadScroll = 0;

let obstacleSeed = 1;

let obstacles = [];

let lavaEvents = [];

let particles = [];

let keys = {

    left: false,

    right: false

};


// ============================================================
// ROOM STATUS
// ============================================================

function setLobbyStatus(text){

    if(lobbyStatus){

        lobbyStatus.textContent = text;

    }

}


// ============================================================
// USER NAME
// ============================================================

function getUserName(user){

    if(!user){
        return "Player";
    }

    return (
        user.displayName ||
        user.email?.split("@")[0] ||
        "Player"
    );

}


// ============================================================
// USERNAME
// ============================================================

function getUsername(user){

    if(!user){
        return "player";
    }

    const name =
        user.displayName ||
        user.email?.split("@")[0] ||
        "player";

    return name
        .replace(/\s+/g, "")
        .toLowerCase()
        .slice(0, 20);

}


// ============================================================
// PLAYER COLOR
// ============================================================

function getPlayerColor(uid){

    if(!uid){
        return COLORS[0];
    }

    let total = 0;

    for(let i = 0; i < uid.length; i++){

        total += uid.charCodeAt(i);

    }

    return COLORS[
        total % COLORS.length
    ];

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
                    Math.random() * chars.length
                )
            ];

    }

    return result;

}


// ============================================================
// QUICK MATCH
// ============================================================

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

            const roomsQuery = query(
                collection(db, "gameRooms"),
                where("game", "==", GAME_ID),
                limit(20)
            );

            const snapshot =
                await getDocs(roomsQuery);

            let selectedRoom = null;

            for(const roomDoc of snapshot.docs){

                const data =
                    roomDoc.data();

                if(data.status !== "waiting"){
                    continue;
                }

                if(data.playersCount >= MAX_PLAYERS){
                    continue;
                }

                selectedRoom = roomDoc;

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


// ============================================================
// CREATE ROOM
// ============================================================

createRoomButton.addEventListener(
    "click",
    async () => {

        await createRoom(false);

    }
);


async function createRoom(isQuickMatch = false){

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
                Math.random() * 2147483647
            );


        await setDoc(
            roomRef,
            {

                game: GAME_ID,

                roomCode,

                hostUid: currentUser.uid,

                status: "waiting",

                playersCount: 0,

                readyCount: 0,

                maxPlayers: MAX_PLAYERS,

                minPlayers: MIN_PLAYERS,

                seed,

                startAt: null,

                createdAt: serverTimestamp(),

                winnerUid: null

            }
        );


        await joinExistingRoom(
            roomRef.id,
            {
                roomCode,
                hostUid: currentUser.uid,
                status: "waiting",
                playersCount: 0,
                readyCount: 0,
                maxPlayers: MAX_PLAYERS,
                minPlayers: MIN_PLAYERS,
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

joinRoomButton.addEventListener(
    "click",
    async () => {

        const code =
            roomInput.value
                .trim()
                .toUpperCase();


        if(code.length !== 6){

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

            const roomsQuery = query(
                collection(db, "gameRooms"),
                where("roomCode", "==", code),
                limit(1)
            );

            const snapshot =
                await getDocs(roomsQuery);


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

            joinRoomButton.disabled = false;

        }

    }
);


// ============================================================
// JOIN EXISTING ROOM
// ============================================================

async function joinExistingRoom(
    targetRoomId,
    targetRoomData
){

    if(!currentUser){
        return;
    }


    if(targetRoomData.status !== "waiting"){

        setLobbyStatus(
            "This match has already started."
        );

        return;

    }


    roomId = targetRoomId;

    roomData = targetRoomData;

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


    currentPlayerRef = playerRef;


    const existingPlayers =
        await getDocs(
            collection(
                db,
                "gameRooms",
                roomId,
                "players"
            )
        );


    if(existingPlayers.size >= MAX_PLAYERS){

        setLobbyStatus(
            "This room is full."
        );

        roomId = null;

        currentPlayerRef = null;

        return;

    }


    const playerColor =
        getPlayerColor(
            currentUser.uid
        );


    player.color = playerColor;

    player.ready = false;

    player.alive = true;

    player.lives = 3;

    player.score = 0;


    await setDoc(
        playerRef,
        {

            uid: currentUser.uid,

            displayName:
                getUserName(currentUser),

            username:
                getUsername(currentUser),

            ready: false,

            alive: true,

            lives: 3,

            score: 0,

            x: player.x,

            y: player.y,

            color: playerColor,

            joinedAt: serverTimestamp(),

            updatedAt: serverTimestamp()

        }
    );


    showGameRoom();

    subscribeToRoom();

    subscribeToPlayers();

}


// ============================================================
// SHOW ROOM
// ============================================================

function showGameRoom(){

    lobby.style.display = "block";

    gameArea.style.display = "none";

    roomCodeEl.textContent =
        roomData?.roomCode || "------";

}


// ============================================================
// SUBSCRIBE ROOM
// ============================================================

function subscribeToRoom(){

    if(roomUnsubscribe){

        roomUnsubscribe();

    }


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


                roomCodeEl.textContent =
                    roomData.roomCode || "------";


                gameRoomCodeEl.textContent =
                    roomData.roomCode || "------";


                if(
                    roomData.status ===
                    "playing"
                ){

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
// SUBSCRIBE PLAYERS
// ============================================================

function subscribeToPlayers(){

    if(playersUnsubscribe){

        playersUnsubscribe();

    }


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

                        players.set(
                            playerDoc.id,
                            {
                                uid:
                                    playerDoc.id,

                                ...playerDoc.data()
                            }
                        );

                    }
                );


                const count =
                    players.size;


                playerCountEl.textContent =
                    `Players: ${count}/${MAX_PLAYERS}`;


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
                p => p.ready === true
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


    readyButton.disabled =
        count < 1;


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


    if(
        count >= MIN_PLAYERS &&
        readyCount === count &&
        !gameStarted &&
        !roomData.startAt
    ){

        if(isHost){

            startMatch();

        }

    }

}


// ============================================================
// READY BUTTON
// ============================================================

readyButton.addEventListener(
    "click",
    async () => {

        if(!currentPlayerRef){
            return;
        }


        if(!roomData){

            return;

        }


        if(
            roomData.status !==
            "waiting"
        ){

            return;

        }


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


// ============================================================
// HOST START MATCH
// ============================================================

async function startMatch(){

    if(!isHost){
        return;
    }


    if(!roomData){
        return;
    }


    if(
        roomData.status !==
        "waiting"
    ){

        return;

    }


    const playerArray =
        [...players.values()];


    if(
        playerArray.length <
        MIN_PLAYERS
    ){

        return;

    }


    const everyoneReady =
        playerArray.every(
            p => p.ready === true
        );


    if(!everyoneReady){
        return;
    }


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

                status: "playing",

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

    if(gameStarted){
        return;
    }


    countdownOverlay.classList.remove(
        "hidden"
    );


    waitingOverlay.style.display =
        "none";


    if(countdownTimer){

        clearInterval(
            countdownTimer
        );

    }


    function updateCountdown(){

        const remaining =
            startAt - Date.now();


        if(remaining <= 0){

            clearInterval(
                countdownTimer
            );

            countdownTimer = null;

            countdownOverlay.classList.add(
                "hidden"
            );

            beginGame();

            return;

        }


        const seconds =
            Math.ceil(
                remaining / 1000
            );


        countdownMessage.textContent =
            "ALL PLAYERS READY!";


        countdownNumber.textContent =
            seconds;


        if(seconds <= 1){

            countdownNumber.textContent =
                "GO!";

        }

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

    if(gameStarted){
        return;
    }


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

    player.y = 570;

    player.vx = 0;

    player.vy = 0;

    player.grounded = true;

    player.jumping = false;

    player.alive = true;

    player.lives = 3;

    player.score = 0;

    player.distance = 0;

    player.invulnerable = 1.5;

    obstacleSeed =
        Number(roomData?.seed || 1);


    generateObstacles();

    generateLavaEvents();


    lobby.style.display =
        "none";

    gameArea.style.display =
        "block";


    waitingOverlay.style.display =
        "none";


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
// GENERATE OBSTACLES
// ============================================================

function seededRandom(seed){

    let value =
        seed >>> 0;


    return function(){

        value += 0x6D2B79F5;

        let t = value;

        t =
            Math.imul(
                t ^ t >>> 15,
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ t >>> 7,
                t | 61
            );

        return (
            (
                (t ^ t >>> 14)
                >>> 0
            ) / 4294967296
        );

    };

}


function generateObstacles(){

    obstacles = [];


    const random =
        seededRandom(
            obstacleSeed + 900
        );


    let time = 4;


    while(
        time <
        GAME_DURATION - 3
    ){

        time +=
            2.0 +
            random() * 2.2;


        const type =
            random() < .55
                ? "rock"
                : "meteor";


        const lane =
            Math.floor(
                random() * 3
            );


        const laneX =
            82 +
            lane * 113;


        obstacles.push({

            id:
                `obstacle-${obstacles.length}`,

            type,

            time,

            lane,

            x:
                laneX,

            y:
                type === "meteor"
                    ? -80
                    : 535,

            width:
                type === "meteor"
                    ? 35
                    : 42,

            height:
                type === "meteor"
                    ? 35
                    : 36,

            speed:
                180 +
                random() * 130,

            direction:
                random() > .5
                    ? 1
                    : -1

        });

    }

}


// ============================================================
// GENERATE LAVA EVENTS
// ============================================================

function generateLavaEvents(){

    lavaEvents = [];


    const random =
        seededRandom(
            obstacleSeed + 5000
        );


    let time = 7;


    while(
        time <
        GAME_DURATION - 2
    ){

        time +=
            5 +
            random() * 4;


        lavaEvents.push({

            time,

            duration:
                2.7 +
                random() * 1.3,

            lane:
                Math.floor(
                    random() * 3
                ),

            direction:
                random() > .5
                    ? 1
                    : -1

        });

    }

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
            (now - lastFrameTime) / 1000,
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
            (Date.now() - gameStartTime) /
            1000
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

    if(!player.alive){
        return;
    }


    player.invulnerable =
        Math.max(
            0,
            player.invulnerable -
            delta
        );


    let direction = 0;


    if(keys.left){
        direction -= 1;
    }


    if(keys.right){
        direction += 1;
    }


    player.vx =
        direction *
        PLAYER_SPEED;


    player.x +=
        player.vx *
        delta;


    player.x =
        Math.max(
            55,
            Math.min(
                ROAD_WIDTH -
                55 -
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


    const groundY =
        570;


    if(
        player.y +
        player.height >=
        groundY
    ){

        player.y =
            groundY -
            player.height;

        player.vy = 0;

        player.grounded = true;

        player.jumping = false;

    }else{

        player.grounded = false;

    }


    checkObstacles();

    checkLava();

}


// ============================================================
// JUMP
// ============================================================

function jump(){

    if(
        !player.alive ||
        gameFinished
    ){

        return;

    }


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


jumpButton.addEventListener(
    "pointerdown",
    event => {

        event.preventDefault();

        jump();

    }
);


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
// OBSTACLE COLLISION
// ============================================================

function checkObstacles(){

    if(player.invulnerable > 0){
        return;
    }


    for(const obstacle of obstacles){

        const age =
            gameElapsed -
            obstacle.time;


        if(
            age < 0 ||
            age > 4
        ){

            continue;

        }


        let x =
            obstacle.x;

        let y =
            obstacle.y;


        if(
            obstacle.type ===
            "rock"
        ){

            x +=
                Math.sin(
                    age * 2
                ) * 115;

        }else{

            y =
                -70 +
                obstacle.speed *
                age;

        }


        const hit =
            rectanglesOverlap(
                player.x,
                player.y,
                player.width,
                player.height,

                x,
                y,
                obstacle.width,
                obstacle.height
            );


        if(hit){

            hitPlayer(
                "You hit an obstacle."
            );

            break;

        }

    }

}


// ============================================================
// LAVA
// ============================================================

function checkLava(){

    if(player.invulnerable > 0){
        return;
    }


    for(
        const event
        of lavaEvents
    ){

        const elapsed =
            gameElapsed -
            event.time;


        if(
            elapsed < 0 ||
            elapsed > event.duration
        ){

            continue;

        }


        const progress =
            elapsed /
            event.duration;


        const lavaHeight =
            95 +
            Math.sin(
                progress * Math.PI
            ) * 25;


        const laneWidth =
            112;


        const laneStart =
            55 +
            event.lane *
            laneWidth;


        const lavaX =
            event.direction > 0
                ? laneStart +
                  (progress * 100)
                : laneStart -
                  (progress * 100);


        const lavaWidth =
            135;


        const hit =
            rectanglesOverlap(
                player.x,
                player.y,
                player.width,
                player.height,

                lavaX,
                570 - lavaHeight,
                lavaWidth,
                lavaHeight
            );


        if(hit){

            hitPlayer(
                "You entered the lava!"
            );

            break;

        }

    }

}


// ============================================================
// RECTANGLE COLLISION
// ============================================================

function rectanglesOverlap(
    ax,
    ay,
    aw,
    ah,
    bx,
    by,
    bw,
    bh
){

    return (
        ax < bx + bw &&
        ax + aw > bx &&
        ay < by + bh &&
        ay + ah > by
    );

}


// ============================================================
// PLAYER HIT
// ============================================================

async function hitPlayer(reason){

    if(
        !player.alive ||
        player.invulnerable > 0
    ){

        return;

    }


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
        player.width / 2;


    player.y =
        520;


    player.vy =
        JUMP_FORCE * .65;


    showGameMessage(
        "⚠️",
        "HIT!",
        `${reason} ${player.lives} life${player.lives === 1 ? "" : "s"} remaining.`,
        1000
    );


    await sendPlayerState(true);

}


// ============================================================
// ELIMINATE PLAYER
// ============================================================

async function eliminatePlayer(reason){

    if(!player.alive){
        return;
    }


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
// CHECK LAST PLAYER
// ============================================================

function checkLastPlayerStanding(){

    if(
        !gameStarted ||
        gameFinished
    ){

        return;

    }


    const allPlayers =
        [...players.values()];


    if(
        allPlayers.length <
        MIN_PLAYERS
    ){

        return;

    }


    const alivePlayers =
        allPlayers.filter(
            p => p.alive === true
        );


    if(alivePlayers.length === 1){

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


    if(alivePlayers.length === 0){

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
        (120 +
        gameElapsed * 1.8) *
        delta;


    if(
        roadScroll >
        80
    ){

        roadScroll = 0;

    }

}


// ============================================================
// SCORE
// ============================================================

function updateScore(delta){

    if(!player.alive){
        return;
    }


    player.distance +=
        delta *
        (8 +
        gameElapsed * .035);


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

    scoreValue.textContent =
        Math.floor(
            player.score
        );


    const aliveCount =
        [...players.values()]
            .filter(
                p => p.alive
            )
            .length;


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


    timeValue.textContent =
        `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;


    livesValue.textContent =
        "❤️".repeat(
            Math.max(
                0,
                player.lives
            )
        ) || "💀";

}


// ============================================================
// FIRESTORE PLAYER STATE
// ============================================================

async function updateGameStateNetwork(){

    if(
        !currentPlayerRef ||
        !currentUser ||
        gameFinished
    ){

        return;

    }


    const now =
        performance.now();


    if(
        now -
        lastStateSend <
        STATE_SEND_INTERVAL
    ){

        return;

    }


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


async function sendPlayerState(force = false){

    if(
        !currentPlayerRef ||
        !currentUser
    ){

        return;

    }


    if(
        !force &&
        performance.now() -
        lastStateSend <
        STATE_SEND_INTERVAL
    ){

        return;

    }


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
// RENDER PLAYERS LIST
// ============================================================

function renderPlayersList(){

    if(!playersList){
        return;
    }


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


    const sorted =
        [...players.values()];


    playersList.innerHTML =
        sorted.map(
            p => {

                const isYou =
                    p.uid ===
                    currentUser?.uid;


                return `
                    <div class="playerRow">

                        <div
                            class="playerAvatar"
                            style="border-color:${p.color || "#54d8ff"}"
                        >
                            ${isYou ? "⭐" : "🏃"}
                        </div>

                        <div class="playerDetails">

                            <div class="playerName">
                                ${escapeHtml(
                                    p.displayName ||
                                    "Player"
                                )}
                                ${isYou ? " (You)" : ""}
                            </div>

                            <div class="playerUsername">
                                @${escapeHtml(
                                    p.username ||
                                    "player"
                                )}
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
// LIVE LEADERBOARD
// ============================================================

function renderLeaderboard(){

    if(!leaderboardRows){
        return;
    }


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
                        Number(b.score || 0) -
                        Number(a.score || 0)
                    );

                }
            );


    if(sorted.length === 0){

        leaderboardRows.textContent =
            "Waiting...";

        return;

    }


    leaderboardRows.innerHTML =
        sorted.map(
            (p,index) => {

                const isYou =
                    p.uid ===
                    currentUser?.uid;


                return `
                    <div class="leaderRow">

                        <div class="rank">
                            ${index + 1}
                        </div>

                        <div class="leaderName">

                            ${isYou ? "⭐ " : ""}
                            ${escapeHtml(
                                p.displayName ||
                                "Player"
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
// ESCAPE HTML
// ============================================================

function escapeHtml(value){

    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

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

    messageIcon.textContent =
        icon;

    messageTitle.textContent =
        title;

    messageText.textContent =
        text;


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

    if(gameFinished){
        return;
    }


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
                    Number(b.score || 0) -
                    Number(a.score || 0)
                );

            }
        );


    let winner =
        ranked[0] ||
        null;


    if(reason === "last-player-standing"){

        winner = ranked.find(
            p => p.uid ===
            currentUser?.uid
        ) || winner;

    }


    if(reason === "another-player-won"){

        winner =
            ranked.find(
                p => p.alive
            ) || winner;

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

    if(resultRecorded){
        return;
    }


    resultRecorded = true;


    const myUid =
        currentUser?.uid;


    if(!myUid){
        return;
    }


    const myRank =
        ranked.findIndex(
            p => p.uid === myUid
        ) + 1;


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
                    player.score / 10
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

    const meWon =
        winner &&
        winner.uid ===
        currentUser?.uid;


    if(meWon){

        winnerTitle.textContent =
            "🏆 YOU ARE THE LAST PLAYER!";

    }else{

        winnerTitle.textContent =
            "👑 LAST PLAYER STANDING!";

    }


    winnerName.textContent =
        winner
            ? (
                winner.uid ===
                currentUser?.uid
                    ? "YOU"
                    : winner.displayName ||
                      "Winner"
            )
            : "No Winner";


    winnerScore.textContent =
        winner
            ? `Score: ${Math.floor(
                Number(
                    winner.score || 0
                )
            )}`
            : "Score: 0";


    resultLeaderboard.innerHTML =
        ranked.map(
            (p,index) => {

                const isMe =
                    p.uid ===
                    currentUser?.uid;


                return `
                    <div class="resultRow">

                        <div class="resultRank">
                            #${index + 1}
                        </div>

                        <div class="resultPlayer">

                            ${
                                isMe
                                    ? "⭐ You"
                                    : escapeHtml(
                                        p.displayName ||
                                        "Player"
                                    )
                            }

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


    winnerOverlay.style.display =
        "flex";

}


// ============================================================
// RETURN TO LOBBY
// ============================================================

returnLobbyButton.addEventListener(
    "click",
    async () => {

        winnerOverlay.style.display =
            "none";

        await leaveRoom();

    }
);


// ============================================================
// LEAVE MATCH
// ============================================================

leaveButton.addEventListener(
    "click",
    async () => {

        await leaveRoom();

    }
);


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


function leaveRoomLocal(){

    roomId = null;

    roomData = null;

    currentPlayerRef = null;

    isHost = false;

    players.clear();


    player.ready = false;

    player.alive = true;

    player.lives = 3;

    player.score = 0;


    winnerOverlay.style.display =
        "none";


    gameMessage.style.display =
        "none";


    gameArea.style.display =
        "none";


    lobby.style.display =
        "block";


    roomCodeEl.textContent =
        "------";


    gameRoomCodeEl.textContent =
        "------";


    playerCountEl.textContent =
        "Players: 0/4";


    readyButton.textContent =
        "🔥 READY";


    readyButton.classList.remove(
        "readyOn"
    );


    setLobbyStatus(
        "Create or join a room to begin."
    );


    renderPlayersList();

}


// ============================================================
// DRAW SCENE
// ============================================================

function drawScene(){

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

    drawLavaEvents();

    drawObstacles();

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


    // Stars

    for(let i = 0; i < 55; i++){

        const x =
            (
                i * 83 +
                obstacleSeed * 13
            ) %
            ROAD_WIDTH;


        const y =
            (
                i * 47 +
                obstacleSeed * 7
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


    // Volcano

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


    // Volcano glow

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


    for(let x = 0; x <= ROAD_WIDTH; x += 12){

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

    // Road shoulders

    ctx.fillStyle =
        "#42120c";


    ctx.fillRect(
        38,
        315,
        314,
        385
    );


    // Main road

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


    // Road edges

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


    // Center markings

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
// LAVA EVENTS
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
            age < -LAVA_WARNING_TIME ||
            age >
            event.duration
        ){

            continue;

        }


        const laneWidth =
            112;


        const laneStart =
            55 +
            event.lane *
            laneWidth;


        if(age < 0){

            // Warning

            const pulse =
                .5 +
                Math.sin(
                    gameElapsed * 10
                ) * .2;


            ctx.fillStyle =
                `rgba(255,190,20,${pulse})`;


            ctx.fillRect(
                laneStart,
                545,
                laneWidth - 4,
                22
            );


            continue;

        }


        const progress =
            age /
            event.duration;


        const move =
            event.direction > 0
                ? progress * 100
                : -progress * 100;


        const x =
            laneStart +
            move;


        const height =
            90 +
            Math.sin(
                progress * Math.PI
            ) * 30;


        const gradient =
            ctx.createLinearGradient(
                x,
                570 - height,
                x,
                570
            );


        gradient.addColorStop(
            0,
            "#ffd52d"
        );


        gradient.addColorStop(
            .3,
            "#ff6800"
        );


        gradient.addColorStop(
            1,
            "#db1600"
        );


        ctx.fillStyle =
            gradient;


        ctx.beginPath();

        ctx.roundRect(
            x,
            570 - height,
            135,
            height,
            18
        );

        ctx.fill();


        // Lava glow

        ctx.fillStyle =
            "rgba(255,130,0,.25)";


        ctx.fillRect(
            x - 8,
            570 - height - 8,
            151,
            10
        );

    }

}


// ============================================================
// OBSTACLES
// ============================================================

function drawObstacles(){

    for(
        const obstacle
        of obstacles
    ){

        const age =
            gameElapsed -
            obstacle.time;


        if(
            age < 0 ||
            age > 4
        ){

            continue;

        }


        let x =
            obstacle.x;

        let y =
            obstacle.y;


        if(
            obstacle.type ===
            "rock"
        ){

            x +=
                Math.sin(
                    age * 2
                ) * 115;

        }else{

            y =
                -70 +
                obstacle.speed *
                age;

        }


        // Shadow

        ctx.fillStyle =
            "rgba(0,0,0,.3)";


        ctx.beginPath();

        ctx.ellipse(
            x +
            obstacle.width / 2,

            y +
            obstacle.height +
            8,

            obstacle.width,

            7,

            0,

            0,
            Math.PI * 2
        );


        ctx.fill();


        // Rock

        ctx.fillStyle =
            obstacle.type ===
            "meteor"
                ? "#6f2719"
                : "#34303a";


        ctx.beginPath();

        ctx.arc(
            x +
            obstacle.width / 2,

            y +
            obstacle.height / 2,

            obstacle.width / 2,

            0,
            Math.PI * 2
        );


        ctx.fill();


        ctx.strokeStyle =
            obstacle.type ===
            "meteor"
                ? "#ff4b16"
                : "#67616d";


        ctx.lineWidth = 3;

        ctx.stroke();


        if(
            obstacle.type ===
            "meteor"
        ){

            ctx.fillStyle =
                "#ffad25";


            ctx.beginPath();

            ctx.arc(
                x +
                obstacle.width / 2,

                y +
                obstacle.height / 2,

                5 +
                Math.sin(
                    gameElapsed * 10
                ) * 2,

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
        ){

            continue;

        }


        if(
            other.alive === false
        ){

            continue;

        }


        const x =
            Number(
                other.x || 180
            );


        const y =
            Number(
                other.y || 520
            );


        drawRunner(
            x,
            y,
            other.color ||
            "#54d8ff",
            other.displayName ||
            "Player",
            false
        );

    }

}


// ============================================================
// LOCAL PLAYER
// ============================================================

function drawLocalPlayer(){

    if(
        !player.alive
    ){

        return;

    }


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
        "YOU",
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

    // Shadow

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


    // Body

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


    // Helmet

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


    // Visor

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


    // Legs

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
        x + 7 - running,
        y + 43
    );


    ctx.moveTo(
        x + 19,
        y + 36
    );

    ctx.lineTo(
        x + 22 + running,
        y + 43
    );


    ctx.stroke();


    ctx.lineCap =
        "butt";


    // Name

    ctx.font =
        local
            ? "bold 9px system-ui"
            : "bold 8px system-ui";


    ctx.textAlign =
        "center";


    ctx.fillStyle =
        "#ffffff";


    ctx.fillText(
        name,
        x + PLAYER_WIDTH / 2,
        y - 8
    );

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
                (Math.random() - .5) *
                80,

            vy:
                Math.random() *
                60,

            life:
                .5 +
                Math.random() * .4,

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
                (Math.random() - .5) *
                250,

            vy:
                (Math.random() - .5) *
                250,

            life:
                .5 +
                Math.random() * .8,

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
    ){

        return;

    }


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
            (
                i * 47
            );


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
// RESET / DRAW WAITING
// ============================================================

function drawWaitingScene(){

    drawScene();

}


// ============================================================
// INPUT FOCUS PROTECTION
// ============================================================

roomInput.addEventListener(
    "keydown",
    event => {

        if(event.key === "Enter"){

            joinRoomButton.click();

        }

    }
);


// ============================================================
// ROOM INPUT CLEANUP
// ============================================================

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
                .slice(0,6);

    }
);


// ============================================================
// INITIAL CANVAS
// ============================================================

drawScene();


// ============================================================
// INITIAL WAITING STATE
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
// PREVENT PAGE SCROLL WHILE USING GAME CONTROLS
// ============================================================

[
    leftButton,
    rightButton,
    jumpButton
].forEach(
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
// CLEANUP WHEN LEAVING PAGE
// ============================================================

window.addEventListener(
    "pagehide",
    () => {

        if(animationFrame){

            cancelAnimationFrame(
                animationFrame
            );

        }

        if(roomUnsubscribe){

            roomUnsubscribe();

        }

        if(playersUnsubscribe){

            playersUnsubscribe();

        }

    }
);


// ============================================================
// DONE
// ============================================================

console.log(
    "🌋 VitalStar Volcano Jump loaded."
);