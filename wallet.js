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
    serverTimestamp,
    runTransaction
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

const walletAccountNumber =
    document.getElementById("walletAccountNumber");

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
// FORMAT ACCOUNT NUMBER
// ============================================================

function formatAccountNumber(accountNumber){

    if(!accountNumber){

        return "Generating...";

    }

    return String(accountNumber);

}


// ============================================================
// UPDATE BALANCE DISPLAYS
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
// UPDATE ACCOUNT NUMBER DISPLAY
// ============================================================

function updateAccountNumberDisplay(accountNumber){

    if(!walletAccountNumber){

        return;

    }

    walletAccountNumber.textContent =
        formatAccountNumber(accountNumber);

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

            localStorage.setItem(
                "walletPaymentReference",
                data.reference
            );

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
// GENERATE UNIQUE ACCOUNT NUMBER
// ============================================================

async function generateAccountNumber(){

    const counterRef =
        doc(
            db,
            "system",
            "accountNumberCounter"
        );

    const accountNumber =
        await runTransaction(
            db,
            async transaction => {

                const counterSnapshot =
                    await transaction.get(
                        counterRef
                    );

                let nextNumber =
                    1000000000;

                if(counterSnapshot.exists()){

                    const data =
                        counterSnapshot.data();

                    nextNumber =
                        Number(
                            data.nextNumber
                        ) || 1000000000;

                }

                transaction.set(
                    counterRef,
                    {
                        nextNumber:
                            nextNumber + 1,

                        updatedAt:
                            serverTimestamp()
                    },
                    {
                        merge:true
                    }
                );

                return String(
                    nextNumber
                );

            }
        );

    return accountNumber;

}


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

    const accountNumber =
        await generateAccountNumber();

    await setDoc(
        walletRef,
        {
            balance:0,

            currency:"NGN",

            accountNumber,

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()
        }
    );

    updateAccountNumberDisplay(
        accountNumber
    );

    return 0;

}


// ============================================================
// ENSURE ACCOUNT NUMBER EXISTS
// ============================================================

async function ensureAccountNumber(
    walletRef,
    walletData
){

    if(walletData.accountNumber){

        updateAccountNumberDisplay(
            walletData.accountNumber
        );

        return walletData.accountNumber;

    }

    const accountNumber =
        await generateAccountNumber();

    await setDoc(
        walletRef,
        {
            accountNumber,

            updatedAt:
                serverTimestamp()
        },
        {
            merge:true
        }
    );

    updateAccountNumberDisplay(
        accountNumber
    );

    return accountNumber;

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

    const walletData =
        snapshot.data();

    updateBalanceDisplays(
        walletData.balance
    );

    await ensureAccountNumber(
        walletRef,
        walletData
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

            await verifyPayment(user);

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