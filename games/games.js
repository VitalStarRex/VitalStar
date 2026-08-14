import {
    auth
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const games = [

    {
        id: "quick-tap",
        name: "Quick Tap",
        icon: "⚡",
        description:
            "Challenge another player in a fast tapping battle.",
        category: "arcade",
        multiplayer: true,
        premium: false,
        url: "quick-tap.html"
    },

    {
        id: "memory-master",
        name: "Memory Master",
        icon: "🧠",
        description:
            "Remember the cards and beat your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: false
    },

    {
        id: "brain-rush",
        name: "Brain Rush",
        icon: "🧩",
        description:
            "Solve quick puzzles before the timer ends.",
        category: "puzzle",
        multiplayer: false,
        premium: false
    },

    {
        id: "hoop-master",
        name: "Hoop Master",
        icon: "🏀",
        description:
            "Compete for the highest virtual score.",
        category: "sports",
        multiplayer: true,
        premium: false
    },

    {
        id: "word-sprint",
        name: "Word Sprint",
        icon: "🔤",
        description:
            "Find words faster than your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: false
    },

    {
        id: "target-master",
        name: "Target Master",
        icon: "🎯",
        description:
            "Hit targets and beat your opponent.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "paddle-smash",
        name: "Paddle Smash",
        icon: "🏓",
        description:
            "A fast two-player paddle battle.",
        category: "sports",
        multiplayer: true,
        premium: true
    },

    {
        id: "quiz-battle",
        name: "Quiz Battle",
        icon: "🏆",
        description:
            "Challenge other players in a quiz battle.",
        category: "quiz",
        multiplayer: true,
        premium: true
    },

    {
        id: "trivia-battle",
        name: "Trivia Battle",
        icon: "⚔️",
        description:
            "Test your knowledge against other players.",
        category: "quiz",
        multiplayer: true,
        premium: true
    },

    {
        id: "shape-match",
        name: "Shape Match",
        icon: "🔷",
        description:
            "Match shapes faster than your opponent.",
        category: "puzzle",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-runner",
        name: "Star Runner Race",
        icon: "🚀",
        description:
            "Race other players through the stars.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "puzzle-battle",
        name: "Puzzle Battle",
        icon: "🧩",
        description:
            "Solve puzzles head-to-head.",
        category: "puzzle",
        multiplayer: true,
        premium: true
    },

    {
        id: "galaxy-quest",
        name: "Galaxy Quest",
        icon: "🌌",
        description:
            "Explore a multiplayer galaxy adventure.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-explorer",
        name: "Star Explorer",
        icon: "🗺️",
        description:
            "Explore new worlds with other players.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "castle-quest",
        name: "Castle Quest",
        icon: "🏰",
        description:
            "Complete challenges in a fantasy world.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "robot-run",
        name: "Robot Run",
        icon: "🤖",
        description:
            "Run, dodge and compete for the highest score.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "dragon-quest",
        name: "Dragon Quest",
        icon: "🐉",
        description:
            "Embark on an exciting multiplayer adventure.",
        category: "adventure",
        multiplayer: true,
        premium: true
    },

    {
        id: "space-defender",
        name: "Space Defender",
        icon: "🛸",
        description:
            "Defend your base against incoming challenges.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "gravity-flip",
        name: "Gravity Flip",
        icon: "🌀",
        description:
            "Master gravity and beat your opponent.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "color-rush",
        name: "Color Rush",
        icon: "🟣",
        description:
            "React quickly and match the correct colors.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "speed-challenge",
        name: "Speed Challenge",
        icon: "🏁",
        description:
            "Compete against players in rapid challenges.",
        category: "arcade",
        multiplayer: true,
        premium: true
    },

    {
        id: "champion-challenge",
        name: "Champion Challenge",
        icon: "👑",
        description:
            "Take on increasingly difficult challenges.",
        category: "competition",
        multiplayer: true,
        premium: true
    },

    {
        id: "star-tournament",
        name: "Star Tournament",
        icon: "🌟",
        description:
            "Compete in organized multiplayer tournaments.",
        category: "competition",
        multiplayer: true,
        premium: true
    },

    {
        id: "goal-rush",
        name: "Goal Rush",
        icon: "⚽",
        description:
            "Compete head-to-head in a football challenge.",
        category: "sports",
        multiplayer: true,
        premium: true
    },

    {
        id: "coin-clash",
        name: "Coin Clash",
        icon: "🪙",
        description:
            "Compete for virtual points in a quick challenge.",
        category: "arcade",
        multiplayer: true,
        premium: true
    }

];


let currentCategory = "all";
let searchText = "";
let isPremium = false;


/* -------------------------
   VIRTUAL COINS
------------------------- */

let coins =
    Number(
        localStorage.getItem(
            "vitalstarCoins"
        )
    );

if(!Number.isFinite(coins)){
    coins = 1000;

    localStorage.setItem(
        "vitalstarCoins",
        coins
    );
}

document
.getElementById("coinBalance")
.textContent = coins;


/* -------------------------
   AUTH
------------------------- */

onAuthStateChanged(
    auth,
    user => {

        if(!user){

            console.log(
                "User is not logged in."
            );

            return;
        }

        console.log(
            "Logged in as:",
            user.uid
        );

        /*
         * Premium status will later be
         * loaded securely from Firebase
         * after payment verification.
         */

    }
);


/* -------------------------
   RENDER GAMES
------------------------- */

const gamesGrid =
    document.getElementById(
        "gamesGrid"
    );

const emptyMessage =
    document.getElementById(
        "emptyMessage"
    );


function renderGames(){

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


    if(filtered.length === 0){

        emptyMessage.style.display =
            "block";

        return;

    }

    emptyMessage.style.display =
        "none";


    filtered.forEach(
        game => {

            const card =
                document.createElement(
                    "div"
                );

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
                    ? `<div class="lock">
                           🔒 PREMIUM
                       </div>`
                    : ""
                }

                <div class="game-icon">
                    ${game.icon}
                </div>

                <div class="badges">

                    ${
                        game.premium
                        ? `<span class="badge premium">
                               👑 PREMIUM
                           </span>`
                        : `<span class="badge">
                               🆓 FREE
                           </span>`
                    }

                    ${
                        game.multiplayer
                        ? `<span class="badge">
                               👥 MULTIPLAYER
                           </span>`
                        : ""
                    }

                </div>

                <h3>
                    ${game.name}
                </h3>

                <p>
                    ${game.description}
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
                card.querySelector(
                    ".play"
                );


            button.addEventListener(
                "click",
                () => {

                    launchGame(game);

                }
            );


            gamesGrid.appendChild(card);

        }
    );

}


/* -------------------------
   LAUNCH GAME
------------------------- */

function launchGame(game){

    if(
        game.premium &&
        !isPremium
    ){

        openPremium();

        return;

    }


    if(game.url){

        window.location.href =
            game.url;

        return;

    }


    alert(
        `${game.name}\n\n` +
        "This game is coming next."
    );

}


/* -------------------------
   SEARCH
------------------------- */

document
.getElementById("gameSearch")
.addEventListener(
    "input",
    event => {

        searchText =
            event.target.value;

        renderGames();

    }
);


/* -------------------------
   CATEGORY TABS
------------------------- */

document
.querySelectorAll(".tab")
.forEach(
    tab => {

        tab.addEventListener(
            "click",
            () => {

                document
                .querySelectorAll(".tab")
                .forEach(
                    item =>
                        item.classList
                        .remove("active")
                );

                tab.classList
                    .add("active");

                currentCategory =
                    tab.dataset.category;

                renderGames();

            }
        );

    }
);


/* -------------------------
   PREMIUM MODAL
------------------------- */

const premiumModal =
    document.getElementById(
        "premiumModal"
    );

function openPremium(){

    premiumModal.style.display =
        "flex";

}

function closePremium(){

    premiumModal.style.display =
        "none";

}


document
.getElementById("premiumButton")
.addEventListener(
    "click",
    openPremium
);


document
.getElementById("premiumTopButton")
.addEventListener(
    "click",
    openPremium
);


document
.getElementById("closePremium")
.addEventListener(
    "click",
    closePremium
);


premiumModal.addEventListener(
    "click",
    event => {

        if(
            event.target ===
            premiumModal
        ){

            closePremium();

        }

    }
);


/* -------------------------
   SUBSCRIPTION
------------------------- */

document
.getElementById("subscribeButton")
.addEventListener(
    "click",
    () => {

        /*
         * Payment integration comes here.
         *
         * Premium must be verified
         * server-side before setting
         * isPremium = true.
         */

        alert(
            "Premium payment will be connected next."
        );

    }
);


/* -------------------------
   INITIAL LOAD
------------------------- */

renderGames();