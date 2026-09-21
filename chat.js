// ============================================================
// VITALSTAR CHAT — LOADING SCREEN
// ============================================================

const vitalStarChatLoader =
    document.createElement("div");

vitalStarChatLoader.id =
    "vitalStarChatLoader";

vitalStarChatLoader.innerHTML = `

    <div class="vs-chat-loader-content">

        <div class="vs-chat-spinner">

            <span>VS</span>

        </div>

        <div class="vs-chat-loading-text">
            Loading Chat...
        </div>

    </div>

`;


const vitalStarChatLoaderStyle =
    document.createElement("style");

vitalStarChatLoaderStyle.textContent = `

    #vitalStarChatLoader {

        position: fixed;

        inset: 0;

        z-index: 999999;

        background:
            radial-gradient(
                circle at center,
                #100b2b 0%,
                #070512 45%,
                #03020a 100%
            );

        display: flex;

        align-items: center;

        justify-content: center;

        opacity: 1;

        visibility: visible;

        transition:
            opacity 0.55s ease,
            visibility 0.55s ease;

    }


    #vitalStarChatLoader.hide {

        opacity: 0;

        visibility: hidden;

        pointer-events: none;

    }


    .vs-chat-loader-content {

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

    }


    .vs-chat-spinner {

        width: 90px;

        height: 90px;

        border-radius: 50%;

        border:
            5px solid
            rgba(255,255,255,0.10);

        border-top-color:
            #FFD54F;

        border-right-color:
            #9C4DFF;

        border-bottom-color:
            #7C4DFF;

        display: flex;

        align-items: center;

        justify-content: center;

        animation:
            vsChatRotate
            1s linear infinite;

        box-shadow:
            0 0 18px
            rgba(255,213,79,0.25),

            0 0 35px
            rgba(124,77,255,0.18);

    }


    .vs-chat-spinner span {

        font-size: 25px;

        font-weight: 900;

        letter-spacing: 2px;

        color: #FFD54F;

        text-shadow:
            0 0 12px
            rgba(255,213,79,0.45);

        animation:
            vsChatCounterRotate
            1s linear infinite;

    }


    .vs-chat-loading-text {

        margin-top: 18px;

        color:
            rgba(255,255,255,0.88);

        font-size: 14px;

        font-weight: 600;

        letter-spacing: 0.5px;

    }


    @keyframes vsChatRotate {

        from {
            transform:
                rotate(0deg);
        }

        to {
            transform:
                rotate(360deg);
        }

    }


    @keyframes vsChatCounterRotate {

        from {
            transform:
                rotate(0deg);
        }

        to {
            transform:
                rotate(-360deg);
        }

    }

`;


document.head.appendChild(
    vitalStarChatLoaderStyle
);


document.body.appendChild(
    vitalStarChatLoader
);


// ============================================================
// HIDE CHAT LOADING SCREEN
// ============================================================

let chatLoaderHidden = false;


function hideChatLoader() {

    if (chatLoaderHidden) {
        return;
    }

    chatLoaderHidden = true;


    const loader =
        document.getElementById(
            "vitalStarChatLoader"
        );


    if (!loader) {
        return;
    }


    loader.classList.add("hide");


    setTimeout(() => {

        loader.remove();

    }, 650);

}