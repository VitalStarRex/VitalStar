/* =========================================================
   VITALSTAR — THEME CONTROLLER (theme.js)

   Load as a NORMAL script (not type="module") in <head>
   so the saved theme is applied before the page paints:

     <script src="theme.js"></script>

   Any element with the attribute  data-open-theme
   opens the Theme Settings popup.

   Public API:
     VitalStarTheme.get()        -> "dark" | "light"
     VitalStarTheme.set("light") -> switch + save
     VitalStarTheme.open()       -> open the popup
     VitalStarTheme.close()      -> close the popup
   ========================================================= */

(function(){

    "use strict";

    var KEY = "vitalstar-theme";
    var root = document.documentElement;
    var overlay = null;

    /* ---------- read / save ---------- */

    function read(){
        try{
            var saved = localStorage.getItem(KEY);
            if(saved === "light" || saved === "dark"){
                return saved;
            }
        }catch(e){}
        /* Existing users without a saved choice get Dark. */
        return "dark";
    }

    function save(theme){
        try{
            localStorage.setItem(KEY, theme);
        }catch(e){}
    }

    /* ---------- apply ---------- */

    function setMetaColor(theme){
        var meta = document.querySelector('meta[name="theme-color"]');

        if(!meta){
            meta = document.createElement("meta");
            meta.name = "theme-color";
            (document.head || root).appendChild(meta);
        }

        meta.setAttribute(
            "content",
            theme === "light" ? "#f2f5fc" : "#070914"
        );
    }

    function markActive(theme){
        if(!overlay){
            return;
        }

        overlay
            .querySelectorAll("[data-theme-value]")
            .forEach(function(button){
                var active =
                    button.getAttribute("data-theme-value") === theme;

                button.classList.toggle("is-active", active);
                button.setAttribute("aria-pressed", String(active));
            });
    }

    function apply(theme, animate){
        if(animate){
            root.classList.add("vs-theming");
            setTimeout(function(){
                root.classList.remove("vs-theming");
            }, 400);
        }

        root.setAttribute("data-theme", theme);
        setMetaColor(theme);
        markActive(theme);

        try{
            window.dispatchEvent(
                new CustomEvent("vitalstar-theme-change", {
                    detail:{ theme: theme }
                })
            );
        }catch(e){}
    }

    function set(theme){
        if(theme !== "light" && theme !== "dark"){
            return;
        }
        save(theme);
        apply(theme, true);
    }

    /* Apply immediately (before first paint). */
    apply(read(), false);

    /* ---------- popup ---------- */

    function build(){
        if(overlay){
            return;
        }

        overlay = document.createElement("div");
        overlay.className = "vs-theme-overlay";
        overlay.hidden = true;

        overlay.innerHTML =
            '<div class="vs-theme-modal" role="dialog" aria-modal="true" aria-labelledby="vsThemeTitle">' +
                '<div class="vs-theme-head">' +
                    '<h2 id="vsThemeTitle">Theme Settings</h2>' +
                    '<button type="button" class="vs-theme-x" aria-label="Close">✕</button>' +
                '</div>' +
                '<p class="vs-theme-sub">Choose how VitalStar looks everywhere.</p>' +
                '<div class="vs-theme-options">' +
                    '<button type="button" class="vs-theme-opt" data-theme-value="dark">' +
                        '<div class="vs-theme-prev dark"></div>🌙 Dark' +
                    '</button>' +
                    '<button type="button" class="vs-theme-opt" data-theme-value="light">' +
                        '<div class="vs-theme-prev light"></div>☀️ White' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.addEventListener("click", function(event){
            if(
                event.target === overlay ||
                event.target.closest(".vs-theme-x")
            ){
                close();
                return;
            }

            var option = event.target.closest("[data-theme-value]");

            if(option){
                set(option.getAttribute("data-theme-value"));
            }
        });

        markActive(read());
    }

    function open(){
        build();
        markActive(read());
        overlay.hidden = false;
    }

    function close(){
        if(overlay){
            overlay.hidden = true;
        }
    }

    /* Any element with data-open-theme opens the popup. */
    document.addEventListener("click", function(event){
        var trigger =
            event.target.closest &&
            event.target.closest("[data-open-theme]");

        if(trigger){
            event.preventDefault();
            open();
        }
    });

    document.addEventListener("keydown", function(event){
        if(event.key === "Escape"){
            close();
        }
    });

    /* Keep other open tabs/pages in sync. */
    window.addEventListener("storage", function(event){
        if(event.key === KEY){
            apply(read(), true);
        }
    });

    /* ---------- COINS: never show real-money symbols ----------
       Older scripts (wallet.js) may write text like "₦1,200".
       This quietly turns it into a plain coin number. */

    function cleanCoinText(element){
        var text = element.textContent;
        var cleaned = text.replace(/[₦$€£]/g, "").trim();

        if(cleaned === ""){
            cleaned = "0";
        }

        if(cleaned !== text){
            element.textContent = cleaned;
        }
    }

    function watchCoins(){
        var targets = document.querySelectorAll("[data-coin-balance]");

        targets.forEach(function(element){
            cleanCoinText(element);

            new MutationObserver(function(){
                cleanCoinText(element);
            }).observe(element, {
                childList:true,
                characterData:true,
                subtree:true
            });
        });
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", watchCoins);
    }else{
        watchCoins();
    }

    window.VitalStarTheme = {
        get: read,
        set: set,
        open: open,
        close: close
    };

})();
