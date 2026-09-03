// VITALSTAR GAMES HUB
// games/games.js

import {auth,db} from "../firebase.js";

import {onAuthStateChanged}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,getDoc,setDoc,updateDoc,collection,query,
orderBy,limit,getDocs,where,serverTimestamp,increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ================= GAME CATALOG =================

const games=[
{id:"star-runner",name:"Star Runner Race",icon:"🚀",description:"Race other players through the stars.",category:"arcade",multiplayer:true,premium:true,url:"./star-runner.html"},
{id:"hoop-master",name:"Hoop Master",icon:"🏀",description:"Compete for the highest score.",category:"sports",multiplayer:true,premium:false,url:"./hoop-master.html"},
{id:"paddle-smash",name:"Paddle Smash",icon:"🏓",description:"A fast two-player paddle battle.",category:"sports",multiplayer:true,premium:true,url:"./paddle-smash.html"},
{id:"target-master",name:"Target Master",icon:"🎯",description:"Hit targets and beat your opponent.",category:"arcade",multiplayer:true,premium:true,url:"./target-master.html"},
{id:"quick-tap",name:"Quick Tap",icon:"⚡",description:"Challenge another player in a tapping battle.",category:"arcade",multiplayer:true,premium:false,url:"./quick-tap.html"},
{id:"word-sprint",name:"Word Sprint",icon:"🔤",description:"Find words faster than your opponent.",category:"puzzle",multiplayer:true,premium:false,url:"./word-sprint.html"},
{id:"memory-master",name:"Memory Master",icon:"🧠",description:"Remember the cards and beat your opponent.",category:"puzzle",multiplayer:true,premium:false,url:"./memory-master.html"},
{id:"brain-rush",name:"Brain Rush",icon:"🧩",description:"Solve quick puzzles before time runs out.",category:"puzzle",multiplayer:false,premium:false,url:"./brain-rush.html"},
{id:"gravity-flip",name:"Gravity Flip",icon:"🌀",description:"Master gravity and survive obstacles.",category:"arcade",multiplayer:false,premium:true,url:"./gravity-flip.html"},
{id:"color-rush",name:"Color Rush",icon:"🟣",description:"React quickly and match colors.",category:"arcade",multiplayer:false,premium:true,url:"./color-rush.html"}
];


// ================= STATE =================

let currentUser=null;
let currentCategory="all";
let searchText="";
let isPremium=false;
let coins=1000;
let myProfile=null;


// ================= HELPERS =================

const $=id=>document.getElementById(id);

function setText(id,value){
    const e=$(id);
    if(e)e.textContent=value??"";
}

function formatNumber(value){
    const n=Number(value||0);
    return Number.isFinite(n)?n.toLocaleString():"0";
}

function escapeHTML(value){
    return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}


// ================= COINS =================

function loadLocalCoins(){
    const saved=Number(localStorage.getItem("vitalstarCoins"));

    if(Number.isFinite(saved)&&saved>=0){
        coins=saved;
    }else{
        coins=1000;
        localStorage.setItem("vitalstarCoins","1000");
    }

    updateCoinUI();
}

function updateCoinUI(){
    setText("coinBalance",formatNumber(coins));
    setText("myCoins",formatNumber(coins));
}

function saveLocalCoins(){
    localStorage.setItem("vitalstarCoins",String(coins));
    updateCoinUI();
}


// ================= PROFILE =================

function createDefaultProfile(user){
    return{
        uid:user.uid,
        displayName:user.displayName||"VitalStar Player",
        username:user.email?user.email.split("@")[0].toLowerCase():"player",
        photoURL:user.photoURL||"",
        gamesPlayed:0,wins:0,losses:0,draws:0,
        rating:1000,totalCoins:coins,bestScore:0,
        currentStreak:0,bestStreak:0,achievements:[],
        favoriteGame:"",lastPlayedGame:"",
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
    };
}

async function loadMyProfile(){
    if(!currentUser)return;

    try{
        const ref=doc(db,"gameProfiles",currentUser.uid);
        const snap=await getDoc(ref);

        if(!snap.exists()){
            myProfile=createDefaultProfile(currentUser);
            await setDoc(ref,myProfile);
        }else{
            myProfile=snap.data();
        }

        coins=Number(myProfile.totalCoins);
        if(!Number.isFinite(coins))coins=1000;

        saveLocalCoins();
        renderMyProfile();
        await checkAchievements();

    }catch(error){
        console.error("Profile loading error:",error);
    }
}

function renderMyProfile(){
    if(!myProfile)return;

    const name=myProfile.displayName||myProfile.username||"Player";

    setText("myGameName",name);
    setText("myGameUsername",myProfile.username?"@"+myProfile.username:"");
    setText("myGamesPlayed",formatNumber(myProfile.gamesPlayed));
    setText("myWins",formatNumber(myProfile.wins));
    setText("myLosses",formatNumber(myProfile.losses));
    setText("myRating",formatNumber(myProfile.rating||1000));
    setText("myBestScore",formatNumber(myProfile.bestScore));
    setText("myStreak",formatNumber(myProfile.currentStreak));
    setText("myBestStreak",formatNumber(myProfile.bestStreak));
    setText("myCoins",formatNumber(myProfile.totalCoins));

    const played=Number(myProfile.gamesPlayed||0);
    const wins=Number(myProfile.wins||0);

    setText(
        "myWinRate",
        (played?(wins/played*100):0).toFixed(1)+"%"
    );

    const avatar=$("myGameAvatar");

    if(avatar){
        avatar.src=myProfile.photoURL||
        "https://ui-avatars.com/api/?name="+
        encodeURIComponent(name);
    }
}


// ================= GAMES =================

function renderGames(){
    const grid=$("gamesGrid");
    if(!grid)return;

    grid.innerHTML="";

    const text=searchText.trim().toLowerCase();

    const filtered=games.filter(game=>{
        let categoryOK=true;

        if(currentCategory==="free")
            categoryOK=!game.premium;

        if(currentCategory==="premium")
            categoryOK=game.premium;

        if(currentCategory==="multiplayer")
            categoryOK=game.multiplayer;

        return categoryOK&&(
            !text||
            game.name.toLowerCase().includes(text)
        );
    });

    const empty=$("emptyMessage");

    if(!filtered.length){
        if(empty)empty.style.display="block";
        return;
    }

    if(empty)empty.style.display="none";

    filtered.forEach(game=>{
        const card=document.createElement("div");

        card.className="game"+
        (game.premium&&!isPremium?" locked":"");

        card.innerHTML=`
            ${game.premium&&!isPremium?`<div class="lock">🔒 PREMIUM</div>`:""}
            <div class="game-icon">${game.icon}</div>

            <div class="badges">
                <span class="badge">
                    ${game.premium?"👑 PREMIUM":"🆓 FREE"}
                </span>

                ${game.multiplayer?
                `<span class="badge">👥 MULTIPLAYER</span>`:""}
            </div>

            <h3>${escapeHTML(game.name)}</h3>
            <p>${escapeHTML(game.description)}</p>

            <button class="play">
                ${game.premium&&!isPremium?"🔒 UNLOCK":"▶ PLAY"}
            </button>
        `;

        card.querySelector(".play")
        ?.addEventListener("click",()=>launchGame(game));

        grid.appendChild(card);
    });
}

function launchGame(game){
    if(!currentUser){
        alert("Please log in to play VitalStar Games.");
        return;
    }

    if(game.premium&&!isPremium){
        openPremium();
        return;
    }

    sessionStorage.setItem("vitalstarCurrentGame",game.id);
    sessionStorage.setItem("vitalstarGameName",game.name);

    if(game.url){
        location.href=game.url;
    }else{
        alert(game.name+"\n\nThis game is coming soon.");
    }
}


// ================= SEARCH / TABS =================

$("gameSearch")?.addEventListener("input",e=>{
    searchText=e.target.value;
    renderGames();
});

document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
        document.querySelectorAll(".tab")
        .forEach(x=>x.classList.remove("active"));

        tab.classList.add("active");
        currentCategory=tab.dataset.category||"all";
        renderGames();
    });
});


// ================= PREMIUM =================

const premiumModal=$("premiumModal");

function openPremium(){
    if(premiumModal)premiumModal.style.display="flex";
}

function closePremium(){
    if(premiumModal)premiumModal.style.display="none";
}

$("premiumButton")?.addEventListener("click",openPremium);
$("premiumTopButton")?.addEventListener("click",openPremium);
$("closePremium")?.addEventListener("click",closePremium);

premiumModal?.addEventListener("click",e=>{
    if(e.target===premiumModal)closePremium();
});

$("subscribeButton")?.addEventListener("click",()=>{
    alert("Premium payment will be connected next.");
});


// ================= LEADERBOARD =================

async function loadTopWinners(){
    const box=$("topWinners");
    if(!box)return;

    box.innerHTML=`<div class="loading">Loading top players...</div>`;

    try{
        const q=query(
            collection(db,"gameProfiles"),
            orderBy("wins","desc"),
            limit(10)
        );

        const snap=await getDocs(q);
        box.innerHTML="";

        if(snap.empty){
            box.innerHTML=`<div class="empty" style="display:block">No winners yet.</div>`;
            return;
        }

        snap.docs.forEach((x,i)=>
            box.appendChild(createLeaderboardPlayer(x.data(),i+1))
        );

    }catch(error){
        console.error("Top winners error:",error);
        box.innerHTML=`<div class="empty" style="display:block">Unable to load top winners.</div>`;
    }
}

async function loadLeaderboard(){
    const box=$("leaderboard");
    if(!box)return;

    box.innerHTML=`<div class="loading">Loading leaderboard...</div>`;

    try{
        const q=query(
            collection(db,"gameProfiles"),
            orderBy("rating","desc"),
            limit(100)
        );

        const snap=await getDocs(q);
        box.innerHTML="";

        if(snap.empty){
            box.innerHTML=`<div class="empty" style="display:block">No players yet.</div>`;
            return;
        }

        snap.docs.forEach((x,i)=>
            box.appendChild(createLeaderboardPlayer(x.data(),i+1))
        );

    }catch(error){
        console.error("Leaderboard error:",error);
        box.innerHTML=`<div class="empty" style="display:block">Unable to load leaderboard.</div>`;
    }
}

function createLeaderboardPlayer(player,rank){
    const el=document.createElement("div");
    el.className="leaderboard-player";

    const name=player.displayName||player.username||"Player";

    const medal=
        rank===1?"🥇":
        rank===2?"🥈":
        rank===3?"🥉":
        rank?"#"+rank:"👤";

    el.innerHTML=`
        <div class="leader-rank">${medal}</div>

        <img class="leader-avatar"
        src="${player.photoURL||
        "https://ui-avatars.com/api/?name="+encodeURIComponent(name)}">

        <div class="leader-info">
            <strong>${escapeHTML(name)}</strong>
            ${player.username?`<small>@${escapeHTML(player.username)}</small>`:""}
        </div>

        <div class="leader-stats">
            <strong>${formatNumber(player.wins)}</strong>
            <small>Wins</small>
        </div>

        <div class="leader-rating">
            ⭐ ${formatNumber(player.rating||1000)}
        </div>
    `;

    if(player.uid)
        el.addEventListener("click",()=>openPlayerProfile(player.uid));

    return el;
}


// ================= PLAYER PROFILE =================

async function openPlayerProfile(uid){
    if(!uid)return;

    try{
        const snap=await getDoc(doc(db,"gameProfiles",uid));

        if(!snap.exists()){
            alert("Player profile not found.");
            return;
        }

        const p=snap.data();
        const name=p.displayName||p.username||"Player";
        const played=Number(p.gamesPlayed||0);
        const wins=Number(p.wins||0);

        const rate=played?(wins/played*100).toFixed(1):"0.0";
        const modal=$("playerProfileModal");

        if(!modal){
            alert(
                name+
                "\n\n🏆 Wins: "+wins+
                "\n🎮 Games: "+played+
                "\n❌ Losses: "+Number(p.losses||0)+
                "\n📊 Win Rate: "+rate+"%"+
                "\n⭐ Rating: "+(p.rating||1000)
            );
            return;
        }

        modal.style.display="flex";

        setText("profilePlayerName",name);
        setText("profilePlayerUsername",p.username?"@"+p.username:"");
        setText("profileGamesPlayed",formatNumber(played));
        setText("profileWins",formatNumber(p.wins));
        setText("profileLosses",formatNumber(p.losses));
        setText("profileWinRate",rate+"%");
        setText("profileRating",formatNumber(p.rating||1000));
        setText("profileBestScore",formatNumber(p.bestScore));
        setText("profileStreak",formatNumber(p.bestStreak));

        const avatar=$("profilePlayerAvatar");

        if(avatar){
            avatar.src=p.photoURL||
            "https://ui-avatars.com/api/?name="+
            encodeURIComponent(name);
        }

    }catch(error){
        console.error("Player profile error:",error);
        alert("Unable to open player profile.");
    }
}

$("closePlayerProfile")?.addEventListener("click",()=>{
    const modal=$("playerProfileModal");
    if(modal)modal.style.display="none";
});

$("playerProfileModal")?.addEventListener("click",e=>{
    if(e.target===$("playerProfileModal"))
        $("playerProfileModal").style.display="none";
});


// ================= PLAYER SEARCH =================

$("playerSearch")?.addEventListener("input",async e=>{
    const text=e.target.value.trim().toLowerCase();
    const box=$("playerSearchResults");

    if(!box)return;

    if(!text){
        box.innerHTML="";
        return;
    }

    box.innerHTML=`<div class="loading">Searching...</div>`;

    try{
        const q=query(
            collection(db,"gameProfiles"),
            where("username",">=",text),
            where("username","<=",text+"\uf8ff"),
            limit(10)
        );

        const snap=await getDocs(q);
        box.innerHTML="";

        if(snap.empty){
            box.innerHTML=`<div class="empty" style="display:block">No players found.</div>`;
            return;
        }

        snap.docs.forEach(x=>
            box.appendChild(createLeaderboardPlayer(x.data(),""))
        );

    }catch(error){
        console.error("Player search error:",error);
        box.innerHTML=`<div class="empty" style="display:block">Search unavailable.</div>`;
    }
});


// ================= RECORD RESULT =================

export async function recordGameResult(
    gameId,result,score=0,coinReward=0
){
    if(!currentUser)return false;

    if(!["win","loss","draw"].includes(result)){
        console.error("Invalid result:",result);
        return false;
    }

    try{
        const ref=doc(db,"gameProfiles",currentUser.uid);
        let snap=await getDoc(ref);

        if(!snap.exists()){
            await loadMyProfile();
            snap=await getDoc(ref);
        }

        const p=snap.exists()?snap.data():myProfile||{};

        let gamesPlayed=Number(p.gamesPlayed||0)+1;
        let wins=Number(p.wins||0);
        let losses=Number(p.losses||0);
        let draws=Number(p.draws||0);
        let rating=Number(p.rating||1000);
        let streak=Number(p.currentStreak||0);
        let bestStreak=Number(p.bestStreak||0);

        const numericScore=Number(score)||0;

        if(result==="win"){
            wins++;
            streak++;
            bestStreak=Math.max(bestStreak,streak);
            rating+=25;
        }else if(result==="loss"){
            losses++;
            streak=0;
            rating=Math.max(0,rating-15);
        }else{
            draws++;
            rating+=5;
        }

        const reward=Math.max(0,Number(coinReward)||0);
        const newCoins=Math.max(0,Number(p.totalCoins)||0)+reward;
        const bestScore=Math.max(Number(p.bestScore||0),numericScore);

        await updateDoc(ref,{
            gamesPlayed,wins,losses,draws,rating,
            currentStreak:streak,bestStreak,bestScore,
            totalCoins:newCoins,lastPlayedGame:gameId,
            updatedAt:serverTimestamp()
        });

        const statRef=doc(
            db,"gameProfiles",currentUser.uid,
            "gameStats",gameId
        );

        const stats={
            gameId,
            gamesPlayed:increment(1),
            bestScore,
            lastResult:result,
            updatedAt:serverTimestamp()
        };

        stats[result==="win"?"wins":result==="loss"?"losses":"draws"]=
            increment(1);

        await setDoc(statRef,stats,{merge:true});

        await setDoc(
            doc(
                db,"gameProfiles",currentUser.uid,
                "history",String(Date.now())
            ),
            {
                gameId,result,score:numericScore,
                coins:reward,createdAt:serverTimestamp()
            }
        );

        coins=newCoins;
        saveLocalCoins();

        await loadMyProfile();
        await loadTopWinners();
        await loadLeaderboard();

        return true;

    }catch(error){
        console.error("Could not record game result:",error);
        return false;
    }
}


// ================= HISTORY =================

async function loadGameHistory(){
    if(!currentUser)return;

    const box=$("gameHistory");
    if(!box)return;

    box.innerHTML=`<div class="loading">Loading game history...</div>`;

    try{
        const q=query(
            collection(
                db,"gameProfiles",currentUser.uid,"history"
            ),
            orderBy("createdAt","desc"),
            limit(20)
        );

        const snap=await getDocs(q);
        box.innerHTML="";

        if(snap.empty){
            box.innerHTML=`<div class="empty" style="display:block">
                You haven't played any games yet.
            </div>`;
            return;
        }

        snap.docs.forEach(x=>{
            const m=x.data();
            const game=games.find(g=>g.id===m.gameId);
            const row=document.createElement("div");

            row.className="game-history-item";

            const resultClass=
                m.result==="win"?"win":
                m.result==="loss"?"loss":"draw";

            const resultText=
                m.result==="win"?"🏆 WIN":
                m.result==="loss"?"❌ LOSS":"🤝 DRAW";

            row.innerHTML=`
                <div class="history-icon">
                    ${game?game.icon:"🎮"}
                </div>

                <div class="history-info">
                    <strong>
                        ${game?escapeHTML(game.name):
                        escapeHTML(m.gameId||"Game")}
                    </strong>
                    <small>Score: ${formatNumber(m.score)}</small>
                </div>

                <div class="history-result ${resultClass}">
                    ${resultText}
                </div>
            `;

            box.appendChild(row);
        });

    }catch(error){
        console.error("Game history error:",error);
        box.innerHTML=`<div class="empty" style="display:block">
            Unable to load game history.
        </div>`;
    }
}


// ================= ACHIEVEMENTS =================

const ACHIEVEMENTS=[
{id:"first-win",icon:"🏆",name:"First Victory",description:"Win your first game.",condition:p=>Number(p.wins||0)>=1},
{id:"five-wins",icon:"🔥",name:"Hot Streak",description:"Win 5 games.",condition:p=>Number(p.wins||0)>=5},
{id:"ten-wins",icon:"⚡",name:"Winning Machine",description:"Win 10 games.",condition:p=>Number(p.wins||0)>=10},
{id:"fifty-wins",icon:"👑",name:"Champion",description:"Win 50 games.",condition:p=>Number(p.wins||0)>=50},
{id:"hundred-wins",icon:"💎",name:"Legend",description:"Win 100 games.",condition:p=>Number(p.wins||0)>=100},
{id:"ten-games",icon:"🎮",name:"Gamer",description:"Play 10 games.",condition:p=>Number(p.gamesPlayed||0)>=10},
{id:"hundred-games",icon:"🌟",name:"Veteran",description:"Play 100 games.",condition:p=>Number(p.gamesPlayed||0)>=100},
{id:"five-streak",icon:"🔥",name:"Unstoppable",description:"Reach a 5-game winning streak.",condition:p=>Number(p.bestStreak||0)>=5}
];

async function checkAchievements(){
    if(!currentUser||!myProfile)return;

    const earned=Array.isArray(myProfile.achievements)
        ?[...myProfile.achievements]:[];

    const newOnes=[];

    ACHIEVEMENTS.forEach(a=>{
        if(a.condition(myProfile)&&!earned.includes(a.id)){
            earned.push(a.id);
            newOnes.push(a);
        }
    });

    renderAchievements(earned);

    if(!newOnes.length)return;

    try{
        await updateDoc(
            doc(db,"gameProfiles",currentUser.uid),
            {achievements:earned,updatedAt:serverTimestamp()}
        );

        myProfile.achievements=earned;
        newOnes.forEach(showAchievementNotification);

    }catch(error){
        console.error("Achievement update error:",error);
    }
}

function renderAchievements(earned=[]){
    const box=$("achievements");
    if(!box)return;

    box.innerHTML="";

    ACHIEVEMENTS.forEach(a=>{
        const unlocked=earned.includes(a.id);
        const item=document.createElement("div");

        item.className=
            "achievement "+(unlocked?"unlocked":"locked");

        item.innerHTML=`
            <div class="achievement-icon">
                ${unlocked?a.icon:"🔒"}
            </div>

            <div>
                <strong>${escapeHTML(a.name)}</strong>
                <small>${escapeHTML(a.description)}</small>
            </div>
        `;

        box.appendChild(item);
    });
}

function showAchievementNotification(a){
    const n=document.createElement("div");

    n.className="achievement-notification";

    n.innerHTML=`
        <div>${a.icon}</div>
        <div>
            <strong>Achievement Unlocked!</strong>
            <span>${escapeHTML(a.name)}</span>
        </div>
    `;

    document.body.appendChild(n);

    setTimeout(()=>n.remove(),4000);
}


// ================= LOAD HUB =================

async function loadGamesHub(){
    await loadMyProfile();

    await Promise.allSettled([
        loadTopWinners(),
        loadLeaderboard(),
        loadGameHistory()
    ]);

    renderAchievements(
        myProfile&&Array.isArray(myProfile.achievements)
        ?myProfile.achievements:[]
    );
}


// ================= AUTH =================

onAuthStateChanged(auth,async user=>{
    if(!user){
        currentUser=null;
        myProfile=null;
        console.log("Games Hub: not logged in");
        renderGames();
        return;
    }

    currentUser=user;
    console.log("Games Hub user:",user.uid);
    await loadGamesHub();
});


// ================= START =================

loadLocalCoins();
renderGames();


// ================= GLOBAL =================

window.openPremium=openPremium;
window.closePremium=closePremium;
window.openPlayerProfile=openPlayerProfile;
window.loadLeaderboard=loadLeaderboard;
window.loadTopWinners=loadTopWinners;
window.loadGameHistory=loadGameHistory;
window.checkAchievements=checkAchievements;
window.recordGameResult=recordGameResult;