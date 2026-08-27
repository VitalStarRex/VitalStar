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


// ELEMENTS

const walletBalance =
    document.getElementById("walletBalance");

const walletButton =
    document.getElementById("walletButton");

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


// GLOBAL STATE

let currentUser = null;

let currentBalance = 0;


// FORMAT MONEY

function formatMoney(amount){

    return new Intl.NumberFormat(
        "en-NG",
        {
            style:"currency",
            currency:"NGN",
            maximumFractionDigits:2
        }
    ).format(
        Number(amount) || 0
    );

}


// UPDATE BALANCE

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


// OPEN WALLET

walletButton?.addEventListener(
    "click",
    () => {

        window.location.href =
            "wallet.html";

    }
);


// MODALS

function openModal(modal){

    modal?.classList.add("show");

}

function closeModal(modal){

    modal?.classList.remove("show");

}


// DEPOSIT MODAL

depositButton?.addEventListener(
    "click",
    () => openModal(depositModal)
);


// WITHDRAW MODAL

withdrawButton?.addEventListener(
    "click",
    () => openModal(withdrawModal)
);


// CLOSE MODALS

document.querySelectorAll(
    "[data-close]"
).forEach(
    (button) => {

        button.addEventListener(
            "click",
            () => {

                closeModal(
                    document.getElementById(
                        button.dataset.close
                    )
                );

            }
        );

    }
);


// CLOSE BACKGROUND

[depositModal, withdrawModal].forEach(
    (modal) => {

        modal?.addEventListener(
            "click",
            (event) => {

                if(event.target === modal){

                    closeModal(modal);

                }

            }
        );

    }
);


// ============================================================
// CONTINUE DEPOSIT
// CONNECTED TO PAYSTACK
// ============================================================

continueDeposit?.addEventListener(
    "click",
    async () => {

        const amount =
            Number(
                document.getElementById(
                    "depositAmount"
                )?.value
            );

        if(!amount || amount < 100){

            alert(
                "Minimum deposit is ₦100"
            );

            return;

        }

        if(!currentUser){

            alert(
                "Please log in first"
            );

            return;

        }

        continueDeposit.disabled = true;

        continueDeposit.textContent =
            "Loading...";

        try{

            const response =
                await fetch(
                    "https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/wallet-deposit",
                    {
                        method:"POST",

                        headers:{
                            "Content-Type":
                                "application/json"
                        },

                        body:JSON.stringify({
                            amount,
                            email:
                                currentUser.email,
                            userId:
                                currentUser.uid
                        })
                    }
                );

            const data =
                await response.json();

            if(!data.success){

                throw new Error(
                    data.message ||
                    "Payment failed"
                );

            }

            if(!data.authorizationUrl){

                throw new Error(
                    "Payment link not received"
                );

            }

            window.location.href =
                data.authorizationUrl;

        }

        catch(error){

            console.error(
                "Deposit error:",
                error
            );

            alert(
                error.message ||
                "Unable to start payment"
            );

            continueDeposit.disabled =
                false;

            continueDeposit.textContent =
                "Continue";

        }

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

        alert(
            "Withdrawal processing will be connected next."
        );

    }
);


// CREATE WALLET

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


// LOAD WALLET

async function loadWallet(user){

    const walletRef =
        doc(
            db,
            "wallets",
            user.uid
        );

    const walletSnap =
        await getDoc(walletRef);

    if(!walletSnap.exists()){

        const balance =
            await createWallet(user);

        updateBalanceDisplays(balance);

        return;

    }

    const balance =
        Number(
            walletSnap.data().balance
        ) || 0;

    updateBalanceDisplays(balance);

}


// LOAD WALLET OWNER

async function loadWalletOwner(user){

    if(!walletOwner){

        return;

    }

    try{

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );

        if(userSnap.exists()){

            const data =
                userSnap.data();

            walletOwner.textContent =
                data.fullname ||
                data.username ||
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


// LOAD TRANSACTIONS

async function loadTransactions(user){

    if(!transactionList){

        return;

    }

    transactionList.innerHTML =
        "Loading transactions...";

    try{

        const transactionsRef =
            collection(
                db,
                "wallets",
                user.uid,
                "transactions"
            );

        const snapshot =
            await getDocs(
                query(
                    transactionsRef,
                    orderBy(
                        "createdAt",
                        "desc"
                    ),
                    limit(50)
                )
            );

        if(snapshot.empty){

            transactionList.innerHTML =
                `
                <div class="empty-state">
                    📭 No transactions yet
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

        transactionList.innerHTML = "";

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

                if(isCredit){

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

                const title =
                    data.description ||
                    type ||
                    "Wallet Transaction";

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
                            ${escapeHTML(title)}
                        </div>

                        <div class="transaction-date">
                            ${escapeHTML(dateText)}
                        </div>

                    </div>

                    <div class="transaction-amount ${
                        isCredit
                            ? "credit"
                            : "debit"
                    }">

                        ${isCredit ? "+" : "-"}
                        ${formatMoney(amount)}

                    </div>
                    `;

                transactionList.appendChild(item);

            }
        );

        if(totalDeposited){

            totalDeposited.textContent =
                formatMoney(deposited);

        }

        if(totalSpent){

            totalSpent.textContent =
                formatMoney(spent);

        }

    }

    catch(error){

        console.error(
            "Transaction error:",
            error
        );

        transactionList.innerHTML =
            "⚠️ Unable to load transactions";

    }

}


// ESCAPE HTML

function escapeHTML(value){

    const element =
        document.createElement("div");

    element.textContent =
        String(value || "");

    return element.innerHTML;

}


// AUTH

onAuthStateChanged(
    auth,
    async (user) => {

        if(!user){

            return;

        }

        currentUser = user;

        try{

            await loadWallet(user);

            await loadWalletOwner(user);

            await loadTransactions(user);

        }

        catch(error){

            console.error(
                "Wallet error:",
                error
            );

            updateBalanceDisplays(0);

        }

    }
);