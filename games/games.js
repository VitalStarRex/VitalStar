// ============================================================
// VITALSTAR GAMES HUB
// games/games.js
// ============================================================

import { auth, db } from "../firebase.js";

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
        id:"quick-tap",
        name:"Quick Tap",
        icon:"⚡",
        description:"Challenge another player in a fast tapping battle.",
        category:"arcade",
        multiplayer:true,
        premium:false,
        url:"./quick-tap.html"
    },

    {
        id:"memory-master",
        name:"Memory Master",
        icon:"🧠",
        description:"Remember the cards and beat your opponent.",
        category:"puzzle",
        multiplayer:true,
        premium:false,
        url:"./memory-master.html"
    },

    {
        id:"brain-rush",
        name:"Brain Rush",
        icon:"🧩",
        description:"Solve quick puzzles before the timer ends.",
        category:"puzzle",
        multiplayer:false,
        premium:false,
        url:"./brain-rush.html"
    },

    {
        id:"hoop-master",
        name:"Hoop Master",
        icon:"🏀",
        description:"Compete for the highest virtual score.",
        category:"sports",
        multiplayer:true,
        premium:false,
        url:"./hoop-master.html"
    },

    {
        id:"word-sprint",
        name:"Word Sprint",
        icon:"🔤",
        description:"Find words faster than your opponent.",
        category:"puzzle",
        multiplayer:true,
        premium:false,
        url:"./word-sprint.html"
    },

    {
        id:"target-master",
        name:"Target Master",
        icon:"🎯",
        description:"Hit targets and beat your opponent.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./target-master.html"
    },

    {
        id:"paddle-smash",
        name:"Paddle Smash",
        icon:"🏓",
        description:"A fast two-player paddle battle.",
        category:"sports",
        multiplayer:true,
        premium:true,
        url:"./paddle-smash.html"
    },

    {
        id:"quiz-battle",
        name:"Quiz Battle",
        icon:"🏆",
        description:"Challenge other players in a quiz battle.",
        category:"quiz",
        multiplayer:true,
        premium:true,
        url:"./quiz-battle.html"
    },

    {
        id:"trivia-battle",
        name:"Trivia Battle",
        icon:"⚔️",
        description:"Test your knowledge against other players.",
        category:"quiz",
        multiplayer:true,
        premium:true,
        url:"./trivia-battle.html"
    },

    {
        id:"shape-match",
        name:"Shape Match",
        icon:"🔷",
        description:"Match shapes faster than your opponent.",
        category:"puzzle",
        multiplayer:true,
        premium:true,
        url:"./shape-match.html"
    },

    {
        id:"star-runner",
        name:"Star Runner Race",
        icon:"🚀",
        description:"Race other players through the stars.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./star-runner.html"
    },

    {
        id:"puzzle-battle",
        name:"Puzzle Battle",
        icon:"🧩",
        description:"Solve puzzles head-to-head.",
        category:"puzzle",
        multiplayer:true,
        premium:true,
        url:"./puzzle-battle.html"
    },

    {
        id:"galaxy-quest",
        name:"Galaxy Quest",
        icon:"🌌",
        description:"Explore a multiplayer galaxy adventure.",
        category:"adventure",
        multiplayer:true,
        premium:true,
        url:"./galaxy-quest.html"
    },

    {
        id:"star-explorer",
        name:"Star Explorer",
        icon:"🗺️",
        description:"Explore new worlds with other players.",
        category:"adventure",
        multiplayer:true,
        premium:true,
        url:"./star-explorer.html"
    },

    {
        id:"castle-quest",
        name:"Castle Quest",
        icon:"🏰",
        description:"Complete challenges in a fantasy world.",
        category:"adventure",
        multiplayer:true,
        premium:true,
        url:"./castle-quest.html"
    },

    {
        id:"robot-run",
        name:"Robot Run",
        icon:"🤖",
        description:"Run, dodge and compete for the highest score.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./robot-run.html"
    },

    {
        id:"dragon-quest",
        name:"Dragon Quest",
        icon:"🐉",
        description:"Embark on an exciting multiplayer adventure.",
        category:"adventure",
        multiplayer:true,
        premium:true,
        url:"./dragon-quest.html"
    },

    {
        id:"space-defender",
        name:"Space Defender",
        icon:"🛸",
        description:"Defend your base against incoming challenges.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./space-defender.html"
    },

    {
        id:"gravity-flip",
        name:"Gravity Flip",
        icon:"🌀",
        description:"Master gravity and beat your opponent.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./gravity-flip.html"
    },

    {
        id:"color-rush",
        name:"Color Rush",
        icon:"🟣",
        description:"React quickly and match the correct colors.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./color-rush.html"
    },

    {
        id:"speed-challenge",
        name:"Speed Challenge",
        icon:"🏁",
        description:"Compete against players in rapid challenges.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./speed-challenge.html"
    },

    {
        id:"champion-challenge",
        name:"Champion Challenge",
        icon:"👑",
        description:"Take on increasingly difficult challenges.",
        category:"competition",
        multiplayer:true,
        premium:true,
        url:"./champion-challenge.html"
    },

    {
        id:"star-tournament",
        name:"Star Tournament",
        icon:"🌟",
        description:"Compete in organized multiplayer tournaments.",
        category:"competition",
        multiplayer:true,
        premium:true,
        url:"./star-tournament.html"
    },

    {
        id:"goal-rush",
        name:"Goal Rush",
        icon:"⚽",
        description:"Compete head-to-head in a football challenge.",
        category:"sports",
        multiplayer:true,
        premium:true,
        url:"./goal-rush.html"
    },

    {
        id:"coin-clash",
        name:"Coin Clash",
        icon:"🪙",
        description:"Compete for virtual points in a quick challenge.",
        category:"arcade",
        multiplayer:true,
        premium:true,
        url:"./coin-clash.html"
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
// DOM
// ============================================================

const $ = id => document.getElementById(id);

const gamesGrid = $("gamesGrid");
const emptyMessage = $("emptyMessage");
const coinBalance = $("coinBalance");


// ============================================================
// COINS
// ============================================================

function loadLocalCoins(){

    const saved =
        Number(localStorage.getItem("vitalstarCoins"));

    if(Number.isFinite(saved) && saved >= 0){

        coins = saved;

    }else{

        coins = 1000;

        localStorage.setItem(
            "vitalstarCoins",
            "1000"
        );

    }

    updateCoinUI();
}


function updateCoinUI(){

    if(coinBalance){

        coinBalance.textContent =
            coins.toLocaleString();

    }

    const myCoins = $("myCoins");

    if(myCoins){

        myCoins.textContent =
            coins.toLocaleString();

    }
}


function saveLocalCoins(){

    localStorage.setItem(
        "vitalstarCoins",
        String(coins)
    );

    updateCoinUI();
}


// ============================================================
// DEFAULT PROFILE
// ============================================================

function createDefaultProfile(user){

    const username =
        user.email
        ? user.email.split("@")[0].toLowerCase()
        : "player";

    return {

        uid:user.uid,

        displayName:
            user.displayName ||
            "VitalStar Player",

        username,

        photoURL:
            user.photoURL || "",

        gamesPlayed:0,
        wins:0,
        losses:0,
        draws:0,

        rating:1000,

        totalCoins:coins,

        bestScore:0,

        currentStreak:0,
        bestStreak:0,

        achievements:[],

        favoriteGame:"",
        lastPlayedGame:"",

        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()

    };

}


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadMyProfile(){

    if(!currentUser) return;

    try{

        const ref =
            doc(
                db,
                "gameProfiles",
                currentUser.uid
            );

        const snap =
            await getDoc(ref);

        if(!snap.exists()){

            myProfile =
                createDefaultProfile(
                    currentUser
                );

            await setDoc(
                ref,
                myProfile
            );

        }else{

            myProfile =
                snap.data();

        }

        coins =
            Number(myProfile.totalCoins);

        if(!Number.isFinite(coins)){

            coins = 1000;

        }

        saveLocalCoins();

        renderMyProfile();

        await checkAchievements();

    }catch(error){

        console.error(
            "Profile loading error:",
            error
        );

    }

}


// ============================================================
// MY PROFILE UI
// ============================================================

function renderMyProfile(){

    if(!myProfile) return;

    const name =
        myProfile.displayName ||
        myProfile.username ||
        "Player";

    setText(
        "myGameName",
        name
    );

    setText(
        "myGameUsername",
        myProfile.username
        ? "@" + myProfile.username
        : ""
    );

    setText(
        "myGamesPlayed",
        formatNumber(myProfile.gamesPlayed)
    );

    setText(
        "myWins",
        formatNumber(myProfile.wins)
    );

    setText(
        "myLosses",
        formatNumber(myProfile.losses)
    );

    setText(
        "myRating",
        formatNumber(
            myProfile.rating || 1000
        )
    );

    setText(
        "myBestScore",
        formatNumber(
            myProfile.bestScore
        )
    );

    setText(
        "myStreak",
        formatNumber(
            myProfile.currentStreak
        )
    );

    setText(
        "myBestStreak",
        formatNumber(
            myProfile.bestStreak
        )
    );

    setText(
        "myCoins",
        formatNumber(
            myProfile.totalCoins
        )
    );

    const gamesPlayed =
        Number(myProfile.gamesPlayed || 0);

    const wins =
        Number(myProfile.wins || 0);

    const rate =
        gamesPlayed > 0
        ? (wins / gamesPlayed) * 100
        : 0;

    setText(
        "myWinRate",
        rate.toFixed(1) + "%"
    );

    const avatar =
        $("myGameAvatar");

    if(avatar){

        avatar.src =
            myProfile.photoURL ||
            "https://ui-avatars.com/api/?name=" +
            encodeURIComponent(name);

    }

}


// ============================================================
// RENDER GAMES
// ============================================================

function renderGames(){

    if(!gamesGrid) return;

    gamesGrid.innerHTML = "";

    const text =
        searchText
        .trim()
        .toLowerCase();

    const filtered =
        games.filter(game => {

            let categoryOK = true;

            if(currentCategory === "free"){

                categoryOK =
                    !game.premium;

            }else if(currentCategory === "premium"){

                categoryOK =
                    game.premium;

            }else if(currentCategory === "multiplayer"){

                categoryOK =
                    game.multiplayer;

            }

            const searchOK =
                !text ||
                game.name
                    .toLowerCase()
                    .includes(text);

            return categoryOK && searchOK;

        });

    if(!filtered.length){

        if(emptyMessage){

            emptyMessage.style.display =
                "block";

        }

        return;

    }

    if(emptyMessage){

        emptyMessage.style.display =
            "none";

    }

    filtered.forEach(game => {

        const card =
            document.createElement("div");

        card.className =
            "game" +
            (
                game.premium && !isPremium
                ? " locked"
                : ""
            );

        card.innerHTML = `

            ${
                game.premium && !isPremium
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

        if(button){

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

function launchGame(game){

    if(!currentUser){

        alert(
            "Please log in to play VitalStar Games."
        );

        return;

    }

    if(game.premium && !isPremium){

        openPremium();

        return;

    }

    sessionStorage.setItem(
        "vitalstarCurrentGame",
        game.id
    );

    sessionStorage.setItem(
        "vitalstarGameName",
        game.name
    );

    if(game.url){

        window.location.href =
            game.url;

        return;

    }

    alert(
        game.name +
        "\n\nThis game is coming soon."
    );

}


// ============================================================
// GAME SEARCH
// ============================================================

const gameSearch =
    $("gameSearch");

if(gameSearch){

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
                item.classList.remove(
                    "active"
                )
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
// PREMIUM
// ============================================================

const premiumModal =
    $("premiumModal");

function openPremium(){

    if(premiumModal){

        premiumModal.style.display =
            "flex";

    }

}

function closePremium(){

    if(premiumModal){

        premiumModal.style.display =
            "none";

    }

}

const premiumButton =
    $("premiumButton");

if(premiumButton){

    premiumButton.addEventListener(
        "click",
        openPremium
    );

}

const premiumTopButton =
    $("premiumTopButton");

if(premiumTopButton){

    premiumTopButton.addEventListener(
        "click",
        openPremium
    );

}

const closePremiumButton =
    $("closePremium");

if(closePremiumButton){

    closePremiumButton.addEventListener(
        "click",
        closePremium
    );

}

if(premiumModal){

    premiumModal.addEventListener(
        "click",
        event => {

            if(event.target === premiumModal){

                closePremium();

            }

        }
    );

}

const subscribeButton =
    $("subscribeButton");

if(subscribeButton){

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

async function loadTopWinners(){

    const container =
        $("topWinners");

    if(!container) return;

    container.innerHTML =
        `<div class="loading">
            Loading top players...
        </div>`;

    try{

        const q =
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

        const snap =
            await getDocs(q);

        container.innerHTML = "";

        if(snap.empty){

            container.innerHTML =
                `<div class="empty"
                      style="display:block">
                    No winners yet.
                </div>`;

            return;

        }

        snap.docs.forEach(
            (item,index) => {

                container.appendChild(
                    createLeaderboardPlayer(
                        item.data(),
                        index + 1
                    )
                );

            }
        );

    }catch(error){

        console.error(
            "Top winners error:",
            error
        );

        container.innerHTML =
            `<div class="empty"
                  style="display:block">
                Unable to load top winners.
            </div>`;

    }

}


// ============================================================
// GLOBAL LEADERBOARD
// ============================================================

async function loadLeaderboard(){

    const container =
        $("leaderboard");

    if(!container) return;

    container.innerHTML =
        `<div class="loading">
            Loading leaderboard...
        </div>`;

    try{

        const q =
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

        const snap =
            await getDocs(q);

        container.innerHTML = "";

        if(snap.empty){

            container.innerHTML =
                `<div class="empty"
                      style="display:block">
                    No players yet.
                </div>`;

            return;

        }

        snap.docs.forEach(
            (item,index) => {

                container.appendChild(
                    createLeaderboardPlayer(
                        item.data(),
                        index + 1
                    )
                );

            }
        );

    }catch(error){

        console.error(
            "Leaderboard error:",
            error
        );

        container.innerHTML =
            `<div class="empty"
                  style="display:block">
                Unable to load leaderboard.
            </div>`;

    }

}


// ============================================================
// LEADERBOARD PLAYER
// ============================================================

function createLeaderboardPlayer(
    player,
    rank
){

    const element =
        document.createElement("div");

    element.className =
        "leaderboard-player";

    const name =
        player.displayName ||
        player.username ||
        "Player";

    let medal =
        rank === 1 ? "🥇" :
        rank === 2 ? "🥈" :
        rank === 3 ? "🥉" :
        rank
        ? "#" + rank
        : "👤";

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
                ${formatNumber(
                    player.wins
                )}
            </strong>

            <small>
                Wins
            </small>

        </div>

        <div class="leader-rating">

            ⭐ ${formatNumber(
                player.rating || 1000
            )}

        </div>

    `;

    if(player.uid){

        element.addEventListener(
            "click",
            () => openPlayerProfile(
                player.uid
            )
        );

    }

    return element;

}


// ============================================================
// PLAYER PROFILE
// ============================================================

async function openPlayerProfile(uid){

    if(!uid) return;

    try{

        const snap =
            await getDoc(
                doc(
                    db,
                    "gameProfiles",
                    uid
                )
            );

        if(!snap.exists()){

            alert(
                "Player profile not found."
            );

            return;

        }

        const player =
            snap.data();

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
            gamesPlayed
            ? (
                wins /
                gamesPlayed *
                100
            ).toFixed(1)
            : "0.0";

        const modal =
            $("playerProfileModal");

        if(!modal){

            alert(
                name +
                "\n\n" +
                "🏆 Wins: " + wins +
                "\n🎮 Games: " + gamesPlayed +
                "\n❌ Losses: " + losses +
                "\n📊 Win Rate: " + winRate + "%" +
                "\n⭐ Rating: " +
                (player.rating || 1000)
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
            formatNumber(gamesPlayed)
        );

        setText(
            "profileWins",
            formatNumber(wins)
        );

        setText(
            "profileLosses",
            formatNumber(losses)
        );

        setText(
            "profileWinRate",
            winRate + "%"
        );

        setText(
            "profileRating",
            formatNumber(
                player.rating || 1000
            )
        );

        setText(
            "profileBestScore",
            formatNumber(
                player.bestScore || 0
            )
        );

        setText(
            "profileStreak",
            formatNumber(
                player.bestStreak || 0
            )
        );

        const avatar =
            $("profilePlayerAvatar");

        if(avatar){

            avatar.src =
                player.photoURL ||
                "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(name);

        }

    }catch(error){

        console.error(
            "Player profile error:",
            error
        );

        alert(
            "Unable to open player profile."
        );

    }

}


// ============================================================
// CLOSE PLAYER PROFILE
// ============================================================

const closePlayerProfile =
    $("closePlayerProfile");

if(closePlayerProfile){

    closePlayerProfile.addEventListener(
        "click",
        () => {

            const modal =
                $("playerProfileModal");

            if(modal){

                modal.style.display =
                    "none";

            }

        }
    );

}

const playerProfileModal =
    $("playerProfileModal");

if(playerProfileModal){

    playerProfileModal.addEventListener(
        "click",
        event => {

            if(
                event.target ===
                playerProfileModal
            ){

                playerProfileModal.style.display =
                    "none";

            }

        }
    );

}


// ============================================================
// PLAYER SEARCH
// ============================================================

const playerSearch =
    $("playerSearch");

if(playerSearch){

    playerSearch.addEventListener(
        "input",
        async event => {

            const text =
                event.target.value
                .trim()
                .toLowerCase();

            const container =
                $("playerSearchResults");

            if(!container) return;

            if(!text){

                container.innerHTML =
                    "";

                return;

            }

            container.innerHTML =
                `<div class="loading">
                    Searching...
                </div>`;

            try{

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

                const snap =
                    await getDocs(q);

                container.innerHTML = "";

                if(snap.empty){

                    container.innerHTML =
                        `<div class="empty"
                              style="display:block">
                            No players found.
                        </div>`;

                    return;

                }

                snap.docs.forEach(
                    item => {

                        container.appendChild(
                            createLeaderboardPlayer(
                                item.data(),
                                ""
                            )
                        );

                    }
                );

            }catch(error){

                console.error(
                    "Player search error:",
                    error
                );

                container.innerHTML =
                    `<div class="empty"
                          style="display:block">
                        Search unavailable.
                    </div>`;

            }

        }
    );

}


// ============================================================
// RECORD GAME RESULT
// ============================================================

export async function recordGameResult(
    gameId,
    result,
    score = 0,
    coinReward = 0
){

    if(!currentUser){

        console.warn(
            "No authenticated player."
        );

        return false;

    }

    if(
        !["win","loss","draw"]
        .includes(result)
    ){

        console.error(
            "Invalid result:",
            result
        );

        return false;

    }

    try{

        const profileRef =
            doc(
                db,
                "gameProfiles",
                currentUser.uid
            );

        let snap =
            await getDoc(profileRef);

        if(!snap.exists()){

            await loadMyProfile();

            snap =
                await getDoc(profileRef);

        }

        const current =
            snap.exists()
            ? snap.data()
            : myProfile || {};

        let gamesPlayed =
            Number(current.gamesPlayed || 0);

        let wins =
            Number(current.wins || 0);

        let losses =
            Number(current.losses || 0);

        let draws =
            Number(current.draws || 0);

        let rating =
            Number(current.rating || 1000);

        let streak =
            Number(current.currentStreak || 0);

        let bestStreak =
            Number(current.bestStreak || 0);

        const oldBest =
            Number(current.bestScore || 0);

        const numericScore =
            Number(score) || 0;

        gamesPlayed++;

        if(result === "win"){

            wins++;
            streak++;

            bestStreak =
                Math.max(
                    bestStreak,
                    streak
                );

            rating += 25;

        }else if(result === "loss"){

            losses++;
            streak = 0;

            rating =
                Math.max(
                    0,
                    rating - 15
                );

        }else{

            draws++;

            rating += 5;

        }

        const reward =
            Math.max(
                0,
                Number(coinReward) || 0
            );

        const newCoins =
            Math.max(
                0,
                Number(
                    current.totalCoins
                ) || 0
            ) + reward;

        const bestScore =
            Math.max(
                oldBest,
                numericScore
            );

        await updateDoc(
            profileRef,
            {

                gamesPlayed,
                wins,
                losses,
                draws,

                rating,

                currentStreak:
                    streak,

                bestStreak,

                bestScore,

                totalCoins:
                    newCoins,

                lastPlayedGame:
                    gameId,

                updatedAt:
                    serverTimestamp()

            }
        );

        const statsRef =
            doc(
                db,
                "gameProfiles",
                currentUser.uid,
                "gameStats",
                gameId
            );

        const statUpdate = {

            gameId,

            gamesPlayed:
                increment(1),

            bestScore,

            lastResult:
                result,

            updatedAt:
                serverTimestamp()

        };

        if(result === "win"){

            statUpdate.wins =
                increment(1);

        }

        if(result === "loss"){

            statUpdate.losses =
                increment(1);

        }

        if(result === "draw"){

            statUpdate.draws =
                increment(1);

        }

        await setDoc(
            statsRef,
            statUpdate,
            { merge:true }
        );

        await setDoc(
            doc(
                db,
                "gameProfiles",
                currentUser.uid,
                "history",
                String(Date.now())
            ),
            {

                gameId,

                result,

                score:
                    numericScore,

                coins:
                    reward,

                createdAt:
                    serverTimestamp()

            }
        );

        coins =
            newCoins;

        saveLocalCoins();

        await loadMyProfile();

        await loadTopWinners();

        await loadLeaderboard();

        return true;

    }catch(error){

        console.error(
            "Could not record game result:",
            error
        );

        return false;

    }

}


// ============================================================
// GAME HISTORY
// ============================================================

async function loadGameHistory(){

    if(!currentUser) return;

    const container =
        $("gameHistory");

    if(!container) return;

    container.innerHTML =
        `<div class="loading">
            Loading game history...
        </div>`;

    try{

        const q =
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

        const snap =
            await getDocs(q);

        container.innerHTML = "";

        if(snap.empty){

            container.innerHTML =
                `<div class="empty"
                      style="display:block">
                    You haven't played any games yet.
                </div>`;

            return;

        }

        snap.docs.forEach(
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
                    document.createElement("div");

                row.className =
                    "game-history-item";

                const resultClass =
                    match.result === "win"
                    ? "win"
                    : match.result === "loss"
                    ? "loss"
                    : "draw";

                const resultText =
                    match.result === "win"
                    ? "🏆 WIN"
                    : match.result === "loss"
                    ? "❌ LOSS"
                    : "🤝 DRAW";

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
                                ? escapeHTML(game.name)
                                : escapeHTML(
                                    match.gameId ||
                                    "Game"
                                )
                            }
                        </strong>

                        <small>
                            Score:
                            ${formatNumber(
                                match.score
                            )}
                        </small>

                    </div>

                    <div class="
                        history-result
                        ${resultClass}
                    ">
                        ${resultText}
                    </div>
                `;

                container.appendChild(row);

            }
        );

    }catch(error){

        console.error(
            "Game history error:",
            error
        );

        container.innerHTML =
            `<div class="empty"
                  style="display:block">
                Unable to load game history.
            </div>`;

    }

}


// ============================================================
// ACHIEVEMENTS
// ============================================================

const ACHIEVEMENTS = [

    {
        id:"first-win",
        icon:"🏆",
        name:"First Victory",
        description:"Win your first game.",
        condition:p =>
            Number(p.wins || 0) >= 1
    },

    {
        id:"five-wins",
        icon:"🔥",
        name:"Hot Streak",
        description:"Win 5 games.",
        condition:p =>
            Number(p.wins || 0) >= 5
    },

    {
        id:"ten-wins",
        icon:"⚡",
        name:"Winning Machine",
        description:"Win 10 games.",
        condition:p =>
            Number(p.wins || 0) >= 10
    },

    {
        id:"fifty-wins",
        icon:"👑",
        name:"Champion",
        description:"Win 50 games.",
        condition:p =>
            Number(p.wins || 0) >= 50
    },

    {
        id:"hundred-wins",
        icon:"💎",
        name:"Legend",
        description:"Win 100 games.",
        condition:p =>
            Number(p.wins || 0) >= 100
    },

    {
        id:"ten-games",
        icon:"🎮",
        name:"Gamer",
        description:"Play 10 games.",
        condition:p =>
            Number(p.gamesPlayed || 0) >= 10
    },

    {
        id:"hundred-games",
        icon:"🌟",
        name:"Veteran",
        description:"Play 100 games.",
        condition:p =>
            Number(p.gamesPlayed || 0) >= 100
    },

    {
        id:"five-streak",
        icon:"🔥",
        name:"Unstoppable",
        description:"Reach a 5-game winning streak.",
        condition:p =>
            Number(p.bestStreak || 0) >= 5
    }

];


// ============================================================
// CHECK ACHIEVEMENTS
// ============================================================

async function checkAchievements(){

    if(!currentUser || !myProfile) return;

    const earned =
        Array.isArray(
            myProfile.achievements
        )
        ? [...myProfile.achievements]
        : [];

    const newlyEarned = [];

    for(const achievement of ACHIEVEMENTS){

        if(
            achievement.condition(myProfile) &&
            !earned.includes(
                achievement.id
            )
        ){

            earned.push(
                achievement.id
            );

            newlyEarned.push(
                achievement
            );

        }

    }

    renderAchievements(earned);

    if(!newlyEarned.length) return;

    try{

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

        newlyEarned.forEach(
            showAchievementNotification
        );

    }catch(error){

        console.error(
            "Achievement update error:",
            error
        );

    }

}


// ============================================================
// RENDER ACHIEVEMENTS
// ============================================================

function renderAchievements(
    earned = []
){

    const container =
        $("achievements");

    if(!container) return;

    container.innerHTML = "";

    ACHIEVEMENTS.forEach(
        achievement => {

            const unlocked =
                earned.includes(
                    achievement.id
                );

            const item =
                document.createElement("div");

            item.className =
                "achievement " +
                (
                    unlocked
                    ? "unlocked"
                    : "locked"
                );

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
){

    const notification =
        document.createElement("div");

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

async function loadGamesHub(){

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
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if(!user){

            currentUser = null;
            myProfile = null;

            console.log(
                "Games Hub: not logged in"
            );

            renderGames();

            return;

        }

        currentUser =
            user;

        console.log(
            "Games Hub user:",
            user.uid
        );

        await loadGamesHub();

    }
);


// ============================================================
// HELPERS
// ============================================================

function setText(
    id,
    value
){

    const element =
        $(id);

    if(element){

        element.textContent =
            value ?? "";

    }

}


function formatNumber(
    value
){

    const number =
        Number(value || 0);

    return Number.isFinite(number)
        ? number.toLocaleString()
        : "0";

}


function escapeHTML(
    value
){

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
// INITIAL
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

window.recordGameResult =
    recordGameResult;