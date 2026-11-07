/* =========================================================
   VITALSTAR COINS — WALLET SYSTEM
   Currency: VSC (Virtual Coins)
   New users receive 10 FREE welcome coins.
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
    where,
    serverTimestamp,
    runTransaction
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


/* =========================================================
   COIN FORMAT
   ========================================================= */

function formatCoins(amount) {

    return Number(amount || 0).toLocaleString("en-NG")
        + " VSC";
}


/* =========================================================
   CREATE WALLET — 10 FREE WELCOME COINS
   ========================================================= */

async function createWallet(user) {

    const walletRef = doc(db, "wallets", user.uid);

    const welcomeBonusRef = doc(
        collection(walletRef, "transactions")
    );

    await runTransaction(db, async transaction => {

        const existingWallet = await transaction.get(walletRef);

        // Never give duplicate welcome bonuses.
        if (existingWallet.exists()) return;

        transaction.set(walletRef, {

            balance: 10,
            totalEarned: 10,
            totalSpent: 0,
            totalSent: 0,
            totalReceived: 0,

            currency: "VSC",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()

        });

        transaction.set(welcomeBonusRef, {

            type: "earned",
            amount: 10,

            description: "Welcome Bonus - 10 Free VSC",

            createdAt: serverTimestamp()

        });

    });

    const snapshot = await getDoc(walletRef);

    return snapshot.data();
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

    const wallet = snapshot.data();

    // Wallet balances are never migrated or edited from the browser.
    // Firestore rules permit only a valid welcome-wallet creation and
    // balanced peer-to-peer transfers. Game payouts will be added later
    // when the game result verification is ready.

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

            title.textContent =
                data.description || type;

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

    if (modal) modal.style.display = "flex";
}

function closeModal(modal) {

    if (modal) modal.style.display = "none";
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
   FIND USER BY VITALSTAR USERNAME
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
   SEND COINS
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

    if (!Number.isSafeInteger(amount) || amount <= 0) {

        alert("Enter a valid whole number of coins.");

        return;
    }

    if (amount > 1000000) {

        alert("Maximum transfer is 1,000,000 VSC.");

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

        const senderUID = currentUser.uid;
        const recipientUID = recipient.uid;

        const senderWalletRef = doc(
            db, "wallets", senderUID
        );

        const recipientWalletRef = doc(
            db, "wallets", recipientUID
        );

        const senderHistoryRef = doc(
            collection(senderWalletRef, "transactions")
        );

        const recipientHistoryRef = doc(
            collection(recipientWalletRef, "transactions")
        );

        const recipientWelcomeRef = doc(
            collection(recipientWalletRef, "transactions")
        );

        await runTransaction(db, async transaction => {

            // READ PHASE.

            const senderSnapshot =
                await transaction.get(senderWalletRef);

            const recipientSnapshot =
                await transaction.get(recipientWalletRef);

            if (!senderSnapshot.exists()) {

                throw new Error("Your wallet does not exist.");
            }

            const senderData = senderSnapshot.data();

            const senderBalance =
                Number(senderData.balance || 0);

            const recipientExists = recipientSnapshot.exists();

            // A new recipient receives 10 welcome coins.
            const recipientData = recipientExists
                ? recipientSnapshot.data()
                : {
                    balance: 10,
                    totalEarned: 10,
                    totalSpent: 0,
                    totalSent: 0,
                    totalReceived: 0,
                    currency: "VSC"
                };

            const recipientBalance =
                Number(recipientData.balance || 0);

            if (
                !Number.isSafeInteger(senderBalance) ||
                !Number.isSafeInteger(recipientBalance)
            ) {
                throw new Error("Invalid wallet balance.");
            }

            if (senderBalance < amount) {

                throw new Error("Insufficient VSC balance.");
            }

            const newRecipientBalance =
                recipientBalance + amount;

            if (!Number.isSafeInteger(newRecipientBalance)) {

                throw new Error("Recipient balance limit exceeded.");
            }

            // WRITE PHASE.

            transaction.update(senderWalletRef, {

                balance: senderBalance - amount,

                totalSent:
                    Number(senderData.totalSent || 0) + amount,

                updatedAt: serverTimestamp()

            });

            if (recipientExists) {

                // Existing recipient: only increase balance and received total.
                transaction.update(recipientWalletRef, {
                    balance: newRecipientBalance,
                    totalReceived:
                        Number(recipientData.totalReceived || 0) + amount,
                    updatedAt: serverTimestamp()
                });

            } else {

                // New recipient: create wallet with one-time 10 VSC welcome bonus.
                transaction.set(recipientWalletRef, {
                    balance: newRecipientBalance,
                    totalEarned: 10,
                    totalSpent: 0,
                    totalSent: 0,
                    totalReceived: amount,
                    currency: "VSC",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }


            // CREATE WELCOME BONUS HISTORY FOR NEW RECIPIENT.

            if (!recipientExists) {

                transaction.set(recipientWelcomeRef, {

                    type: "earned",
                    amount: 10,

                    description: "Welcome Bonus - 10 Free VSC",

                    createdAt: serverTimestamp()

                });
            }


            // SENDER HISTORY.

            transaction.set(senderHistoryRef, {

                type: "sent",

                amount,

                recipientUID,

                recipientUsername: recipient.username,

                description: `Sent coins to @${recipient.username}`,

                createdAt: serverTimestamp()

            });


            // RECIPIENT HISTORY.

            transaction.set(recipientHistoryRef, {

                type: "received",

                amount,

                senderUID,

                senderUsername: currentUser.displayName || "VitalStar User",

                description: "Received VitalStar Coins",

                createdAt: serverTimestamp()

            });

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