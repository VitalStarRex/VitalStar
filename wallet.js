// ============================================================
// VITALSTAR WALLET
// Handles wallet balance display on home.html
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
// AUTH + LOAD WALLET
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if(!user){

            return;

        }

        try{

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

            // Create a new wallet
            // ONLY with ₦0 starting balance
            if(!walletSnap.exists()){

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

                if(walletBalance){

                    walletBalance.textContent =
                        formatMoney(0);

                }

                return;

            }

            const walletData =
                walletSnap.data();

            const balance =
                Number(
                    walletData.balance
                ) || 0;

            if(walletBalance){

                walletBalance.textContent =
                    formatMoney(balance);

            }

        }

        catch(error){

            console.error(
                "Wallet loading error:",
                error
            );

            if(walletBalance){

                walletBalance.textContent =
                    "₦0";

            }

        }

    }
);