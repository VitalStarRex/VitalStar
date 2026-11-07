
/* =========================================================
   VITALSTAR COINS — SECURE WALLET
   Firebase v10.12.2
   Cloudflare Worker Backend
   ========================================================= */

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   DOM
   ========================================================= */

const walletBalance = document.getElementById("walletBalance");
const walletButton = document.getElementById("walletButton");
const walletPageBalance = document.getElementById("walletPageBalance");
const walletOwner = document.getElementById("walletOwner");

const totalEarned = document.getElementById("totalEarned")
    || document.getElementById("totalDeposited");

const totalSpent = document.getElementById("totalSpent");
const transactionList = document.getElementById("transactionList");

const sendCoinsButton = document.getElementById("sendCoinsButton");
const sendCoinsModal = document.getElementById("sendCoinsModal");
const continueSendCoins = document.getElementById("continueSendCoins");
const closeSendCoins = document.getElementById("closeSendCoins");

/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentWallet = null;

const WALLET_API =
    "https://vitalstar-wallet-api.amehchristian.workers.dev";

/* =========================================================
   SECURE BACKEND REQUEST
   ========================================================= */

async function walletRequest(endpoint, data = {}) {

    if (!currentUser) {
        throw new Error("Please log in first.");
    }

    const token = await currentUser.getIdToken();

    const response = await fetch(WALLET_API + endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
        throw new Error(
            result.error || "Wallet request failed."
        );
    }

    return result;
}

/* =========================================================
   COIN FORMAT
   ========================================================= */

function formatCoins(amount) {
    return Number(amount || 0).toLocaleString("en-NG") + " VSC";
}

/* =========================================================
   CREATE WALLET
   ========================================================= */

async function createWallet(user) {

    const result = await walletRequest("/wallet/init");

    return result.wallet;
}

/* =========================================================
   LOAD WALLET
   ========================================================= */

async function loadWallet(user) {

    const walletRef = doc(db, "wallets", user.uid);

    let snapshot = await getDoc(walletRef);

    if (!snapshot.exists()) {

        await createWallet(user);

        snapshot = await getDoc(walletRef);
    }

    if (!snapshot.exists()) {
        throw new Error("Wallet could not be initialized.");
    }

    const wallet = snapshot.data();

    currentWallet = wallet;

    updateWalletDisplay(wallet);

    await loadWalletOwner(user);

    await loadTransactions(user);
}

/* =========================================================
   UPDATE WALLET DISPLAY
   ========================================================= */

function updateWalletDisplay(wallet) {

    const balance = Number(wallet.balance || 0);

    if (walletBalance) {
        walletBalance.textContent = formatCoins(balance);
    }

    if (walletPageBalance) {
        walletPageBalance.textContent = formatCoins(balance);
    }

    if (totalEarned) {
        totalEarned.textContent =
            formatCoins(wallet.totalEarned || 0);
    }

    if (totalSpent) {
        totalSpent.textContent =
            formatCoins(wallet.totalSpent || 0);
    }
}

/* =========================================================
   LOAD WALLET OWNER
   ========================================================= */

async function loadWalletOwner(user) {

    if (!walletOwner) return;

    try {

        const userRef = doc(db, "users", user.uid);

        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {

            const data = snapshot.data();

            walletOwner.textContent =
                data.fullName ||
                data.username ||
                user.email ||
                "VitalStar User";

        } else {

            walletOwner.textContent =
                user.email || "VitalStar User";
        }

    } catch (error) {

        console.error("Owner loading error:", error);

        walletOwner.textContent = "VitalStar User";
    }
}

/* =========================================================
   LOAD TRANSACTIONS
   ========================================================= */

async function loadTransactions(user) {

    if (!transactionList) return;

    try {

        const transactionsRef = collection(
            db,
            "wallets",
            user.uid,
            "transactions"
        );

        const transactionsQuery = query(
            transactionsRef,
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const snapshot = await getDocs(transactionsQuery);

        transactionList.replaceChildren();

        if (snapshot.empty) {

            const empty = document.createElement("div");

            empty.className = "empty-transactions";

            empty.textContent = "No coin transactions yet.";

            transactionList.appendChild(empty);

            return;
        }

        snapshot.forEach(transaction => {

            const data = transaction.data();

            const amount = Number(data.amount || 0);

            const type = data.type || "transaction";

            const positive = [
                "received",
                "earned",
                "game_reward"
            ].includes(type);

            const item = document.createElement("div");

            item.className = "transaction-item";

            const info = document.createElement("div");

            info.className = "transaction-info";

            const title = document.createElement("strong");

            title.textContent = data.description || type;

            const date = document.createElement("small");

            date.textContent =
                data.createdAt?.toDate
                    ? data.createdAt.toDate().toLocaleString()
                    : "Recent";

            info.append(title, date);

            const amountElement = document.createElement("div");

            amountElement.className = positive
                ? "transaction-positive"
                : "transaction-negative";

            amountElement.textContent =
                (positive ? "+" : "-") + formatCoins(amount);

            item.append(info, amountElement);

            transactionList.appendChild(item);
        });

    } catch (error) {

        console.error("Transaction loading error:", error);

        transactionList.textContent =
            "Unable to load coin history.";
    }
}

/* =========================================================
   MODAL CONTROLS
   ========================================================= */

function openModal(modal) {

    if (modal) {
        modal.style.display = "flex";
    }
}

function closeModal(modal) {

    if (modal) {
        modal.style.display = "none";
    }
}

if (sendCoinsButton) {

    sendCoinsButton.addEventListener("click", () => {
        openModal(sendCoinsModal);
    });
}

if (closeSendCoins) {

    closeSendCoins.addEventListener("click", () => {
        closeModal(sendCoinsModal);
    });
}

window.addEventListener("click", event => {

    if (event.target === sendCoinsModal) {
        closeModal(sendCoinsModal);
    }
});

/* =========================================================
   FIND USER BY USERNAME
   ========================================================= */

async function findRecipient(username) {

    const normalized = username
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

    if (!normalized) {
        throw new Error("Enter a VitalStar username.");
    }

    const usersRef = collection(db, "users");

    let result = await getDocs(query(
        usersRef,
        where("usernameLower", "==", normalized),
        limit(2)
    ));

    if (result.empty) {

        result = await getDocs(query(
            usersRef,
            where("username", "==", normalized),
            limit(2)
        ));
    }

    if (result.empty) {
        throw new Error("VitalStar user not found.");
    }

    if (result.size > 1) {
        throw new Error("Username is not unique.");
    }

    const recipientDoc = result.docs[0];

    if (recipientDoc.id === currentUser.uid) {
        throw new Error("You cannot send coins to yourself.");
    }

    return {
        uid: recipientDoc.id,
        username: recipientDoc.data().username || normalized
    };
}

/* =========================================================
   SEND COINS — CLOUDFLARE BACKEND
   ========================================================= */

async function sendCoins() {

    if (!currentUser) {

        alert("Please log in first.");

        return;
    }

    const usernameInput =
        document.getElementById("recipientUsername");

    const amountInput =
        document.getElementById("sendCoinAmount");

    if (!usernameInput || !amountInput) {

        alert("Send coins form fields are missing.");

        return;
    }

    const username = usernameInput.value.trim();

    const amount = Number(amountInput.value);

    if (!username) {

        alert("Enter a VitalStar username.");

        return;
    }

    if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > 1000000
    ) {

        alert("Enter a valid amount between 1 and 1,000,000 VSC.");

        return;
    }

    if (continueSendCoins) {

        continueSendCoins.disabled = true;

        continueSendCoins.textContent = "Processing...";
    }

    try {

        const recipient = await findRecipient(username);

        const confirmed = confirm(
            `Send ${formatCoins(amount)} to @${recipient.username}?`
        );

        if (!confirmed) return;

        await walletRequest("/wallet/transfer", {
            username: recipient.username,
            amount
        });

        alert(
            `Successfully sent ${formatCoins(amount)} to @${recipient.username}.`
        );

        usernameInput.value = "";

        amountInput.value = "";

        closeModal(sendCoinsModal);

        await loadWallet(currentUser);

    } catch (error) {

        console.error("Send coins error:", error);

        alert(error.message || "Unable to send coins.");

    } finally {

        if (continueSendCoins) {

            continueSendCoins.disabled = false;

            continueSendCoins.textContent = "Send Coins";
        }
    }
}

/* =========================================================
   SEND BUTTON EVENT
   ========================================================= */

if (continueSendCoins) {

    continueSendCoins.addEventListener("click", sendCoins);
}

/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(auth, async user => {

    if (!user) {

        currentUser = null;

        currentWallet = null;

        if (walletBalance) {
            walletBalance.textContent = "0 VSC";
        }

        if (walletPageBalance) {
            walletPageBalance.textContent = "0 VSC";
        }

        if (totalEarned) {
            totalEarned.textContent = "0 VSC";
        }

        if (totalSpent) {
            totalSpent.textContent = "0 VSC";
        }

        if (walletOwner) {
            walletOwner.textContent = "Not logged in";
        }

        if (transactionList) {
            transactionList.replaceChildren();
        }

        return;
    }

    currentUser = user;

    try {

        await loadWallet(user);

    } catch (error) {

        console.error("Wallet loading error:", error);

        alert("Unable to load your VitalStar wallet.");
    }
});
