
/* ============================================================
   VITALSTAR — VOLCANO JUMP
   Multiplayer Last-Player-Standing Survival

   FEATURES
   - Lava is the ONLY obstacle
   - Difficulty increases as time passes
   - Multiplayer: up to 4 players
   - Room creation, room codes and quick match
   - Ready system and synchronized countdown
   - Mobile touch controls and keyboard controls
   - Jumping, collision detection and elimination
   - Live player positions and leaderboard
   - Firebase room/player synchronization
   - Automatic winner and game-result handling

   Firebase v10.12.2
   File: volcano-jump.js
   ============================================================ */

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
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { recordGameResult } from "./games.js";

/* ============================================================
   CONFIGURATION
   ============================================================ */

const GAME_ID = "volcano-jump";

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

const GAME_DURATION = 180;
const COUNTDOWN_SECONDS = 4;

const WORLD_WIDTH = 390;
const WORLD_HEIGHT = 700;

const PLAYER_WIDTH = 26;
const PLAYER_HEIGHT = 42;

const GROUND_Y = 565;
const PLAYER_SPEED = 235;

const JUMP_FORCE = 610;
const GRAVITY = 1550;

const STATE_SEND_INTERVAL = 180;
const INVULNERABILITY_TIME = 1.15;

const LAVA_START_Y = 290;
const LAVA_END_Y = 710;
const LAVA_HEIGHT = 28;

const PLAYER_COLORS = [
    "#54e8ff",
    "#ffca55",
    "#ff6b9d",
    "#a68bff"
];

const $ = id => document.getElementById(id);

/* ============================================================
   DOM
   ============================================================ */

const el = {
    lobby: $("lobby"),
    gameArea: $("gameArea"),

    roomCode: $("roomCode"),
    gameRoomCode: $("gameRoomCode"),
    playerCount: $("playerCount"),
    playersList: $("playersList"),

    readyButton: $("readyButton"),
    lobbyStatus: $("lobbyStatus"),

    quickMatchButton: $("quickMatchButton"),
    createRoomButton: $("createRoomButton"),
    roomInput: $("roomInput"),
    joinRoomButton: $("joinRoomButton"),
    leaveButton: $("leaveButton"),

    scoreValue: $("scoreValue"),
    aliveValue: $("aliveValue"),
    timeValue: $("timeValue"),
    livesValue: $("livesValue"),

    leaderboardRows: $("leaderboardRows"),

    gameCanvas: $("gameCanvas"),

    countdownOverlay: $("countdownOverlay"),
    countdownMessage: $("countdownMessage"),
    countdownNumber: $("countdownNumber"),

    waitingOverlay: $("waitingOverlay"),
    waitingTitle: $("waitingTitle"),
    waitingText: $("waitingText"),

    gameMessage: $("gameMessage"),
    messageIcon: $("messageIcon"),
    messageTitle: $("messageTitle"),
    messageText: $("messageText"),

    winnerOverlay: $("winnerOverlay"),
    winnerTitle: $("winnerTitle"),
    winnerName: $("winnerName"),
    winnerScore: $("winnerScore"),
    resultLeaderboard: $("resultLeaderboard"),
    returnLobbyButton: $("returnLobbyButton"),

    leftButton: $("leftButton"),
    rightButton: $("rightButton"),
    jumpButton: $("jumpButton")
};

/* ============================================================
   CANVAS
   ============================================================ */

const canvas = el.gameCanvas;
const ctx = canvas ? canvas.getContext("2d") : null;

let canvasScale = 1;

function resizeCanvas() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    canvas.width = Math.round(rect.width * devicePixelRatio);
    canvas.height = Math.round(rect.height * devicePixelRatio);

    canvasScale = Math.min(
        rect.width / WORLD_WIDTH,
        rect.height / WORLD_HEIGHT
    );

    ctx.setTransform(
        devicePixelRatio * rect.width / WORLD_WIDTH,
        0,
        0,
        devicePixelRatio * rect.height / WORLD_HEIGHT,
        0,
        0
    );
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ============================================================
   GLOBAL STATE
   ============================================================ */

let currentUser = null;

let roomId = null;
let roomCode = null;
let roomData = null;

let roomUnsubscribe = null;
let playersUnsubscribe = null;
let chatUnsubscribe = null;

let roomRef = null;
let playersRef = null;
let localPlayerRef = null;

let players = new Map();

let gameStarted = false;
let gameFinished = false;
let gameStartTime = 0;
let gameElapsed = 0;

let lastFrameTime = 0;
let lastStateSend = 0;
let stateWriteInFlight = false;

let countdownTimer = null;
let countdownTarget = 0;

let animationFrame = null;

let resultRecorded = false;
let finishingGame = false;

let hitLavaIds = new Set();
let seenMessageIds = new Set();

let chatPanelOpen = false;
let unreadMessages = 0;

let pressedKeys = new Set();

let touchLeft = false;
let touchRight = false;
let touchJump = false;

let jumpWasPressed = false;

let lavaEvents = [];
let particles = [];

let self = null;

const input = {
    left: false,
    right: false,
    jump: false
};

/* ============================================================
   PLAYER OBJECT
   ============================================================ */

function createLocalPlayer() {
    return {
        uid: currentUser.uid,

        displayName:
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            "Player",

        username: currentUser.displayName || "Player",

        ready: false,
        alive: true,

        lives: 1,
        score: 0,

        x: WORLD_WIDTH / 2,
        y: GROUND_Y - PLAYER_HEIGHT,

        vx: 0,
        vy: 0,

        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,

        color: PLAYER_COLORS[
            Math.floor(Math.random() * PLAYER_COLORS.length)
        ],

        jumping: false,
        invulnerableUntil: 0,

        renderedX: WORLD_WIDTH / 2,
        renderedY: GROUND_Y - PLAYER_HEIGHT,

        updatedAt: Date.now()
    };
}

function playerToFirestore(p) {
    return {
        uid: p.uid,
        displayName: p.displayName,
        username: p.username,

        ready: !!p.ready,
        alive: !!p.alive,

        lives: Number(p.lives || 0),
        score: Number(p.score || 0),

        x: Number(p.x || 0),
        y: Number(p.y || 0),

        vx: Number(p.vx || 0),
        vy: Number(p.vy || 0),

        color: p.color || "#54e8ff",

        updatedAt: Date.now()
    };
}

function applyRemotePlayer(data) {
    const old = players.get(data.uid);

    if (data.uid === currentUser?.uid && self) {
        self.ready = !!data.ready;
        self.alive = data.alive !== false;
        self.lives = Number(data.lives ?? self.lives);
        self.score = Number(data.score ?? self.score);

        return;
    }

    const p = {
        ...data,

        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,

        x: Number(data.x ?? WORLD_WIDTH / 2),
        y: Number(data.y ?? GROUND_Y - PLAYER_HEIGHT),

        renderedX: old?.renderedX ?? Number(data.x ?? WORLD_WIDTH / 2),
        renderedY: old?.renderedY ?? Number(data.y ?? GROUND_Y - PLAYER_HEIGHT),

        updatedAt: Number(data.updatedAt || Date.now())
    };

    players.set(data.uid, p);
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function setText(element, value) {
    if (element) element.textContent = String(value);
}

function showElement(element) {
    if (element) element.style.display = "";
}

function hideElement(element) {
    if (element) element.style.display = "none";
}

function setLobbyStatus(message) {
    setText(el.lobbyStatus, message);
}

function showLobby() {
    showElement(el.lobby);
    hideElement(el.gameArea);
}

function showGameArea() {
    hideElement(el.lobby);
    showElement(el.gameArea);
}

function showMessage(icon, title, message) {
    setText(el.messageIcon, icon);
    setText(el.messageTitle, title);
    setText(el.messageText, message);

    showElement(el.gameMessage);
}

function hideMessage() {
    hideElement(el.gameMessage);
}

function showWaiting(title, message) {
    setText(el.waitingTitle, title);
    setText(el.waitingText, message);

    showElement(el.waitingOverlay);
}

function hideWaiting() {
    hideElement(el.waitingOverlay);
}

function showCountdown(number, message = "GET READY!") {
    setText(el.countdownNumber, number);
    setText(el.countdownMessage, message);

    showElement(el.countdownOverlay);
}

function hideCountdown() {
    hideElement(el.countdownOverlay);
}

function setButtonDisabled(button, disabled) {
    if (button) button.disabled = disabled;
}

/* ============================================================
   ROOM CODE
   ============================================================ */

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}

async function findRoomByCode(code) {
    const q = query(
        collection(db, "gameRooms"),
        where("game", "==", GAME_ID),
        where("roomCode", "==", code),
        limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) return null;

    return snap.docs[0];
}

/* ============================================================
   CREATE ROOM
   ============================================================ */

async function createRoom() {
    if (!currentUser) {
        setLobbyStatus("Please sign in first.");
        return;
    }

    if (roomId) {
        setLobbyStatus("Leave your current room first.");
        return;
    }

    try {
        setLobbyStatus("Creating room...");

        const code = generateRoomCode();
        const newRoomRef = doc(collection(db, "gameRooms"));

        roomId = newRoomRef.id;
        roomCode = code;
        roomRef = newRoomRef;

        self = createLocalPlayer();

        roomData = {
            game: GAME_ID,
            roomCode: code,

            hostUid: currentUser.uid,

            status: "waiting",

            playersCount: 1,
            readyCount: 0,

            maxPlayers: MAX_PLAYERS,
            minPlayers: MIN_PLAYERS,

            seed: Math.floor(Math.random() * 2147483647),

            startAt: null,
            winnerUid: null,

            createdAt: Date.now()
        };

        await setDoc(roomRef, roomData);

        playersRef = collection(db, "gameRooms", roomId, "players");

        localPlayerRef = doc(
            db,
            "gameRooms",
            roomId,
            "players",
            currentUser.uid
        );

        await setDoc(localPlayerRef, playerToFirestore(self));

        enterRoomUI();
        subscribeToRoom();
        subscribeToPlayers();

        setLobbyStatus("Room created. Invite your friends!");

    } catch (error) {
        console.error("Create room error:", error);

        await resetLocalRoom(false);

        setLobbyStatus("Could not create room. Please try again.");
    }
}

/* ============================================================
   JOIN ROOM
   ============================================================ */

async function joinExistingRoom(roomDocument) {
    if (!currentUser) {
        setLobbyStatus("Please sign in first.");
        return;
    }

    if (roomId) {
        setLobbyStatus("Leave your current room first.");
        return;
    }

    try {
        setLobbyStatus("Joining room...");

        const data = roomDocument.data();
        const id = roomDocument.id;

        if (data.game !== GAME_ID || data.status !== "waiting") {
            setLobbyStatus("This room is not available.");
            return;
        }

        const playerCollection = collection(
            db,
            "gameRooms",
            id,
            "players"
        );

        const playerSnapshot = await getDocs(playerCollection);

        const alreadyJoined = playerSnapshot.docs.some(
            d => d.id === currentUser.uid
        );

        if (!alreadyJoined && playerSnapshot.size >= MAX_PLAYERS) {
            setLobbyStatus("This room is full.");
            return;
        }

        roomId = id;
        roomCode = data.roomCode;
        roomData = data;

        roomRef = doc(db, "gameRooms", id);
        playersRef = playerCollection;

        localPlayerRef = doc(
            db,
            "gameRooms",
            id,
            "players",
            currentUser.uid
        );

        const existing = playerSnapshot.docs.find(
            d => d.id === currentUser.uid
        );

        if (existing) {
            self = {
                ...createLocalPlayer(),
                ...existing.data()
            };
        } else {
            self = createLocalPlayer();

            await setDoc(localPlayerRef, playerToFirestore(self));
        }

        enterRoomUI();

        subscribeToRoom();
        subscribeToPlayers();

        await updateRoomCounts();

        setLobbyStatus("Joined room successfully.");

    } catch (error) {
        console.error("Join room error:", error);

        await resetLocalRoom(false);

        setLobbyStatus("Could not join room. Check the room code.");
    }
}

async function joinRoomByCode() {
    const code = (el.roomInput?.value || "")
        .trim()
        .toUpperCase();

    if (!code) {
        setLobbyStatus("Enter a room code.");
        return;
    }

    try {
        setLobbyStatus("Finding room...");

        const roomDocument = await findRoomByCode(code);

        if (!roomDocument) {
            setLobbyStatus("Room not found.");
            return;
        }

        await joinExistingRoom(roomDocument);

    } catch (error) {
        console.error("Find room error:", error);
        setLobbyStatus("Could not find that room.");
    }
}

/* ============================================================
   QUICK MATCH
   ============================================================ */

async function quickMatch() {
    if (!currentUser) {
        setLobbyStatus("Please sign in first.");
        return;
    }

    if (roomId) {
        setLobbyStatus("Leave your current room first.");
        return;
    }

    try {
        setLobbyStatus("Searching for a match...");

        const q = query(
            collection(db, "gameRooms"),
            where("game", "==", GAME_ID),
            where("status", "==", "waiting"),
            limit(20)
        );

        const snap = await getDocs(q);

        for (const candidate of snap.docs) {
            const data = candidate.data();

            if (data.hostUid === currentUser.uid) continue;

            const candidatePlayers = await getDocs(
                collection(db, "gameRooms", candidate.id, "players")
            );

            const existing = candidatePlayers.docs.some(
                d => d.id === currentUser.uid
            );

            if (candidatePlayers.size < MAX_PLAYERS || existing) {
                await joinExistingRoom(candidate);
                return;
            }
        }

        await createRoom();

    } catch (error) {
        console.error("Quick match error:", error);
        setLobbyStatus("Quick match failed. Try creating a room.");
    }
}

/* ============================================================
   ENTER ROOM UI
   ============================================================ */

function enterRoomUI() {
    showLobby();
    hideElement(el.winnerOverlay);
    hideCountdown();
    hideWaiting();
    hideMessage();

    setText(el.roomCode, roomCode || "------");
    setText(el.gameRoomCode, roomCode || "------");

    setButtonDisabled(el.readyButton, false);

    renderLobbyPlayers();
}

/* ============================================================
   FIRESTORE ROOM LISTENER
   ============================================================ */

function subscribeToRoom() {
    if (!roomRef) return;

    if (roomUnsubscribe) roomUnsubscribe();

    roomUnsubscribe = onSnapshot(
        roomRef,
        snapshot => {
            if (!snapshot.exists()) {
                setLobbyStatus("Room no longer exists.");
                return;
            }

            roomData = snapshot.data();

            setText(el.roomCode, roomData.roomCode || roomCode);
            setText(el.gameRoomCode, roomData.roomCode || roomCode);

            if (roomData.status === "playing") {
                if (!gameStarted && !gameFinished) {
                    startCountdownFromServer(roomData.startAt);
                }
            }

            if (roomData.status === "finished") {
                if (!gameFinished) {
                    finishGame(
                        roomData.winnerUid || null,
                        false
                    );
                }
            }

            if (roomData.status === "waiting") {
                if (!gameStarted && !gameFinished) {
                    showLobby();
                    updateWaitingState();
                }
            }
        },
        error => {
            console.error("Room listener error:", error);
            setLobbyStatus("Connection problem. Reconnect and try again.");
        }
    );
}

/* ============================================================
   PLAYER LISTENER
   ============================================================ */

function subscribeToPlayers() {
    if (!playersRef) return;

    if (playersUnsubscribe) playersUnsubscribe();

    playersUnsubscribe = onSnapshot(
        playersRef,
        snapshot => {
            const incoming = new Map();

            snapshot.forEach(playerDoc => {
                const data = playerDoc.data();

                incoming.set(playerDoc.id, {
                    ...data,
                    uid: playerDoc.id
                });
            });

            for (const [uid, data] of incoming) {
                if (uid === currentUser?.uid) {
                    if (self) {
                        self.ready = !!data.ready;

                        if (!gameStarted) {
                            self.alive = data.alive !== false;
                        }
                    }
                } else {
                    applyRemotePlayer(data);
                }
            }

            for (const uid of [...players.keys()]) {
                if (!incoming.has(uid)) {
                    players.delete(uid);
                }
            }

            if (self) {
                players.set(self.uid, self);
            }

            renderLobbyPlayers();
            renderLeaderboard();
            updateHUD();
            updateWaitingState();

            if (gameStarted && !gameFinished) {
                checkLocalEndConditions();
            }
        },
        error => {
            console.error("Player listener error:", error);
        }
    );
}

/* ============================================================
   UPDATE ROOM COUNTS
   ============================================================ */

async function updateRoomCounts() {
    if (!roomRef || !roomData) return;

    try {
        const snapshot = await getDocs(playersRef);

        let readyCount = 0;

        snapshot.forEach(d => {
            if (d.data().ready) readyCount++;
        });

        await updateDoc(roomRef, {
            playersCount: snapshot.size,
            readyCount
        });

    } catch (error) {
        console.error("Room count update error:", error);
    }
}

/* ============================================================
   LOBBY RENDERING
   ============================================================ */

function renderLobbyPlayers() {
    if (!el.playersList) return;

    el.playersList.replaceChildren();

    const allPlayers = [...players.values()];

    if (self && !players.has(self.uid)) {
        allPlayers.push(self);
    }

    allPlayers.forEach((p, index) => {
        const row = document.createElement("div");

        row.className = "volcano-player-row";

        const dot = document.createElement("span");

        dot.className = "volcano-player-dot";
        dot.style.background = p.color || PLAYER_COLORS[index % PLAYER_COLORS.length];

        const name = document.createElement("span");

        name.className = "volcano-player-name";

        name.textContent =
            p.displayName ||
            p.username ||
            "Player";

        if (p.uid === currentUser?.uid) {
            name.textContent += " (You)";
        }

        const status = document.createElement("span");

        status.className = "volcano-player-status";

        if (gameStarted && !p.alive) {
            status.textContent = "ELIMINATED";
        } else {
            status.textContent = p.ready ? "READY" : "NOT READY";
        }

        row.append(dot, name, status);

        el.playersList.appendChild(row);
    });

    setText(
        el.playerCount,
        `${allPlayers.length}/${MAX_PLAYERS}`
    );
}

function updateWaitingState() {
    if (!roomData || !self) return;

    if (el.readyButton) {
        el.readyButton.textContent = self.ready
            ? "CANCEL READY"
            : "I'M READY";
    }

    const count = players.size || (self ? 1 : 0);

    const readyCount = [...players.values()]
        .filter(p => p.ready)
        .length;

    if (roomData.status === "waiting") {
        setLobbyStatus(
            `${count}/${MAX_PLAYERS} players • ${readyCount} ready • Need ${MIN_PLAYERS} players`
        );
    }
}

/* ============================================================
   READY SYSTEM
   ============================================================ */

async function toggleReady() {
    if (!self || !localPlayerRef || !roomData) return;

    if (roomData.status !== "waiting") return;

    const newReady = !self.ready;

    self.ready = newReady;

    renderLobbyPlayers();
    updateWaitingState();

    try {
        await updateDoc(localPlayerRef, {
            ready: newReady,
            updatedAt: Date.now()
        });

        await updateRoomCounts();

        await maybeStartMatch();

    } catch (error) {
        console.error("Ready update error:", error);

        self.ready = !newReady;

        renderLobbyPlayers();
        updateWaitingState();
    }
}

/* ============================================================
   START MATCH
   ============================================================ */

async function maybeStartMatch() {
    if (!roomData || !roomRef || !currentUser) return;

    if (roomData.status !== "waiting") return;

    if (roomData.hostUid !== currentUser.uid) return;

    const snapshot = await getDocs(playersRef);

    if (snapshot.size < MIN_PLAYERS) return;
    if (snapshot.size > MAX_PLAYERS) return;

    const allReady = snapshot.docs.every(
        d => d.data().ready === true
    );

    if (!allReady) return;

    const startAt = Date.now() + COUNTDOWN_SECONDS * 1000;

    try {
        await updateDoc(roomRef, {
            status: "playing",
            startAt,
            playersCount: snapshot.size,
            readyCount: snapshot.size
        });
    } catch (error) {
        console.error("Start match error:", error);
    }
}

/* ============================================================
   SYNCHRONIZED COUNTDOWN
   ============================================================ */

function startCountdownFromServer(startAt) {
    if (!startAt || gameStarted || gameFinished) return;

    countdownTarget = Number(startAt);

    if (!Number.isFinite(countdownTarget)) return;

    showGameArea();
    hideWaiting();

    if (countdownTimer) {
        clearInterval(countdownTimer);
    }

    countdownTimer = setInterval(() => {
        if (gameFinished || gameStarted) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            return;
        }

        const remaining = Math.max(
            0,
            Math.ceil((countdownTarget - Date.now()) / 1000)
        );

        if (remaining > 0) {
            showCountdown(remaining);
        } else {
            clearInterval(countdownTimer);
            countdownTimer = null;

            hideCountdown();

            startGame();
        }
    }, 100);
}

/* ============================================================
   START GAME LOCALLY
   ============================================================ */

function startGame() {
    if (gameStarted || gameFinished) return;

    gameStarted = true;
    gameFinished = false;
    resultRecorded = false;
    finishingGame = false;

    gameStartTime = Number(roomData?.startAt || Date.now());

    gameElapsed = 0;

    hitLavaIds.clear();
    lavaEvents = [];
    particles = [];

    if (self) {
        self.alive = true;
        self.lives = 1;
        self.score = 0;

        self.x = WORLD_WIDTH / 2;
        self.y = GROUND_Y - PLAYER_HEIGHT;

        self.vx = 0;
        self.vy = 0;

        self.jumping = false;
        self.invulnerableUntil = 0;
    }

    for (const p of players.values()) {
        p.alive = true;
        p.lives = 1;
        p.score = 0;
    }

    showGameArea();
    hideCountdown();
    hideWaiting();
    hideMessage();
    hideElement(el.winnerOverlay);

    setText(el.scoreValue, "0");
    setText(el.aliveValue, String(players.size));
    setText(el.timeValue, String(GAME_DURATION));
    setText(el.livesValue, "1");

    lastFrameTime = performance.now();

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    animationFrame = requestAnimationFrame(gameLoop);

    sendPlayerState(true);
}

/* ============================================================
   LAVA DIFFICULTY
   ============================================================ */

function getLavaDifficulty(elapsed) {
    const t = Math.max(0, elapsed);

    return {
        spawnGap: Math.max(0.82, 2.8 - t * 0.0105),

        speed: Math.min(490, 195 + t * 1.7),

        width: Math.min(280, 115 + t * 0.65),

        warningTime: Math.max(0.4, 1.15 - t * 0.003)
    };
}

/* ============================================================
   DETERMINISTIC LAVA SCHEDULE
   All clients derive wave timing from the same game start.
   ============================================================ */

function getLavaSchedule(elapsed) {
    const result = [];

    let spawnTime = 2;
    let index = 0;

    while (spawnTime <= elapsed + 5) {
        const difficulty = getLavaDifficulty(spawnTime);

        const age = elapsed - spawnTime;

        const travelDuration =
            (LAVA_END_Y - LAVA_START_Y) / difficulty.speed;

        if (age >= 0 && age <= travelDuration + 0.2) {
            const y = LAVA_START_Y + age * difficulty.speed;

            const road = getRoadBoundsAtY(y);

            const centerOffset =
                Math.sin(index * 2.13) *
                Math.max(0, road.right - road.left) *
                0.18;

            const center = (road.left + road.right) / 2 + centerOffset;

            const width = Math.min(
                difficulty.width,
                road.right - road.left
            );

            result.push({
                id: `lava-${index}`,
                y,
                height: LAVA_HEIGHT,
                left: center - width / 2,
                right: center + width / 2,
                spawnTime,
                warningTime: difficulty.warningTime
            });
        }

        spawnTime += difficulty.spawnGap;
        index++;

        if (index > 1000) break;
    }

    return result;
}

/* ============================================================
   ROAD PERSPECTIVE
   ============================================================ */

function getRoadBoundsAtY(y) {
    const depth = Math.max(
        0,
        Math.min(1, (y - 120) / (WORLD_HEIGHT - 120))
    );

    const width = 55 + depth * 265;

    return {
        left: WORLD_WIDTH / 2 - width / 2,
        right: WORLD_WIDTH / 2 + width / 2
    };
}

/* ============================================================
   GAME LOOP
   ============================================================ */

function gameLoop(timestamp) {
    if (!gameStarted || gameFinished) return;

    const dt = Math.min(
        0.04,
        Math.max(0, (timestamp - lastFrameTime) / 1000)
    );

    lastFrameTime = timestamp;

    gameElapsed = Math.max(
        0,
        (Date.now() - gameStartTime) / 1000
    );

    if (gameElapsed >= GAME_DURATION) {
        handleTimeExpired();
        return;
    }

    updateLocalPlayer(dt);
    updateRemotePlayers(dt);
    updateLava(dt);
    updateParticles(dt);

    checkLavaCollisions();
    updateScore(dt);
    updateHUD();

    drawScene();

    if (timestamp - lastStateSend >= STATE_SEND_INTERVAL) {
        lastStateSend = timestamp;
        sendPlayerState();
    }

    checkLocalEndConditions();

    if (!gameFinished) {
        animationFrame = requestAnimationFrame(gameLoop);
    }
}

/* ============================================================
   LOCAL PLAYER MOVEMENT
   ============================================================ */

function updateLocalPlayer(dt) {
    if (!self || !self.alive) return;

    input.left = pressedKeys.has("ArrowLeft") ||
        pressedKeys.has("a") ||
        touchLeft;

    input.right = pressedKeys.has("ArrowRight") ||
        pressedKeys.has("d") ||
        touchRight;

    input.jump = pressedKeys.has(" ") ||
        pressedKeys.has("ArrowUp") ||
        pressedKeys.has("w") ||
        touchJump;

    let direction = 0;

    if (input.left) direction -= 1;
    if (input.right) direction += 1;

    self.vx = direction * PLAYER_SPEED;

    self.x += self.vx * dt;

    const bounds = getRoadBoundsAtY(GROUND_Y);

    self.x = Math.max(
        bounds.left + PLAYER_WIDTH / 2,
        Math.min(
            bounds.right - PLAYER_WIDTH / 2,
            self.x
        )
    );

    const jumpPressed = input.jump && !jumpWasPressed;

    if (jumpPressed && !self.jumping) {
        self.vy = -JUMP_FORCE;
        self.jumping = true;

        spawnJumpParticles(self.x, GROUND_Y);
    }

    jumpWasPressed = input.jump;

    if (self.jumping) {
        self.vy += GRAVITY * dt;
        self.y += self.vy * dt;

        const groundTop = GROUND_Y - PLAYER_HEIGHT;

        if (self.y >= groundTop) {
            self.y = groundTop;
            self.vy = 0;
            self.jumping = false;
        }
    } else {
        self.y = GROUND_Y - PLAYER_HEIGHT;
    }
}

/* ============================================================
   SMOOTH REMOTE PLAYERS
   ============================================================ */

function updateRemotePlayers(dt) {
    for (const p of players.values()) {
        if (p.uid === currentUser?.uid) continue;

        const blend = Math.min(1, dt * 12);

        p.renderedX += (p.x - p.renderedX) * blend;
        p.renderedY += (p.y - p.renderedY) * blend;
    }
}

/* ============================================================
   LAVA EVENTS
   ============================================================ */

function updateLava() {
    lavaEvents = getLavaSchedule(gameElapsed);
}

/* ============================================================
   LAVA COLLISION
   Jumping above the lava wave prevents a collision.
   Each wave can eliminate a player only once.
   ============================================================ */

function checkLavaCollisions() {
    if (!self || !self.alive) return;

    for (const lava of lavaEvents) {
        if (hitLavaIds.has(lava.id)) continue;

        const playerLeft = self.x - PLAYER_WIDTH / 2;
        const playerRight = self.x + PLAYER_WIDTH / 2;

        const playerTop = self.y;
        const playerBottom = self.y + PLAYER_HEIGHT;

        const lavaTop = lava.y - lava.height;
        const lavaBottom = lava.y;

        const horizontalOverlap =
            playerRight > lava.left &&
            playerLeft < lava.right;

        const verticalOverlap =
            playerBottom > lavaTop &&
            playerTop < lavaBottom;

        if (horizontalOverlap && verticalOverlap) {
            hitLavaIds.add(lava.id);
            eliminateLocalPlayer();
            break;
        }
    }
}

/* ============================================================
   ELIMINATION
   ============================================================ */

function eliminateLocalPlayer() {
    if (!self || !self.alive || gameFinished) return;

    self.alive = false;
    self.lives = 0;
    self.vx = 0;
    self.vy = 0;

    spawnEliminationParticles(self.x, self.y);

    showMessage(
        "🌋",
        "ELIMINATED",
        "The lava caught you! Watch the remaining players."
    );

    sendPlayerState(true);

    renderLeaderboard();
    updateHUD();

    checkLocalEndConditions();
}

/* ============================================================
   SCORE
   ============================================================ */

function updateScore(dt) {
    if (!self || !self.alive) return;

    self.score += Math.round(dt * 10);

    for (const p of players.values()) {
        if (p.uid === self.uid || !p.alive) continue;

        if (!Number.isFinite(p.score)) p.score = 0;
    }
}

/* ============================================================
   END CONDITIONS
   ============================================================ */

function getAlivePlayers() {
    return [...players.values()].filter(p => p.alive !== false);
}

function checkLocalEndConditions() {
    if (!gameStarted || gameFinished) return;

    const alive = getAlivePlayers();

    if (alive.length <= 1 && players.size >= MIN_PLAYERS) {
        const winner = alive[0] || null;

        finishGame(winner?.uid || null, true);
    }
}

function handleTimeExpired() {
    if (gameFinished) return;

    const ranking = [...players.values()].sort((a, b) => {
        if (!!a.alive !== !!b.alive) {
            return a.alive ? -1 : 1;
        }

        return Number(b.score || 0) - Number(a.score || 0);
    });

    finishGame(ranking[0]?.uid || null, true);
}

/* ============================================================
   FINISH GAME
   Only the host persists the final room result.
   ============================================================ */

async function finishGame(winnerUid, requestHostFinish = false) {
    if (finishingGame || gameFinished) return;

    finishingGame = true;
    gameFinished = true;
    gameStarted = false;

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    hideCountdown();
    hideWaiting();
    hideMessage();

    const ranking = [...players.values()].sort((a, b) => {
        if (!!a.alive !== !!b.alive) {
            return a.alive ? -1 : 1;
        }

        return Number(b.score || 0) - Number(a.score || 0);
    });

    let winner = ranking.find(p => p.uid === winnerUid);

    if (!winner && ranking.length) {
        winner = ranking[0];
        winnerUid = winner.uid;
    }

    const isHost = roomData?.hostUid === currentUser?.uid;

    if (requestHostFinish && isHost && roomRef) {
        try {
            await updateDoc(roomRef, {
                status: "finished",
                winnerUid: winnerUid || null,
                finishedAt: Date.now()
            });
        } catch (error) {
            console.error("Persist game result error:", error);
        }
    }

    if (self && localPlayerRef) {
        try {
            await sendPlayerState(true);
        } catch (error) {
            console.warn("Final player state failed:", error);
        }
    }

    const didWin = winnerUid === currentUser?.uid;

    setText(
        el.winnerTitle,
        didWin ? "VICTORY!" : "GAME OVER"
    );

    setText(
        el.winnerName,
        winner?.displayName || winner?.username || "No winner"
    );

    setText(
        el.winnerScore,
        String(winner?.score || 0)
    );

    renderResultLeaderboard(ranking);

    showElement(el.winnerOverlay);

    showGameArea();

    if (!resultRecorded && self) {
        resultRecorded = true;

        try {
            const score = Number(self.score || 0);
            const reward = didWin ? 100 : 0;

            await recordGameResult(
                GAME_ID,
                didWin ? "win" : "loss",
                score,
                reward
            );
        } catch (error) {
            console.warn("Game result recording failed:", error);
        }
    }

    finishingGame = false;
}

/* ============================================================
   HUD
   ============================================================ */

function updateHUD() {
    if (self) {
        setText(el.scoreValue, Math.floor(self.score || 0));
        setText(el.livesValue, self.alive ? 1 : 0);
    }

    setText(
        el.aliveValue,
        getAlivePlayers().length
    );

    setText(
        el.timeValue,
        Math.max(0, Math.ceil(GAME_DURATION - gameElapsed))
    );

    renderLeaderboard();
}

/* ============================================================
   LEADERBOARD
   ============================================================ */

function renderLeaderboard() {
    if (!el.leaderboardRows) return;

    const ranking = [...players.values()].sort((a, b) => {
        if (!!a.alive !== !!b.alive) {
            return a.alive ? -1 : 1;
        }

        return Number(b.score || 0) - Number(a.score || 0);
    });

    el.leaderboardRows.replaceChildren();

    ranking.forEach((p, index) => {
        const row = document.createElement("div");

        row.className = "volcano-leaderboard-row";

        const rank = document.createElement("span");
        rank.textContent = String(index + 1);

        const name = document.createElement("span");
        name.textContent = p.displayName || p.username || "Player";

        const score = document.createElement("span");
        score.textContent = String(Math.floor(p.score || 0));

        const status = document.createElement("span");
        status.textContent = p.alive ? "ALIVE" : "OUT";

        row.append(rank, name, score, status);

        el.leaderboardRows.appendChild(row);
    });
}

function renderResultLeaderboard(ranking) {
    if (!el.resultLeaderboard) return;

    el.resultLeaderboard.replaceChildren();

    ranking.forEach((p, index) => {
        const row = document.createElement("div");

        row.className = "volcano-result-row";

        const name = document.createElement("span");
        name.textContent = `${index + 1}. ${p.displayName || p.username || "Player"}`;

        const score = document.createElement("span");
        score.textContent = `${Math.floor(p.score || 0)} pts`;

        row.append(name, score);

        el.resultLeaderboard.appendChild(row);
    });
}

/* ============================================================
   FIRESTORE STATE UPDATES
   ============================================================ */

async function sendPlayerState(force = false) {
    if (!self || !localPlayerRef) return;

    if (stateWriteInFlight) return;

    if (!force && !gameStarted) return;

    stateWriteInFlight = true;

    try {
        await updateDoc(
            localPlayerRef,
            playerToFirestore(self)
        );
    } catch (error) {
        console.warn("Player state update failed:", error);
    } finally {
        stateWriteInFlight = false;
    }
}

/* ============================================================
   PARTICLES
   ============================================================ */

function spawnJumpParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 110,
            vy: -Math.random() * 100,
            life: 0.4 + Math.random() * 0.3,
            size: 2 + Math.random() * 3,
            color: "#54e8ff"
        });
    }
}

function spawnEliminationParticles(x, y) {
    for (let i = 0; i < 22; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 220,
            vy: (Math.random() - 0.8) * 220,
            life: 0.6 + Math.random() * 0.8,
            size: 3 + Math.random() * 5,
            color: Math.random() > 0.5 ? "#ff5a21" : "#ffca55"
        });
    }
}

function updateParticles(dt) {
    particles = particles.filter(p => p.life > 0);

    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.vy += 250 * dt;
        p.life -= dt;
    }
}

/* ============================================================
   DRAWING
   ============================================================ */

function drawScene() {
    if (!ctx) return;

    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    drawSky();
    drawMountains();
    drawLavaBackground();
    drawRoad();
    drawLavaEvents();
    drawOtherPlayers();

    if (self) {
        drawLocalPlayer();
    }

    drawParticles();
    drawDifficultyIndicator();
}

function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);

    gradient.addColorStop(0, "#050817");
    gradient.addColorStop(0.45, "#11152a");
    gradient.addColorStop(1, "#31151a");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (let i = 0; i < 48; i++) {
        const x = (i * 79 + 23) % WORLD_WIDTH;
        const y = (i * 43 + 15) % 240;

        ctx.globalAlpha = 0.25 + ((i % 4) * 0.16);
        ctx.fillStyle = "#ffffff";

        ctx.beginPath();
        ctx.arc(x, y, i % 5 === 0 ? 1.8 : 1, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

function drawMountains() {
    ctx.fillStyle = "#171a2a";

    ctx.beginPath();
    ctx.moveTo(0, 290);

    for (let x = 0; x <= WORLD_WIDTH; x += 35) {
        const y = 180 + Math.abs(Math.sin(x * 0.035)) * 80;
        ctx.lineTo(x, y);
    }

    ctx.lineTo(WORLD_WIDTH, 400);
    ctx.lineTo(0, 400);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#252033";

    ctx.beginPath();
    ctx.moveTo(0, 330);

    for (let x = 0; x <= WORLD_WIDTH; x += 28) {
        const y = 235 + Math.abs(Math.cos(x * 0.025)) * 70;
        ctx.lineTo(x, y);
    }

    ctx.lineTo(WORLD_WIDTH, 430);
    ctx.lineTo(0, 430);
    ctx.closePath();
    ctx.fill();
}

function drawLavaBackground() {
    const gradient = ctx.createLinearGradient(0, 300, 0, WORLD_HEIGHT);

    gradient.addColorStop(0, "#4b191a");
    gradient.addColorStop(0.5, "#e33d16");
    gradient.addColorStop(1, "#ff9c22");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 300, WORLD_WIDTH, WORLD_HEIGHT - 300);

    ctx.globalAlpha = 0.4;

    for (let i = 0; i < 14; i++) {
        const x = (i * 41 + gameElapsed * (8 + i % 5)) % WORLD_WIDTH;
        const y = 335 + ((i * 59 + gameElapsed * 18) % 330);

        ctx.fillStyle = i % 2 ? "#ffb12d" : "#ff5426";

        ctx.beginPath();
        ctx.ellipse(
            x,
            y,
            8 + (i % 5) * 2,
            3 + (i % 3),
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

function drawRoad() {
    const top = 275;
    const bottom = WORLD_HEIGHT;

    ctx.beginPath();
    ctx.moveTo(WORLD_WIDTH / 2 - 20, top);
    ctx.lineTo(WORLD_WIDTH / 2 + 20, top);
    ctx.lineTo(WORLD_WIDTH / 2 + 166, bottom);
    ctx.lineTo(WORLD_WIDTH / 2 - 166, bottom);
    ctx.closePath();

    const roadGradient = ctx.createLinearGradient(0, top, 0, bottom);

    roadGradient.addColorStop(0, "#343748");
    roadGradient.addColorStop(1, "#141927");

    ctx.fillStyle = roadGradient;
    ctx.fill();

    ctx.strokeStyle = "#ff652f";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(WORLD_WIDTH / 2 - 20, top);
    ctx.lineTo(WORLD_WIDTH / 2 - 166, bottom);
    ctx.moveTo(WORLD_WIDTH / 2 + 20, top);
    ctx.lineTo(WORLD_WIDTH / 2 + 166, bottom);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(WORLD_WIDTH / 2, top);
    ctx.lineTo(WORLD_WIDTH / 2, bottom);
    ctx.stroke();
}

function drawLavaEvents() {
    for (const lava of lavaEvents) {
        const road = getRoadBoundsAtY(lava.y);

        const left = Math.max(road.left, lava.left);
        const right = Math.min(road.right, lava.right);

        if (right <= left) continue;

        const gradient = ctx.createLinearGradient(
            0,
            lava.y - lava.height,
            0,
            lava.y
        );

        gradient.addColorStop(0, "#fff16a");
        gradient.addColorStop(0.35, "#ff8a21");
        gradient.addColorStop(1, "#ff321b");

        ctx.save();

        ctx.shadowColor = "#ff5a20";
        ctx.shadowBlur = 14;

        ctx.fillStyle = gradient;
        ctx.fillRect(
            left,
            lava.y - lava.height,
            right - left,
            lava.height
        );

        ctx.restore();

        ctx.strokeStyle = "#ffd65a";
        ctx.lineWidth = 2;

        ctx.beginPath();

        for (let x = left; x <= right; x += 12) {
            const waveY =
                lava.y - lava.height +
                Math.sin(x * 0.09 + gameElapsed * 5) * 3;

            if (x === left) {
                ctx.moveTo(x, waveY);
            } else {
                ctx.lineTo(x, waveY);
            }
        }

        ctx.stroke();
    }
}

function drawOtherPlayers() {
    for (const p of players.values()) {
        if (p.uid === currentUser?.uid) continue;
        if (p.alive === false) continue;

        drawRunner(
            p.renderedX ?? p.x,
            p.renderedY ?? p.y,
            p.color || "#ffca55",
            p.displayName || p.username || "Player",
            false
        );
    }
}

function drawLocalPlayer() {
    if (!self) return;

    if (!self.alive) {
        ctx.globalAlpha = 0.35;
    }

    drawRunner(
        self.x,
        self.y,
        self.color || "#54e8ff",
        "YOU",
        self.jumping
    );

    ctx.globalAlpha = 1;
}

function drawRunner(x, y, color, label, jumping) {
    const left = x - PLAYER_WIDTH / 2;

    ctx.save();

    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Legs
    ctx.fillStyle = "#171827";

    const legOffset = jumping
        ? Math.sin(gameElapsed * 14) * 3
        : Math.sin(gameElapsed * 13 + x) * 3;

    ctx.fillRect(left + 4, y + 29, 7, 13 + legOffset);
    ctx.fillRect(left + 15, y + 29, 7, 13 - legOffset);

    // Body
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.roundRect(
        left + 2,
        y + 12,
        PLAYER_WIDTH - 4,
        23,
        5
    );
    ctx.fill();

    // Head
    ctx.fillStyle = "#ffd7b0";

    ctx.beginPath();
    ctx.arc(x, y + 7, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hair / helmet
    ctx.fillStyle = "#171827";

    ctx.beginPath();
    ctx.arc(x, y + 5, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";

    ctx.fillText(label.slice(0, 13), x, y - 8);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(
            0,
            Math.min(1, p.life)
        );

        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

function drawDifficultyIndicator() {
    const difficulty = getLavaDifficulty(gameElapsed);

    const level = Math.min(
        10,
        Math.floor((difficulty.speed - 195) / 28) + 1
    );

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, 12, 150, 35);

    ctx.fillStyle = "#ffb443";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";

    ctx.fillText(`LAVA LEVEL ${level}`, 21, 27);

    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";

    ctx.fillText(
        `Speed ${Math.round(difficulty.speed)}`,
        21,
        39
    );
}

/* ============================================================
   KEYBOARD CONTROLS
   ============================================================ */

window.addEventListener("keydown", event => {
    const key = event.key === " " ? " " : event.key;

    if ([
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        " "
    ].includes(key)) {
        event.preventDefault();
    }

    pressedKeys.add(key);

    if (key.length === 1) {
        pressedKeys.add(key.toLowerCase());
    }
});

window.addEventListener("keyup", event => {
    pressedKeys.delete(event.key);

    if (event.key.length === 1) {
        pressedKeys.delete(event.key.toLowerCase());
    }
});

window.addEventListener("blur", () => {
    pressedKeys.clear();

    touchLeft = false;
    touchRight = false;
    touchJump = false;
});

/* ============================================================
   MOBILE TOUCH CONTROLS
   ============================================================ */

function bindHoldButton(button, onDown, onUp) {
    if (!button) return;

    button.addEventListener("pointerdown", event => {
        event.preventDefault();

        try {
            button.setPointerCapture(event.pointerId);
        } catch (_) {}

        onDown();
    });

    const release = event => {
        if (event) event.preventDefault();
        onUp();
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", event => {
        event.preventDefault();
    });
}

bindHoldButton(
    el.leftButton,
    () => { touchLeft = true; },
    () => { touchLeft = false; }
);

bindHoldButton(
    el.rightButton,
    () => { touchRight = true; },
    () => { touchRight = false; }
);

bindHoldButton(
    el.jumpButton,
    () => { touchJump = true; },
    () => { touchJump = false; }
);

/* ============================================================
   LEAVE ROOM
   ============================================================ */

async function leaveRoom() {
    if (!roomId) {
        showLobby();
        return;
    }

    const oldRoomId = roomId;
    const oldRoomRef = roomRef;
    const oldPlayerRef = localPlayerRef;
    const oldRoomData = roomData;

    try {
        if (oldPlayerRef) {
            await deleteDoc(oldPlayerRef);
        }

        if (
            oldRoomRef &&
            oldRoomData?.hostUid === currentUser?.uid &&
            oldRoomData?.status === "waiting"
        ) {
            await updateDoc(oldRoomRef, {
                status: "finished",
                winnerUid: null
            });
        } else if (oldRoomRef) {
            const remaining = await getDocs(
                collection(db, "gameRooms", oldRoomId, "players")
            );

            await updateDoc(oldRoomRef, {
                playersCount: remaining.size
            });
        }

    } catch (error) {
        console.warn("Leave room error:", error);
    }

    await resetLocalRoom(true);
}

/* ============================================================
   RESET LOCAL ROOM STATE
   ============================================================ */

async function resetLocalRoom(returnToLobby = true) {
    if (roomUnsubscribe) {
        roomUnsubscribe();
        roomUnsubscribe = null;
    }

    if (playersUnsubscribe) {
        playersUnsubscribe();
        playersUnsubscribe = null;
    }

    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }

    roomId = null;
    roomCode = null;
    roomData = null;

    roomRef = null;
    playersRef = null;
    localPlayerRef = null;

    self = null;
    players.clear();

    gameStarted = false;
    gameFinished = false;
    gameElapsed = 0;
    gameStartTime = 0;

    finishingGame = false;
    resultRecorded = false;
    stateWriteInFlight = false;

    hitLavaIds.clear();
    lavaEvents = [];
    particles = [];

    pressedKeys.clear();

    touchLeft = false;
    touchRight = false;
    touchJump = false;

    jumpWasPressed = false;

    seenMessageIds.clear();
    unreadMessages = 0;

    hideCountdown();
    hideWaiting();
    hideMessage();
    hideElement(el.winnerOverlay);

    setButtonDisabled(el.readyButton, false);

    if (returnToLobby) {
        showLobby();
        setLobbyStatus("Create a room or find a match.");
    }
}

/* ============================================================
   RETURN TO LOBBY
   ============================================================ */

if (el.returnLobbyButton) {
    el.returnLobbyButton.addEventListener("click", async () => {
        await leaveRoom();
    });
}

/* ============================================================
   BUTTON EVENTS
   ============================================================ */

if (el.createRoomButton) {
    el.createRoomButton.addEventListener("click", createRoom);
}

if (el.quickMatchButton) {
    el.quickMatchButton.addEventListener("click", quickMatch);
}

if (el.joinRoomButton) {
    el.joinRoomButton.addEventListener("click", joinRoomByCode);
}

if (el.readyButton) {
    el.readyButton.addEventListener("click", toggleReady);
}

if (el.leaveButton) {
    el.leaveButton.addEventListener("click", leaveRoom);
}

if (el.roomInput) {
    el.roomInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            joinRoomByCode();
        }
    });
}

/* ============================================================
   OPTIONAL ROOM CHAT
   Collection: gameRooms/{roomId}/messages
   ============================================================ */

function subscribeToChat(renderMessages) {
    if (!roomId || typeof renderMessages !== "function") return;

    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    const messagesRef = collection(
        db,
        "gameRooms",
        roomId,
        "messages"
    );

    chatUnsubscribe = onSnapshot(
        messagesRef,
        snapshot => {
            const messages = snapshot.docs
                .map(d => ({
                    id: d.id,
                    ...d.data()
                }))
                .sort((a, b) => {
                    const ta = Number(a.createdAt || 0);
                    const tb = Number(b.createdAt || 0);

                    return ta - tb;
                });

            for (const message of messages) {
                if (seenMessageIds.has(message.id)) continue;

                seenMessageIds.add(message.id);

                if (
                    message.uid !== currentUser?.uid &&
                    !chatPanelOpen
                ) {
                    unreadMessages++;
                }
            }

            renderMessages(messages, unreadMessages);
        },
        error => {
            console.warn("Chat listener error:", error);
        }
    );
}

async function sendRoomChatMessage(text) {
    if (!roomId || !currentUser) return;

    const message = String(text || "").trim();

    if (!message) return;

    if (message.length > 500) {
        throw new Error("Message is too long.");
    }

    await addDoc(
        collection(db, "gameRooms", roomId, "messages"),
        {
            uid: currentUser.uid,

            displayName:
                currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "Player",

            text: message,

            createdAt: Date.now(),
            serverCreatedAt: serverTimestamp()
        }
    );
}

function setChatPanelOpen(isOpen) {
    chatPanelOpen = !!isOpen;

    if (chatPanelOpen) {
        unreadMessages = 0;
    }
}

/* ============================================================
   AUTHENTICATION
   ============================================================ */

onAuthStateChanged(auth, user => {
    currentUser = user;

    if (!user) {
        if (!roomId) {
            setLobbyStatus("Sign in to play Volcano Jump.");
        }

        return;
    }

    if (!roomId) {
        setLobbyStatus("Ready to play Volcano Jump!");
    }
});

/* ============================================================
   PUBLIC GAME HELPERS
   ============================================================ */

window.VitalStarVolcanoJump = {
    createRoom,
    quickMatch,
    joinRoomByCode,
    leaveRoom,

    toggleReady,

    subscribeToChat,
    sendRoomChatMessage,
    setChatPanelOpen,

    getState() {
        return {
            roomId,
            roomCode,
            gameStarted,
            gameFinished,
            gameElapsed,

            players: [...players.values()].map(p => ({
                uid: p.uid,
                displayName: p.displayName,
                alive: p.alive,
                score: p.score
            }))
        };
    }
};

/* ============================================================
   INITIALIZATION
   ============================================================ */

showLobby();

hideCountdown();
hideWaiting();
hideMessage();
hideElement(el.winnerOverlay);

setLobbyStatus("Ready to play Volcano Jump!");

console.log("VitalStar Volcano Jump initialized.");
