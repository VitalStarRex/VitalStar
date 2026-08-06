// Shared Dark Mode Toggle
// Add <script src="dark-mode.js"></script> before </body> on any page
// Add <button id="darkModeToggle">🌙 Dark Mode</button> anywhere you want the switch

document.addEventListener("DOMContentLoaded", function () {
  const isDark = localStorage.getItem("darkMode") === "true";

  if (isDark) {
    document.body.classList.add("dark-mode");
  }

  const toggleBtn = document.getElementById("darkModeToggle");

  if (toggleBtn) {
    toggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";

    toggleBtn.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");

      const nowDark = document.body.classList.contains("dark-mode");
      localStorage.setItem("darkMode", nowDark);

      toggleBtn.textContent = nowDark ? "☀️ Light Mode" : "🌙 Dark Mode";
    });
  }
});