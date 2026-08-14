import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    serverTimestamp,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// GAME CATALOG
// ============================================================

const games = [

    {
        id: "quick-tap",
        name: "Quick Tap",
        icon: "⚡",
        description: "Challenge another player in a fast tapping battle.",
        category: "arcade",
        multiplayer: true,
        premium: false,
        url: "quick-tap.html"
    },

    {
        id: "memory-master",
        name: "Memory Master",
        icon: "🧠",
        description: "Remember the cards and beat your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: false
    },

    {
        id: "brain-rush",
        name: "Brain Rush",
        icon: "🧩",
        description: "Solve quick puzzles before the timer ends.",
        category: "puzzle",
        multiplayer: false,
        premium: false
    },

    {
        id: "hoop-master",
        name: "Hoop Master",
        icon: "🏀",
        description: "Compete for the highest virtual score.",
        category: "sports",
        multiplayer: true,
        premium: false
    },

    {
        id: "word-sprint",
        name: "Word Sprint",
        icon: "🔤",
        description: "Find words faster than your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: false
    },

    {
        id: "target-master",
        name: "Target Master",
        icon: "🎯",
        description: "Hit targets and beat your opponent.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "paddle-smash",
        name: "Paddle Smash",
        icon: "🏓",
        description: "A fast two-player paddle battle.",
        category: "sports",
        multiplayer: true,
        premium: true
    },

    {
        id: "quiz-battle",
        name: "Quiz Battle",
        icon: "🏆",
        description: "Challenge other players in a quiz battle.",
        category: "quiz",
        multiplayer: true,
        premium: true
    },

    {
        id: "trivia-battle",
        name: "Trivia Battle",
        icon: "⚔️",
        description: "Test your knowledge against other players.",
        category: "quiz",
        multiplayer: true,
        premium: true
    },

    {
        id: "shape-match",
        name: "Shape Match",
        icon: "🔷",
        description: "Match shapes faster than your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-runner",
        name: "Star Runner Race",
        icon: "🚀",
        description: "Race other players through the stars.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "puzzle-battle",
        name: "Puzzle Battle",
        icon: "🧩",
        description: "Solve puzzles head-to-head.",
        category: "puzzle",
        multiplayer: true,
        premium: true
    },

    {
        id: "galaxy-quest",
        name: "Galaxy Quest",
        icon: "🌌",
        description: "Explore a multiplayer galaxy adventure.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-explorer",
        name: "Star Explorer",
        icon: "🗺️",
        description: "Explore new worlds with other players.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "castle-quest",
        name: "Castle Quest",
        icon: "🏰",
        description: "Complete challenges in a fantasy world.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "robot-run",
        name: "Robot Run",
        icon: "🤖",
        description: "Run, dodge and compete for the highest score.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "dragon-quest",
        name: "Dragon Quest",
        icon: "🐉",
        description: "Embark on an exciting multiplayer adventure.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "space-defender",
        name: "Space Defender",
        icon: "🛸",
        description: "Defend your base against incoming challenges.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "gravity-flip",
        name: "Gravity Flip",
        icon: "🌀",
        description: "Master gravity and beat your opponent.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "color-rush",
        name: "Color Rush",
        icon: "🟣",
        description: "React quickly and match the correct colors.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "speed-challenge",
        name: "Speed Challenge",
        icon: "🏁",
        description: "Compete against players in rapid challenges.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "champion-challenge",
        name: "Champion Challenge",
        icon: "👑",
        description: "Take on increasingly difficult challenges.",
        category: "competition",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-tournament",
        name: "Star Tournament",
        icon: "🌟",
        description: "Compete in organized multiplayer tournaments.",
        category: "competition",
        multiplayer: true,
        premium: true
    },

    {
        id: "goal-rush",
        name: "Goal Rush",
        icon: "⚽",
        description: "Compete head-to-head in a football challenge.",
        category: "sports",
        multiplayer: true,
        premium: true
    },

    {
        id: "coin-clash",
        name: "Coin Clash",
        icon: "🪙",
        description: "Compete for virtual points in a quick challenge.",
        category: "arcade",
        multiplayer: true,
        premium: true
    }

];


// ============================================================
// STATE
// ============================================================

let currentUser = null;

let currentCategory = "all";
let searchText = "";

let isPremium = false;

let coins = 1000;

let myProfile = null;


// ============================================================
// DOM HELPERS
// ============================================================

const $ = id => document.getElementById(id);

const gamesGrid = $("gamesGrid");
const emptyMessage = $("emptyMessage");
const coinBalance = $("coinBalance");


// ============================================================
// LOCAL COINS
// ============================================================

function loadLocalCoins() {

    const saved =
        Number(localStorage.getItem("vitalstarCoins"));

    if (Number.isFinite(saved)) {

        coins = saved;

    } else {

        coins = 1000;

        localStorage.setItem(
            "vitalstarCoins",
            coins
        );

    }

    if (coinBalance) {

        coinBalance.textContent =
            coins.toLocaleString();

    }

}


function saveLocalCoins() {

    localStorage.setItem(
        "vitalstarCoins",
        String(coins)
    );

    if (coinBalance) {

        coinBalance.textContent =
            coins.toLocaleString();

    }

}


// ============================================================
// DEFAULT GAME PROFILE
// ============================================================

function createDefaultProfile(user) {

    return {

        uid: user.uid,

        displayName:
            user.displayName ||
            "VitalStar Player",

        username:
            user.email
            ? user.email.split("@")[0]
            : "player",

        photoURL:
            user.photoURL || "",

        gamesPlayed: 0,

        wins: 0,

        losses: 0,

        draws: 0,

        rating: 1000,

        totalCoins: coins,

        bestScore: 0,

        currentStreak: 0,

        bestStreak: 0,

        achievements: [],

        favoriteGame: "",

        lastPlayedGame: "",

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp()

    };

}


// ============================================================
// LOAD MY PROFILE
// ============================================================

async function loadMyProfile() {

    if (!currentUser) return;

    try {

        const profileRef =
            doc(
                db,
                "gameProfiles",
                currentUser.uid
            );

        const snapshot =
            await getDoc(profileRef);


        if (!snapshot.exists()) {

            const profile =
                createDefaultProfile(
                    currentUser
                );

            await setDoc(
                profileRef,
                profile
            );

            myProfile = profile;

        } else {

            myProfile =
                snapshot.data();

        }


        coins =
            Number(
                myProfile.totalCoins
            ) || coins;


        saveLocalCoins();

        renderMyProfile();

        checkAchievements();

    } catch (error) {

        console.error(
            "Could not load game profile:",
            error
        );

    }

}


// ============================================================
// RENDER MY PROFILE
// ============================================================

function renderMyProfile() {

    if (!myProfile) return;


    const name =
        myProfile.displayName ||
        myProfile.username ||
        "Player";


    const elements = {

        myGameName:
            name,

        myGameUsername:
            myProfile.username
            ? "@" + myProfile.username
            : "",

        myGamesPlayed:
            Number(myProfile.gamesPlayed || 0),

        myWins:
            Number(myProfile.wins || 0),

        myLosses:
            Number(myProfile.losses || 0),

        myRating:
            Number(myProfile.rating || 1000),

        myBestScore:
            Number(myProfile.bestScore || 0),

        myStreak:
            Number(myProfile.currentStreak || 0),

        myBestStreak:
            Number(myProfile.bestStreak || 0),

        myCoins:
            Number(myProfile.totalCoins || 0)

    };


    Object.entries(elements)
        .forEach(([id, value]) => {

            const element = $(id);

            if (element) {

                element.textContent =
                    Number.isFinite(value)
                    ? value.toLocaleString()
                    : value;

            }

        });


    const avatar =
        $("myGameAvatar");

    if (avatar) {

        if (myProfile.photoURL) {

            avatar.src =
                myProfile.photoURL;

        } else {

            avatar.src =
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(name);

        }

    }


    const winRate =
        myProfile.gamesPlayed > 0
        ? (
            myProfile.wins /
            myProfile.gamesPlayed *
            100
        )
        : 0;


    const winRateElement =
        $("myWinRate");

    if (winRateElement) {

        winRateElement.textContent =
            winRate.toFixed(1) + "%";

    }

}


// ============================================================
// RENDER GAMES
// ============================================================

function renderGames() {

    if (!gamesGrid) return;

    gamesGrid.innerHTML = "";


    const filtered =
        games.filter(game => {

            const matchesCategory =

                currentCategory === "all" ||

                (
                    currentCategory === "free" &&
                    !game.premium
                ) ||

                (
                    currentCategory === "premium" &&
                    game.premium
                ) ||

                (
                    currentCategory === "multiplayer" &&
                    game.multiplayer
                );


            const matchesSearch =

                game.name
                    .toLowerCase()
                    .includes(
                        searchText.toLowerCase()
                    );


            return (
                matchesCategory &&
                matchesSearch
            );

        });


    if (filtered.length === 0) {

        if (emptyMessage) {

            emptyMessage.style.display =
                "block";

        }

        return;

    }


    if (emptyMessage) {

        emptyMessage.style.display =
            "none";

    }


    filtered.forEach(game => {

        const card =
            document.createElement("div");


        card.className =
            "game" +
            (
                game.premium
                ? " locked"
                : ""
            );


        card.innerHTML = `

            ${
                game.premium
                ? `
                    <div class="lock">
                        🔒 PREMIUM
                    </div>
                `
                : ""
            }

            <div class="game-icon">
                ${game.icon}
            </div>

            <div class="badges">

                ${
                    game.premium
                    ? `
                        <span class="badge premium">
                            👑 PREMIUM
                        </span>
                    `
                    : `
                        <span class="badge">
                            🆓 FREE
                        </span>
                    `
                }

                ${
                    game.multiplayer
                    ? `
                        <span class="badge">
                            👥 MULTIPLAYER
                        </span>
                    `
                    : ""
                }

            </div>

            <h3>
                ${escapeHTML(game.name)}
            </h3>

            <p>
                ${escapeHTML(game.description)}
            </p>

            <button class="play">

                ${
                    game.premium && !isPremium
                    ? "🔒 UNLOCK"
                    : "▶ PLAY"
                }

            </button>

        `;


        const button =
            card.querySelector(".play");


        if (button) {

            button.addEventListener(
                "click",
                () => launchGame(game)
            );

        }


        gamesGrid.appendChild(card);

    });

}


// ============================================================
// LAUNCH GAME
// ============================================================

function launchGame(game) {

    if (!currentUser) {

        alert(
            "Please log in to play VitalStar Games."
        );

        return;

    }


    if (
        game.premium &&
        !isPremium
    ) {

        openPremium();

        return;

    }


    if (game.url) {

        /*
         * Store the selected game so the
         * actual game page knows which game
         * the player launched.
         */

        sessionStorage.setItem(
            "vitalstarCurrentGame",
            game.id
        );


        window.location.href =
            game.url;

        return;

    }


    alert(
        `${game.name}\n\nThis game is coming next.`
    );

}


// ============================================================
// SEARCH
// ============================================================

const gameSearch =
    $("gameSearch");


if (gameSearch) {

    gameSearch.addEventListener(
        "input",
        event => {

            searchText =
                event.target.value;

            renderGames();

        }
    );

}


// ============================================================
// CATEGORY TABS
// ============================================================

document
    .querySelectorAll(".tab")
    .forEach(tab => {

        tab.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(".tab")
                    .forEach(item =>
                        item.classList
                            .remove("active")
                    );


                tab.classList.add("active");


                currentCategory =
                    tab.dataset.category ||
                    "all";


                renderGames();

            }
        );

    });


// ============================================================
// PREMIUM MODAL
// ============================================================

const premiumModal =
    $("premiumModal");


function openPremium() {

    if (!premiumModal) return;

    premiumModal.style.display =
        "flex";

}


function closePremium() {

    if (!premiumModal) return;

    premiumModal.style.display =
        "none";

}


const premiumButton =
    $("premiumButton");


if (premiumButton) {

    premiumButton.addEventListener(
        "click",
        openPremium
    );

}


const premiumTopButton =
    $("premiumTopButton");


if (premiumTopButton) {

    premiumTopButton.addEventListener(
        "click",
        openPremium
    );

}


const closePremiumButton =
    $("closePremium");


if (closePremiumButton) {

    closePremiumButton.addEventListener(
        "click",
        closePremium
    );

}


if (premiumModal) {

    premiumModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                premiumModal
            ) {

                closePremium();

            }

        }
    );

}


// ============================================================
// SUBSCRIPTION
// ============================================================

const subscribeButton =
    $("subscribeButton");


if (subscribeButton) {

    subscribeButton.addEventListener(
        "click",
        () => {

            alert(
                "Premium payment will be connected next."
            );

        }
    );

}


// ============================================================
// TOP 10 WINNERS
// ============================================================

async function loadTopWinners() {

    const container =
        $("topWinners");


    if (!container) return;


    container.innerHTML =
        `
            <div class="loading">
                Loading top players...
            </div>
        `;


    try {

        const winnersQuery =
            query(
                collection(
                    db,
                    "gameProfiles"
                ),
                orderBy(
                    "wins",
                    "desc"
                ),
                limit(10)
            );


        const snapshot =
            await getDocs(
                winnersQuery
            );


        container.innerHTML = "";


        if (snapshot.empty) {

            container.innerHTML =
                `
                    <div class="empty">
                        No winners yet.
                    </div>
                `;

            return;

        }


        snapshot.docs.forEach(
            (item, index) => {

                const player =
                    item.data();


                container.appendChild(
                    createLeaderboardPlayer(
                        player,
                        index + 1
                    )
                );

            }
        );


    } catch (error) {

        console.error(
            "Top winners error:",
            error
        );


        container.innerHTML =
            `
                <div class="empty">
                    Unable to load leaderboard.
                </div>
            `;

    }

}


// ============================================================
// GLOBAL LEADERBOARD
// ============================================================

async function loadLeaderboard() {

    const container =
        $("leaderboard");


    if (!container) return;


    container.innerHTML =
        `
            <div class="loading">
                Loading leaderboard...
            </div>
        `;


    try {

        const leaderboardQuery =
            query(
                collection(
                    db,
                    "gameProfiles"
                ),
                orderBy(
                    "rating",
                    "desc"
                ),
                limit(100)
            );


        const snapshot =
            await getDocs(
                leaderboardQuery
            );


        container.innerHTML = "";


        if (snapshot.empty) {

            container.innerHTML =
                `
                    <div class="empty">
                        No players on the leaderboard yet.
                    </div>
                `;

            return;

        }


        snapshot.docs.forEach(
            (item, index) => {

                container.appendChild(
                    createLeaderboardPlayer(
                        item.data(),
                        index + 1
                    )
                );

            }
        );


    } catch (error) {

        console.error(
            "Leaderboard error:",
            error
        );


        container.innerHTML =
            `
                <div class="empty">
                    Unable to load leaderboard.
                </div>
            `;

    }

}


// ============================================================
// LEADERBOARD PLAYER CARD
// ============================================================

function createLeaderboardPlayer(
    player,
    rank
) {

    const element =
        document.createElement("div");


    element.className =
        "leaderboard-player";


    const name =
        player.displayName ||
        player.username ||
        "Player";


    let medal = "";


    if (rank === 1) medal = "🥇";
    else if (rank === 2) medal = "🥈";
    else if (rank === 3) medal = "🥉";
    else medal = `#${rank}`;


    element.innerHTML = `

        <div class="leader-rank">
            ${medal}
        </div>

        <img
            class="leader-avatar"
            src="${
                player.photoURL ||
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(name)
            }"
            alt=""
        >

        <div class="leader-info">

            <strong>
                ${escapeHTML(name)}
            </strong>

            ${
                player.username
                ? `
                    <small>
                        @${escapeHTML(
                            player.username
                        )}
                    </small>
                `
                : ""
            }

        </div>

        <div class="leader-stats">

            <strong>
                ${Number(
                    player.wins || 0
                ).toLocaleString()}
            </strong>

            <small>
                Wins
            </small>

        </div>

        <div class="leader-rating">

            ⭐ ${
                Number(
                    player.rating || 1000
                ).toLocaleString()
            }

        </div>

    `;


    element.addEventListener(
        "click",
        () => {

            openPlayerProfile(
                player.uid
            );

        }
    );


    return element;

}


// ============================================================
// PLAYER PROFILE
// ============================================================

async function openPlayerProfile(uid) {

    if (!uid) return;


    try {

        const profileSnapshot =
            await getDoc(
                doc(
                    db,
                    "gameProfiles",
                    uid
                )
            );


        if (!profileSnapshot.exists()) {

            alert(
                "Player profile not found."
            );

            return;

        }


        const player =
            profileSnapshot.data();


        const name =
            player.displayName ||
            player.username ||
            "Player";


        const gamesPlayed =
            Number(
                player.gamesPlayed || 0
            );


        const wins =
            Number(
                player.wins || 0
            );


        const losses =
            Number(
                player.losses || 0
            );


        const winRate =
            gamesPlayed > 0
            ? (
                wins /
                gamesPlayed *
                100
            ).toFixed(1)
            : "0.0";


        const modal =
            $("playerProfileModal");


        if (!modal) {

            alert(
                `${name}\n\n` +
                `🏆 Wins: ${wins}\n` +
                `🎮 Games: ${gamesPlayed}\n` +
                `📉 Losses: ${losses}\n` +
                `📊 Win Rate: ${winRate}%\n` +
                `⭐ Rating: ${player.rating || 1000}`
            );

            return;

        }


        modal.style.display =
            "flex";


        setText(
            "profilePlayerName",
            name
        );


        setText(
            "profilePlayerUsername",
            player.username
                ? "@" + player.username
                : ""
        );


        setText(
            "profileGamesPlayed",
            gamesPlayed
        );


        setText(
            "profileWins",
            wins
        );


        setText(
            "profileLosses",
            losses
        );


        setText(
            "profileWinRate",
            winRate + "%"
        );


        setText(
            "profileRating",
            Number(
                player.rating || 1000
            ).toLocaleString()
        );


        setText(
            "profileBestScore",
            Number(
                player.bestScore || 0
            ).toLocaleString()
        );


        setText(
            "profileStreak",
            Number(
                player.bestStreak || 0
            )
        );


        const image =
            $("profilePlayerAvatar");


        if (image) {

            image.src =
                player.photoURL ||
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(name);

        }


    } catch (error) {

        console.error(
            "Player profile error:",
            error
        );

    }

}


// ============================================================
// CLOSE PLAYER PROFILE
// ============================================================

const closePlayerProfile =
    $("closePlayerProfile");


if (closePlayerProfile) {

    closePlayerProfile.addEventListener(
        "click",
        () => {

            const modal =
                $("playerProfileModal");

            if (modal) {

                modal.style.display =
                    "none";

            }

        }
    );

}


// ============================================================
// SEARCH PLAYERS
// ============================================================

const playerSearch =
    $("playerSearch");


if (playerSearch) {

    playerSearch.addEventListener(
        "input",
        async event => {

            const text =
                event.target.value
                    .trim()
                    .toLowerCase();


            const container =
                $("playerSearchResults");


            if (!container) return;


            if (!text) {

                container.innerHTML =
                    "";

                return;

            }


            container.innerHTML =
                `
                    <div class="loading">
                        Searching...
                    </div>
                `;


            try {

                /*
                 * Username searches work best if
                 * usernames are stored lowercase.
                 */

                const q =
                    query(
                        collection(
                            db,
                            "gameProfiles"
                        ),
                        where(
                            "username",
                            ">=",
                            text
                        ),
                        where(
                            "username",
                            "<=",
                            text + "\uf8ff"
                        ),
                        limit(10)
                    );


                const snapshot =
                    await getDocs(q);


                container.innerHTML = "";


                snapshot.docs.forEach(
                    item => {

                        const player =
                            item.data();


                        container.appendChild(
                            createLeaderboardPlayer(
                                player,
                                ""
                            )
                        );

                    }
                );


                if (snapshot.empty) {

                    container.innerHTML =
                        `
                            <div class="empty">
                                No players found.
                            </div>
                        `;

                }


            } catch (error) {

                console.error(
                    "Player search error:",
                    error
                );


                container.innerHTML =
                    `
                        <div class="empty">
                            Search unavailable.
                        </div>
                    `;

            }

        }
    );

}


// ============================================================
// RECORD GAME RESULT
// ============================================================

/*
 * Call this function from your actual game
 * when a match is completed.
 *
 * Example:
 *
 * await recordGameResult(
 *     "quick-tap",
 *     "win",
 *     250,
 *     50
 * );
 */

export async function recordGameResult(
    gameId,
    result,
    score = 0,
    coinReward = 0
) {

    if (!currentUser) {

        console.warn(
            "Cannot record game without login."
        );

        return;

    }


    if (
        !["win", "loss", "draw"].includes(
            result
        )
    ) {

        console.error(
            "Invalid game result."
        );

        return;

    }


    const profileRef =
        doc(
            db,
            "gameProfiles",
            currentUser.uid
        );


    const gameStatsRef =
        doc(
            db,
            "gameProfiles",
            currentUser.uid,
            "gameStats",
            gameId
        );


    try {

        const profileSnapshot =
            await getDoc(profileRef);


        if (!profileSnapshot.exists()) {

            await loadMyProfile();

        }


        const current =
            myProfile || {};


        let wins =
            Number(current.wins || 0);


        let losses =
            Number(current.losses || 0);


        let draws =
            Number(current.draws || 0);


        let gamesPlayed =
            Number(
                current.gamesPlayed || 0
            );


        let streak =
            Number(
                current.currentStreak || 0
            );


        let bestStreak =
            Number(
                current.bestStreak || 0
            );


        let rating =
            Number(
                current.rating || 1000
            );


        gamesPlayed++;


        if (result === "win") {

            wins++;

            streak++;

            if (streak > bestStreak) {

                bestStreak =
                    streak;

            }

            rating += 25;

        }


        if (result === "loss") {

            losses++;

            streak = 0;

            rating =
                Math.max(
                    0,
                    rating - 15
                );

        }


        if (result === "draw") {

            draws++;

            rating += 5;

        }


        const oldBestScore =
            Number(
                current.bestScore || 0
            );


        const newBestScore =
            Math.max(
                oldBestScore,
                Number(score) || 0
            );


        const newCoins =
            Math.max(
                0,
                Number(
                    current.totalCoins ||
                    coins
                ) +
                Number(coinReward || 0)
            );


        const updates = {

            gamesPlayed,

            wins,

            losses,

            draws,

            rating,

            currentStreak:
                streak,

            bestStreak,

            bestScore:
                newBestScore,

            totalCoins:
                newCoins,

            lastPlayedGame:
                gameId,

            updatedAt:
                serverTimestamp()

        };


        await updateDoc(
            profileRef,
            updates
        );


        await setDoc(
            gameStatsRef,
            {

                gameId,

                gamesPlayed:
                    increment(1),

                ...(result === "win"
                    ? {
                        wins:
                            increment(1)
                    }
                    : {}),

                ...(result === "loss"
                    ? {
                        losses:
                            increment(1)
                    }
                    : {}),

                ...(result === "draw"
                    ? {
                        draws:
                            increment(1)
                    }
                    : {}),

                bestScore:
                    newBestScore,

                lastResult:
                    result,

                updatedAt:
                    serverTimestamp()

            },
            {
                merge: true
            }
        );


        await setDoc(
            doc(
                db,
                "gameProfiles",
                currentUser.uid,
                "history",
                `${Date.now()}`
            ),
            {

                gameId,

                result,

                score:
                    Number(score) || 0,

                coins:
                    Number(coinReward) || 0,

                createdAt:
                    serverTimestamp()

            }
        );


        coins =
            newCoins;


        saveLocalCoins();


        await loadMyProfile();


        await checkAchievements();


        console.log(
            "Game result recorded:",
            gameId,
            result
        );


        return true;


    } catch (error) {

        console.error(
            "Could not record game result:",
            error
        );

        return false;

    }

}


// ============================================================
// LOAD GAME HISTORY
// ============================================================

async function loadGameHistory() {

    if (!currentUser) return;


    const container =
        $("gameHistory");


    if (!container) return;


    container.innerHTML =
        `
            <div class="loading">
                Loading game history...
            </div>
        `;


    try {

        const historyQuery =
            query(
                collection(
                    db,
                    "gameProfiles",
                    currentUser.uid,
                    "history"
                ),
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(20)
            );


        const snapshot =
            await getDocs(
                historyQuery
            );


        container.innerHTML = "";


        snapshot.docs.forEach(
            item => {

                const match =
                    item.data();


                const game =
                    games.find(
                        g =>
                            g.id ===
                            match.gameId
                    );


                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "game-history-item";


                row.innerHTML = `

                    <div class="history-icon">
                        ${
                            game
                            ? game.icon
                            : "🎮"
                        }
                    </div>

                    <div class="history-info">

                        <strong>
                            ${
                                game
                                ? escapeHTML(
                                    game.name
                                )
                                : escapeHTML(
                                    match.gameId ||
                                    "Game"
                                )
                            }
                        </strong>

                        <small>
                            Score:
                            ${Number(
                                match.score || 0
                            ).toLocaleString()}
                        </small>

                    </div>

                    <div class="
                        history-result
                        ${
                            match.result === "win"
                            ? "win"
                            : match.result === "loss"
                            ? "loss"
                            : "draw"
                        }
                    ">

                        ${
                            match.result === "win"
                            ? "🏆 WIN"
                            : match.result === "loss"
                            ? "❌ LOSS"
                            : "🤝 DRAW"
                        }

                    </div>

                `;


                container.appendChild(row);

            }
        );


        if (snapshot.empty) {

            container.innerHTML =
                `
                    <div class="empty">
                        You haven't played any games yet.
                    </div>
                `;

        }


    } catch (error) {

        console.error(
            "Game history error:",
            error
        );


        container.innerHTML =
            `
                <div class="empty">
                    Unable to load game history.
                </div>
            `;

    }

}


// ============================================================
// ACHIEVEMENTS
// ============================================================

const ACHIEVEMENTS = [

    {
        id: "first-win",
        icon: "🏆",
        name: "First Victory",
        description: "Win your first game.",
        condition: p =>
            Number(p.wins || 0) >= 1
    },

    {
        id: "five-wins",
        icon: "🔥",
        name: "Hot Streak",
        description: "Win 5 games.",
        condition: p =>
            Number(p.wins || 0) >= 5
    },

    {
        id: "ten-wins",
        icon: "⚡",
        name: "Winning Machine",
        description: "Win 10 games.",
        condition: p =>
            Number(p.wins || 0) >= 10
    },

    {
        id: "fifty-wins",
        icon: "👑",
        name: "Champion",
        description: "Win 50 games.",
        condition: p =>
            Number(p.wins || 0) >= 50
    },

    {
        id: "hundred-wins",
        icon: "💎",
        name: "Legend",
        description: "Win 100 games.",
        condition: p =>
            Number(p.wins || 0) >= 100
    },

    {
        id: "ten-games",
        icon: "🎮",
        name: "Gamer",
        description: "Play 10 games.",
        condition: p =>
            Number(p.gamesPlayed || 0) >= 10
    },

    {
        id: "hundred-games",
        icon: "🌟",
        name: "Veteran",
        description: "Play 100 games.",
        condition: p =>
            Number(p.gamesPlayed || 0) >= 100
    },

    {
        id: "five-streak",
        icon: "🔥",
        name: "Unstoppable",
        description: "Reach a 5-game winning streak.",
        condition: p =>
            Number(p.bestStreak || 0) >= 5
    }

];


// ============================================================
// CHECK ACHIEVEMENTS
// ============================================================

async function checkAchievements() {

    if (!currentUser || !myProfile) return;


    const earned =
        Array.isArray(
            myProfile.achievements
        )
        ? myProfile.achievements
        : [];


    const newlyEarned = [];


    ACHIEVEMENTS.forEach(
        achievement => {

            if (
                achievement.condition(
                    myProfile
                ) &&
                !earned.includes(
                    achievement.id
                )
            ) {

                earned.push(
                    achievement.id
                );

                newlyEarned.push(
                    achievement
                );

            }

        }
    );


    if (newlyEarned.length === 0) {

        renderAchievements(
            earned
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "gameProfiles",
                currentUser.uid
            ),
            {

                achievements:
                    earned,

                updatedAt:
                    serverTimestamp()

            }
        );


        myProfile.achievements =
            earned;


        renderAchievements(
            earned
        );


        newlyEarned.forEach(
            achievement => {

                showAchievementNotification(
                    achievement
                );

            }
        );


    } catch (error) {

        console.error(
            "Achievement error:",
            error
        );

    }

}


// ============================================================
// RENDER ACHIEVEMENTS
// ============================================================

function renderAchievements(
    earned = []
) {

    const container =
        $("achievements");


    if (!container) return;


    container.innerHTML = "";


    ACHIEVEMENTS.forEach(
        achievement => {

            const unlocked =
                earned.includes(
                    achievement.id
                );


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                unlocked
                ? "achievement unlocked"
                : "achievement locked";


            item.innerHTML = `

                <div class="achievement-icon">

                    ${
                        unlocked
                        ? achievement.icon
                        : "🔒"
                    }

                </div>

                <div>

                    <strong>
                        ${escapeHTML(
                            achievement.name
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            achievement.description
                        )}
                    </small>

                </div>

            `;


            container.appendChild(item);

        }
    );

}


// ============================================================
// ACHIEVEMENT NOTIFICATION
// ============================================================

function showAchievementNotification(
    achievement
) {

    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "achievement-notification";


    notification.innerHTML = `

        <div>
            ${achievement.icon}
        </div>

        <div>

            <strong>
                Achievement Unlocked!
            </strong>

            <span>
                ${escapeHTML(
                    achievement.name
                )}
            </span>

        </div>

    `;


    document.body.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        4000
    );

}


// ============================================================
// LOAD EVERYTHING
// ============================================================

async function loadGamesHub() {

    await loadMyProfile();

    await Promise.allSettled([

        loadTopWinners(),

        loadLeaderboard(),

        loadGameHistory()

    ]);


    renderAchievements(
        myProfile &&
        Array.isArray(
            myProfile.achievements
        )
        ? myProfile.achievements
        : []
    );

}


// ============================================================
// FIREBASE AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentUser = null;

            console.log(
                "User is not logged in."
            );

            renderGames();

            return;

        }


        currentUser =
            user;


        console.log(
            "Games user:",
            user.uid
        );


        /*
         * Premium status should eventually
         * come from a trusted server/payment
         * verification system.
         */


        await loadGamesHub();

    }
);


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function setText(
    id,
    value
) {

    const element =
        $(id);

    if (element) {

        element.textContent =
            value;

    }

}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


// ============================================================
// INITIAL LOAD
// ============================================================

loadLocalCoins();

renderGames();


// ============================================================
// GLOBAL ACCESS
// ============================================================

window.openPremium =
    openPremium;

window.closePremium =
    closePremium;

window.openPlayerProfile =
    openPlayerProfile;

window.loadLeaderboard =
    loadLeaderboard;

window.loadTopWinners =
    loadTopWinners;

window.loadGameHistory =
    loadGameHistory;

window.checkAchievements =
    checkAchievements;