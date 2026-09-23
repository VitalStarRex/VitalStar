/* =========================================================
   VITALSTAR WALLET
   ========================================================= */

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
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
const walletAccountNumber = document.getElementById("walletAccountNumber");

const totalDeposited = document.getElementById("totalDeposited");
const totalSpent = document.getElementById("totalSpent");

const transactionList = document.getElementById("transactionList");

const depositButton = document.getElementById("depositButton");
const withdrawButton = document.getElementById("withdrawButton");

const depositModal = document.getElementById("depositModal");
const withdrawModal = document.getElementById("withdrawModal");

const continueDeposit = document.getElementById("continueDeposit");
const continueWithdraw = document.getElementById("continueWithdraw");


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentWallet = null;


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatMoney(amount) {
    return "₦" + Number(amount || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


/* =========================================================
   GENERATE UNIQUE VITALSTAR ACCOUNT NUMBER
   ========================================================= */

async function generateAccountNumber() {

    const counterRef = doc(
        db,
        "system",
        "accountNumberCounter"
    );

    const accountNumber = await runTransaction(
        db,
        async transaction => {

            const counterSnapshot =
                await transaction.get(counterRef);

            let nextNumber = 1000000000;

            if (counterSnapshot.exists()) {

                const data = counterSnapshot.data();

                nextNumber =
                    Number(data.nextNumber) ||
                    1000000000;
            }

            transaction.set(
                counterRef,
                {
                    nextNumber: nextNumber + 1,
                    updatedAt: serverTimestamp()
                },
                {
                    merge: true
                }
            );

            return String(nextNumber);
        }
    );

    return accountNumber;
}


/* =========================================================
   CREATE WALLET
   ========================================================= */

async function createWallet(user) {

    const walletRef = doc(
        db,
        "wallets",
        user.uid
    );

    const accountNumber =
        await generateAccountNumber();

    const walletData = {
        balance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        currency: "NGN",
        accountNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(
        walletRef,
        walletData
    );

    return walletData;
}


/* =========================================================
   MAKE SURE ACCOUNT NUMBER EXISTS
   ========================================================= */

async function ensureAccountNumber(
    walletRef,
    walletData
) {

    if (
        walletData &&
        walletData.accountNumber
    ) {
        return walletData.accountNumber;
    }

    const accountNumber =
        await generateAccountNumber();

    await setDoc(
        walletRef,
        {
            accountNumber,
            updatedAt: serverTimestamp()
        },
        {
            merge: true
        }
    );

    return accountNumber;
}


/* =========================================================
   LOAD WALLET
   ========================================================= */

async function loadWallet(user) {

    const walletRef = doc(
        db,
        "wallets",
        user.uid
    );

    let walletSnapshot =
        await getDoc(walletRef);

    let walletData;

    if (!walletSnapshot.exists()) {

        walletData =
            await createWallet(user);

    } else {

        walletData =
            walletSnapshot.data();

        await ensureAccountNumber(
            walletRef,
            walletData
        );

        walletSnapshot =
            await getDoc(walletRef);

        walletData =
            walletSnapshot.data();
    }

    currentWallet = walletData;

    updateWalletDisplay(walletData);

    await loadWalletOwner(user);

    await loadTransactions(user);
}


/* =========================================================
   UPDATE WALLET DISPLAY
   ========================================================= */

function updateWalletDisplay(wallet) {

    const balance =
        Number(wallet.balance || 0);

    if (walletBalance) {
        walletBalance.textContent =
            formatMoney(balance);
    }

    if (walletPageBalance) {
        walletPageBalance.textContent =
            formatMoney(balance);
    }

    if (walletAccountNumber) {

        walletAccountNumber.textContent =
            wallet.accountNumber ||
            "Generating...";
    }

    if (totalDeposited) {

        totalDeposited.textContent =
            formatMoney(
                wallet.totalDeposited || 0
            );
    }

    if (totalSpent) {

        totalSpent.textContent =
            formatMoney(
                wallet.totalSpent || 0
            );
    }
}


/* =========================================================
   LOAD WALLET OWNER
   ========================================================= */

async function loadWalletOwner(user) {

    if (!walletOwner) return;

    try {

        const userRef = doc(
            db,
            "users",
            user.uid
        );

        const userSnapshot =
            await getDoc(userRef);

        if (userSnapshot.exists()) {

            const data =
                userSnapshot.data();

            walletOwner.textContent =
                data.fullName ||
                data.username ||
                user.email ||
                "VitalStar User";

        } else {

            walletOwner.textContent =
                user.email ||
                "VitalStar User";
        }

    } catch (error) {

        console.error(
            "Failed to load wallet owner:",
            error
        );

        walletOwner.textContent =
            "VitalStar User";
    }
}


/* =========================================================
   LOAD TRANSACTIONS
   ========================================================= */

async function loadTransactions(user) {

    if (!transactionList) return;

    try {

        const transactionsRef =
            collection(
                db,
                "wallets",
                user.uid,
                "transactions"
            );

        const transactionsQuery =
            query(
                transactionsRef,
                orderBy(
                    "createdAt",
                    "desc"
                ),
                limit(50)
            );

        const snapshot =
            await getDocs(
                transactionsQuery
            );

        transactionList.innerHTML = "";

        if (snapshot.empty) {

            transactionList.innerHTML = `
                <div class="empty-transactions">
                    No transactions yet.
                </div>
            `;

            return;
        }

        snapshot.forEach(transaction => {

            const data =
                transaction.data();

            const amount =
                Number(data.amount || 0);

            const type =
                data.type || "transaction";

            const isDeposit =
                type === "deposit";

            const sign =
                isDeposit ? "+" : "-";

            const item =
                document.createElement("div");

            item.className =
                "transaction-item";

            item.innerHTML = `
                <div class="transaction-info">

                    <strong>
                        ${
                            data.description ||
                            (
                                isDeposit
                                    ? "Deposit"
                                    : "Payment"
                            )
                        }
                    </strong>

                    <small>
                        ${
                            data.createdAt &&
                            data.createdAt.toDate
                                ? data.createdAt
                                    .toDate()
                                    .toLocaleString()
                                : "Recent"
                        }
                    </small>

                </div>

                <div class="${
                    isDeposit
                        ? "transaction-positive"
                        : "transaction-negative"
                }">
                    ${sign}${formatMoney(amount)}
                </div>
            `;

            transactionList.appendChild(item);
        });

    } catch (error) {

        console.error(
            "Failed to load transactions:",
            error
        );

        transactionList.innerHTML = `
            <div class="empty-transactions">
                Unable to load transactions.
            </div>
        `;
    }
}


/* =========================================================
   OPEN / CLOSE MODALS
   ========================================================= */

function openModal(modal) {

    if (!modal) return;

    modal.style.display = "flex";
}

function closeModal(modal) {

    if (!modal) return;

    modal.style.display = "none";
}


/* =========================================================
   DEPOSIT
   =========================================================
   
   IMPORTANT:
   The deposit destination is identified ONLY by the
   VitalStar Account Number.

   No email.
   No Firebase UID.
   No Paystack authorization URL.
   ========================================================= */

async function makeDeposit() {

    if (!currentUser) {

        alert(
            "Please log in before making a deposit."
        );

        return;
    }

    if (!currentWallet) {

        alert(
            "Your wallet is still loading."
        );

        return;
    }

    const amountInput =
        document.getElementById("depositAmount");

    const accountInput =
        document.getElementById("depositAccountNumber");

    if (!amountInput) {

        alert(
            "Deposit amount field was not found."
        );

        return;
    }

    const amount =
        Number(amountInput.value);

    /*
       If the account-number field exists,
       use it. Otherwise automatically use
       the logged-in user's own account number.
    */

    const accountNumber =
        accountInput &&
        accountInput.value.trim()
            ? accountInput.value.trim()
            : currentWallet.accountNumber;

    if (!accountNumber) {

        alert(
            "Your VitalStar Account Number is not available yet."
        );

        return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {

        alert(
            "Enter a valid 10-digit VitalStar Account Number."
        );

        return;
    }

    if (!Number.isFinite(amount) || amount < 100) {

        alert(
            "Minimum deposit is ₦100."
        );

        return;
    }

    if (continueDeposit) {

        continueDeposit.disabled = true;

        continueDeposit.textContent =
            "Processing...";
    }

    try {

        /*
           ONLY the account number and amount
           are sent as deposit details.
        */

        const response =
            await fetch(
                "https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/wallet-deposit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        amount,
                        accountNumber
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                result.message ||
                "Deposit request failed."
            );
        }

        /*
           The backend should return success
           after processing the deposit.
        */

        alert(
            result.message ||
            "Deposit request submitted successfully."
        );

        closeModal(depositModal);

        amountInput.value = "";

        if (accountInput) {
            accountInput.value = "";
        }

        await loadWallet(currentUser);

    } catch (error) {

        console.error(
            "Deposit error:",
            error
        );

        alert(
            error.message ||
            "Unable to process deposit."
        );

    } finally {

        if (continueDeposit) {

            continueDeposit.disabled = false;

            continueDeposit.textContent =
                "Deposit";
        }
    }
}


/* =========================================================
   WITHDRAW
   ========================================================= */

async function makeWithdraw() {

    if (!currentUser) {

        alert(
            "Please log in first."
        );

        return;
    }

    const amountInput =
        document.getElementById("withdrawAmount");

    const bankNameInput =
        document.getElementById("withdrawBankName");

    const accountNumberInput =
        document.getElementById("withdrawAccountNumber");

    const accountNameInput =
        document.getElementById("withdrawAccountName");

    if (!amountInput) return;

    const amount =
        Number(amountInput.value);

    const bankName =
        bankNameInput
            ? bankNameInput.value.trim()
            : "";

    const accountNumber =
        accountNumberInput
            ? accountNumberInput.value.trim()
            : "";

    const accountName =
        accountNameInput
            ? accountNameInput.value.trim()
            : "";

    if (!Number.isFinite(amount) || amount <= 0) {

        alert(
            "Enter a valid withdrawal amount."
        );

        return;
    }

    if (amount < 100) {

        alert(
            "Minimum withdrawal is ₦100."
        );

        return;
    }

    if (!bankName) {

        alert(
            "Enter your bank name."
        );

        return;
    }

    if (!accountNumber) {

        alert(
            "Enter your bank account number."
        );

        return;
    }

    if (!accountName) {

        alert(
            "Enter the account name."
        );

        return;
    }

    if (continueWithdraw) {

        continueWithdraw.disabled = true;

        continueWithdraw.textContent =
            "Processing...";
    }

    try {

        /*
           Withdrawal backend should verify
           the authenticated Firebase user
           server-side before changing balance.
        */

        const response =
            await fetch(
                "https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/wallet-withdraw",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        amount,
                        bankName,
                        accountNumber,
                        accountName
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.error ||
                result.message ||
                "Withdrawal failed."
            );
        }

        alert(
            result.message ||
            "Withdrawal request submitted."
        );

        closeModal(withdrawModal);

        amountInput.value = "";

        if (bankNameInput)
            bankNameInput.value = "";

        if (accountNumberInput)
            accountNumberInput.value = "";

        if (accountNameInput)
            accountNameInput.value = "";

        await loadWallet(currentUser);

    } catch (error) {

        console.error(
            "Withdrawal error:",
            error
        );

        alert(
            error.message ||
            "Unable to process withdrawal."
        );

    } finally {

        if (continueWithdraw) {

            continueWithdraw.disabled = false;

            continueWithdraw.textContent =
                "Withdraw";
        }
    }
}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

if (depositButton) {

    depositButton.addEventListener(
        "click",
        () => openModal(depositModal)
    );
}

if (withdrawButton) {

    withdrawButton.addEventListener(
        "click",
        () => openModal(withdrawModal)
    );
}

if (continueDeposit) {

    continueDeposit.addEventListener(
        "click",
        makeDeposit
    );
}

if (continueWithdraw) {

    continueWithdraw.addEventListener(
        "click",
        makeWithdraw
    );
}


/* =========================================================
   CLOSE MODALS WHEN CLICKING OUTSIDE
   ========================================================= */

window.addEventListener(
    "click",
    event => {

        if (
            depositModal &&
            event.target === depositModal
        ) {
            closeModal(depositModal);
        }

        if (
            withdrawModal &&
            event.target === withdrawModal
        ) {
            closeModal(withdrawModal);
        }
    }
);


/* =========================================================
   AUTH STATE
   ========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            currentUser = null;
            currentWallet = null;

            if (walletBalance)
                walletBalance.textContent =
                    "₦0.00";

            if (walletPageBalance)
                walletPageBalance.textContent =
                    "₦0.00";

            if (walletAccountNumber)
                walletAccountNumber.textContent =
                    "Not logged in";

            return;
        }

        currentUser = user;

        try {

            await loadWallet(user);

        } catch (error) {

            console.error(
                "Wallet loading error:",
                error
            );

            alert(
                "Unable to load your wallet."
            );
        }
    }
);