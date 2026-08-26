// ============================================================
// VITALSTAR WALLET
// Works on home.html and wallet.html
// ============================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// ELEMENTS
// ============================================================

// HOME PAGE

const walletBalance =
    document.getElementById("walletBalance");

const walletButton =
    document.getElementById("walletButton");


// WALLET PAGE

const walletPageBalance =
    document.getElementById("walletPageBalance");

const walletOwner =
    document.getElementById("walletOwner");

const totalDeposited =
    document.getElementById("totalDeposited");

const totalSpent =
    document.getElementById("totalSpent");

const transactionList =
    document.getElementById("transactionList");

const depositButton =
    document.getElementById("depositButton");

const withdrawButton =
    document.getElementById("withdrawButton");

const depositModal =
    document.getElementById("depositModal");

const withdrawModal =
    document.getElementById("withdrawModal");

const continueDeposit =
    document.getElementById("continueDeposit");

const continueWithdraw =
    document.getElementById("continueWithdraw");


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;

let currentBalance = 0;


// ============================================================
// FORMAT MONEY
// ============================================================

function formatMoney(amount){

    const number =
        Number(amount) || 0;

    return new Intl.NumberFormat(
        "en-NG",
        {
            style:"currency",
            currency:"NGN",
            maximumFractionDigits:2
        }
    ).format(number);

}


// ============================================================
// UPDATE ALL BALANCE DISPLAYS
// ============================================================

function updateBalanceDisplays(balance){

    currentBalance =
        Number(balance) || 0;

    if(walletBalance){

        walletBalance.textContent =
            formatMoney(currentBalance);

    }

    if(walletPageBalance){

        walletPageBalance.textContent =
            formatMoney(currentBalance);

    }

}


// ============================================================
// OPEN WALLET
// ============================================================

walletButton?.addEventListener(
    "click",
    () => {

        window.location.href =
            "wallet.html";

    }
);


// ============================================================
// MODAL FUNCTIONS
// ============================================================

function openModal(modal){

    if(modal){

        modal.classList.add(
            "show"
        );

    }

}


function closeModal(modal){

    if(modal){

        modal.classList.remove(
            "show"
        );

    }

}


// ============================================================
// DEPOSIT MODAL
// ============================================================

depositButton?.addEventListener(
    "click",
    () => {

        openModal(
            depositModal
        );

    }
);


// ============================================================
// WITHDRAW MODAL
// ============================================================

withdrawButton?.addEventListener(
    "click",
    () => {

        openModal(
            withdrawModal
        );

    }
);


// ============================================================
// CLOSE MODALS
// ============================================================

document.querySelectorAll(
    "[data-close]"
).forEach(
    (button) => {

        button.addEventListener(
            "click",
            () => {

                const modalId =
                    button.dataset.close;

                closeModal(
                    document.getElementById(
                        modalId
                    )
                );

            }
        );

    }
);


// ============================================================
// CLOSE MODAL WHEN BACKGROUND IS CLICKED
// ============================================================

[depositModal, withdrawModal].forEach(
    (modal) => {

        modal?.addEventListener(
            "click",
            (event) => {

                if(
                    event.target === modal
                ){

                    closeModal(modal);

                }

            }
        );

    }
);


// ============================================================
// CONTINUE DEPOSIT
// ============================================================

continueDeposit?.addEventListener(
    "click",
    () => {

        const depositAmount =
            Number(
                document.getElementById(
                    "depositAmount"
                )?.value
            );

        if(
            !depositAmount ||
            depositAmount <= 0
        ){

            alert(
                "Please enter a valid deposit amount."
            );

            return;

        }

        /*
         * IMPORTANT:
         *
         * DO NOT add the money directly
         * to Firestore here.
         *
         * The next step will send the user
         * to a secure payment system.
         */

        alert(
            "Payment setup is the next step. "
            +
            "Amount selected: "
            +
            formatMoney(depositAmount)
        );

    }
);


// ============================================================
// CONTINUE WITHDRAW
// ============================================================

continueWithdraw?.addEventListener(
    "click",
    () => {

        const withdrawAmount =
            Number(
                document.getElementById(
                    "withdrawAmount"
                )?.value
            );

        if(
            !withdrawAmount ||
            withdrawAmount <= 0
        ){

            alert(
                "Please enter a valid withdrawal amount."
            );

            return;

        }

        if(
            withdrawAmount >
            currentBalance
        ){

            alert(
                "Insufficient wallet balance."
            );

            return;

        }

        const bankName =
            document.getElementById(
                "bankName"
            )?.value.trim();

        const accountNumber =
            document.getElementById(
                "accountNumber"
            )?.value.trim();

        const accountName =
            document.getElementById(
                "accountName"
            )?.value.trim();

        if(
            !bankName ||
            !accountNumber ||
            !accountName
        ){

            alert(
                "Please complete your withdrawal details."
            );

            return;

        }

        if(
            accountNumber.length !== 10
        ){

            alert(
                "Please enter a valid 10-digit account number."
            );

            return;

        }

        /*
         * IMPORTANT:
         *
         * Do not deduct the money here.
         *
         * The secure backend must process
         * the withdrawal and then update
         * the wallet.
         */

        alert(
            "Withdrawal processing will be "
            +
            "connected to the secure payment "
            +
            "system next."
        );

    }
);


// ============================================================
// CREATE WALLET
// ============================================================

async function createWallet(user){

    const walletRef =
        doc(
            db,
            "wallets",
            user.uid
        );

    await setDoc(
        walletRef,
        {
            balance:0,
            currency:"NGN",
            createdAt:
                serverTimestamp(),
            updatedAt:
                serverTimestamp()
        }
    );

    return 0;

}


// ============================================================
// LOAD WALLET
// ============================================================

async function loadWallet(user){

    const walletRef =
        doc(
            db,
            "wallets",
            user.uid
        );

    const walletSnap =
        await getDoc(
            walletRef
        );

    // Create wallet automatically

    if(
        !walletSnap.exists()
    ){

        const balance =
            await createWallet(
                user
            );

        updateBalanceDisplays(
            balance
        );

        return;

    }

    const walletData =
        walletSnap.data();

    const balance =
        Number(
            walletData.balance
        ) || 0;

    updateBalanceDisplays(
        balance
    );

}


// ============================================================
// LOAD WALLET OWNER
// ============================================================

async function loadWalletOwner(user){

    if(!walletOwner){

        return;

    }

    try{

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        const userSnap =
            await getDoc(
                userRef
            );

        if(
            userSnap.exists()
        ){

            const userData =
                userSnap.data();

            walletOwner.textContent =
                userData.fullname ||
                userData.username ||
                "VitalStar Member";

        }

        else{

            walletOwner.textContent =
                user.email ||
                "VitalStar Member";

        }

    }

    catch(error){

        console.error(
            "Wallet owner error:",
            error
        );

    }

}


// ============================================================
// LOAD TRANSACTIONS
// ============================================================

async function loadTransactions(user){

    if(!transactionList){

        return;

    }

    transactionList.innerHTML =
        `
        <div class="loading">
            Loading transactions...
        </div>
        `;

    try{

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

        if(
            snapshot.empty
        ){

            transactionList.innerHTML =
                `
                <div class="empty-state">

                    <div class="empty-icon">
                        📭
                    </div>

                    <div class="empty-title">
                        No transactions yet
                    </div>

                    <div class="empty-text">
                        Your wallet transactions
                        will appear here.
                    </div>

                </div>
                `;

            if(totalDeposited){

                totalDeposited.textContent =
                    formatMoney(0);

            }

            if(totalSpent){

                totalSpent.textContent =
                    formatMoney(0);

            }

            return;

        }


        let deposited = 0;

        let spent = 0;

        transactionList.innerHTML =
            "";


        snapshot.forEach(
            (transactionDoc) => {

                const data =
                    transactionDoc.data();

                const amount =
                    Number(
                        data.amount
                    ) || 0;

                const type =
                    String(
                        data.type || ""
                    ).toLowerCase();

                const isCredit =
                    [
                        "deposit",
                        "credit"
                    ].includes(type);

                if(isCredit){

                    deposited += amount;

                }

                else{

                    spent += amount;

                }

                const date =
                    data.createdAt?.toDate
                        ? data.createdAt.toDate()
                        : null;

                const dateText =
                    date
                        ? date.toLocaleString()
                        : "Processing...";

                let icon = "💳";

                if(
                    type === "deposit" ||
                    type === "credit"
                ){

                    icon = "➕";

                }

                else if(
                    type === "withdraw" ||
                    type === "withdrawal"
                ){

                    icon = "💸";

                }

                else if(
                    type === "subscription"
                ){

                    icon = "⭐";

                }

                const transactionTitle =
                    data.description ||
                    type ||
                    "Wallet Transaction";

                const sign =
                    isCredit
                        ? "+"
                        : "-";

                const amountClass =
                    isCredit
                        ? "credit"
                        : "debit";

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "transaction-item";

                item.innerHTML =
                    `
                    <div class="transaction-icon">
                        ${icon}
                    </div>

                    <div class="transaction-info">

                        <div class="transaction-title">
                            ${escapeHTML(
                                transactionTitle
                            )}
                        </div>

                        <div class="transaction-date">
                            ${escapeHTML(
                                dateText
                            )}
                        </div>

                    </div>

                    <div
                        class="
                            transaction-amount
                            ${amountClass}
                        "
                    >
                        ${sign}
                        ${formatMoney(amount)}
                    </div>
                    `;

                transactionList.appendChild(
                    item
                );

            }
        );


        if(totalDeposited){

            totalDeposited.textContent =
                formatMoney(
                    deposited
                );

        }

        if(totalSpent){

            totalSpent.textContent =
                formatMoney(
                    spent
                );

        }

    }

    catch(error){

        console.error(
            "Transaction loading error:",
            error
        );

        transactionList.innerHTML =
            `
            <div class="empty-state">

                <div class="empty-icon">
                    ⚠️
                </div>

                <div class="empty-title">
                    Unable to load transactions
                </div>

                <div class="empty-text">
                    Please try again later.
                </div>

            </div>
            `;

    }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value){

    const element =
        document.createElement(
            "div"
        );

    element.textContent =
        String(value || "");

    return element.innerHTML;

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if(!user){

            return;

        }

        currentUser = user;

        try{

            await loadWallet(
                user
            );

            await loadWalletOwner(
                user
            );

            await loadTransactions(
                user
            );

        }

        catch(error){

            console.error(
                "Wallet loading error:",
                error
            );

            updateBalanceDisplays(
                0
            );

        }

    }
);