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


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentBalance = 0;


// ============================================================
// FORMAT MONEY
// ============================================================

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


// ============================================================
// UPDATE BALANCE
// ============================================================

function updateBalanceDisplays(balance){

    currentBalance =
        Number(balance) || 0;

    walletBalance &&
        (
            walletBalance.textContent =
                formatMoney(currentBalance)
        );

    walletPageBalance &&
        (
            walletPageBalance.textContent =
                formatMoney(currentBalance)
        );

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
// MODALS
// ============================================================

function openModal(modal){

    modal?.classList.add("show");

}


function closeModal(modal){

    modal?.classList.remove("show");

}


depositButton?.addEventListener(
    "click",
    () => openModal(depositModal)
);


withdrawButton?.addEventListener(
    "click",
    () => openModal(withdrawModal)
);


document.querySelectorAll(
    "[data-close]"
).forEach(
    button => {

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


[depositModal, withdrawModal].forEach(
    modal => {

        modal?.addEventListener(
            "click",
            event => {

                if(event.target === modal){

                    closeModal(modal);

                }

            }
        );

    }
);


// ============================================================
// START DEPOSIT
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

            if(
                !data.success ||
                !data.authorizationUrl
            ){

                throw new Error(
                    data.message ||
                    "Unable to start payment"
                );

            }

            // SAVE REFERENCE
            localStorage.setItem(
                "walletPaymentReference",
                data.reference
            );

            // OPEN PAYSTACK
            window.location.href =
                data.authorizationUrl;

        }

        catch(error){

            console.error(
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
// VERIFY PAYMENT
// ============================================================

async function verifyPayment(user){

    const reference =
        localStorage.getItem(
            "walletPaymentReference"
        );

    if(!reference){

        return;

    }

    try{

        const response =
            await fetch(
                "https://caolbkawexnilpsgrwyz.supabase.co/functions/v1/wallet-verify",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:JSON.stringify({
                        reference
                    })
                }
            );

        const data =
            await response.json();

        if(!data.success){

            return;

        }

        // IMPORTANT:
        // Credit will be added by the backend
        // in the next step.

        localStorage.removeItem(
            "walletPaymentReference"
        );

        alert(
            "Payment verified successfully."
        );

    }

    catch(error){

        console.error(
            "Verification error:",
            error
        );

    }

}


// ============================================================
// WITHDRAW
// ============================================================

continueWithdraw?.addEventListener(
    "click",
    () => {

        const amount =
            Number(
                document.getElementById(
                    "withdrawAmount"
                )?.value
            );

        if(!amount || amount <= 0){

            alert(
                "Enter a valid amount"
            );

            return;

        }

        if(amount > currentBalance){

            alert(
                "Insufficient wallet balance"
            );

            return;

        }

        alert(
            "Withdrawal will be connected next."
        );

    }
);


// ============================================================
// CREATE WALLET
// ============================================================

async function createWallet(user){

    await setDoc(
        doc(
            db,
            "wallets",
            user.uid
        ),
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

    const snapshot =
        await getDoc(walletRef);

    if(!snapshot.exists()){

        updateBalanceDisplays(
            await createWallet(user)
        );

        return;

    }

    updateBalanceDisplays(
        snapshot.data().balance
    );

}


// ============================================================
// LOAD OWNER
// ============================================================

async function loadWalletOwner(user){

    if(!walletOwner){

        return;

    }

    const snapshot =
        await getDoc(
            doc(
                db,
                "users",
                user.uid
            )
        );

    const data =
        snapshot.exists()
            ? snapshot.data()
            : {};

    walletOwner.textContent =
        data.fullname ||
        data.username ||
        user.email ||
        "VitalStar Member";

}


// ============================================================
// LOAD TRANSACTIONS
// ============================================================

async function loadTransactions(user){

    if(!transactionList){

        return;

    }

    try{

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "wallets",
                        user.uid,
                        "transactions"
                    ),

                    orderBy(
                        "createdAt",
                        "desc"
                    ),

                    limit(50)
                )
            );

        if(snapshot.empty){

            transactionList.innerHTML =
                "📭 No transactions yet";

            totalDeposited &&
                (
                    totalDeposited.textContent =
                        formatMoney(0)
                );

            totalSpent &&
                (
                    totalSpent.textContent =
                        formatMoney(0)
                );

            return;

        }

        let deposited = 0;
        let spent = 0;

        transactionList.innerHTML = "";

        snapshot.forEach(
            transactionDoc => {

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

                const credit =
                    [
                        "deposit",
                        "credit"
                    ].includes(type);

                if(credit){

                    deposited += amount;

                }

                else{

                    spent += amount;

                }

                const item =
                    document.createElement("div");

                item.className =
                    "transaction-item";

                item.innerHTML =
                    `
                    <div class="transaction-icon">
                        ${credit ? "➕" : "💸"}
                    </div>

                    <div class="transaction-info">

                        <div class="transaction-title">
                            ${escapeHTML(
                                data.description ||
                                type ||
                                "Wallet Transaction"
                            )}
                        </div>

                    </div>

                    <div class="transaction-amount ${
                        credit
                            ? "credit"
                            : "debit"
                    }">

                        ${credit ? "+" : "-"}
                        ${formatMoney(amount)}

                    </div>
                    `;

                transactionList.appendChild(
                    item
                );

            }
        );

        totalDeposited &&
            (
                totalDeposited.textContent =
                    formatMoney(deposited)
            );

        totalSpent &&
            (
                totalSpent.textContent =
                    formatMoney(spent)
            );

    }

    catch(error){

        console.error(error);

        transactionList.innerHTML =
            "⚠️ Unable to load transactions";

    }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value){

    const element =
        document.createElement("div");

    element.textContent =
        String(value || "");

    return element.innerHTML;

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
    auth,
    async user => {

        if(!user){

            return;

        }

        currentUser = user;

        try{

            // VERIFY FIRST
            await verifyPayment(user);

            // THEN LOAD UPDATED DATA
            await loadWallet(user);

            await loadWalletOwner(user);

            await loadTransactions(user);

        }

        catch(error){

            console.error(
                "Wallet error:",
                error
            );

        }

    }
);