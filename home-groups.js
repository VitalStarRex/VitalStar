// VitalStar Discover Groups — compatible with groups/{groupId}
import { auth, db } from "./firebase.js";
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const grid = document.getElementById("vsGroupsGrid");
const stateBox = document.getElementById("vsGroupsState");
const section = document.getElementById("vsGroupsSection");
const DEFAULT_GROUPS_URL = "groups.html";

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function showState(message, kind = "empty", retry = false) {
  if (!stateBox) return;
  stateBox.hidden = false;
  stateBox.className = `vs-state ${kind === "error" ? "vs-state-error" : "vs-state-empty"}`;
  stateBox.innerHTML = `<p>${escapeHTML(message)}</p>${retry ? '<button class="vs-state-btn" type="button" id="vsGroupsRetry">Try again</button>' : ""}`;
  if (retry) document.getElementById("vsGroupsRetry")?.addEventListener("click", loadGroups);
}
function groupImage(data) {
  return safeText(data.avatarURL) || safeText(data.avatarUrl) ||
    safeText(data.coverURL) || safeText(data.coverUrl) || "";
}
function renderSkeletons() {
  if (!grid) return;
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({length: 4}, () =>
    '<div class="vs-g-card vs-g-skeleton"><div class="vs-sk-avatar"></div><div class="vs-sk-line"></div><div class="vs-sk-line short"></div><div class="vs-sk-btn"></div></div>'
  ).join("");
}
function renderGroups(groups, user) {
  if (!grid) return;
  grid.innerHTML = "";
  if (!groups.length) {
    showState("No groups are available yet. Create a group or browse all groups.", "empty");
    return;
  }
  stateBox && (stateBox.hidden = true);
  groups.forEach(({id, data}) => {
    const name = safeText(data.name, "VitalStar Group");
    const image = groupImage(data);
    const count = Number(data.memberCount ?? data.membersCount ?? 0);
    const privacy = safeText(data.privacy, safeText(data.type, "public"));
    const verified = data.verified === true;
    const card = document.createElement("article");
    card.className = "vs-g-card";
    const href = `group.html?id=${encodeURIComponent(id)}`;
    const initial = escapeHTML(name.slice(0, 1).toUpperCase());
    card.innerHTML = `
      <a class="vs-g-link" href="${href}">
        <span class="vs-g-avatar">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : initial}</span>
        <span class="vs-g-name">${escapeHTML(name)}${verified ? '<span class="vs-g-verified" aria-label="Verified">✓</span>' : ""}</span>
      </a>
      <div class="vs-g-meta">
        <span>👥 ${Number.isFinite(count) ? count.toLocaleString() : "0"} members</span>
        <span class="vs-g-tag">${escapeHTML(privacy.toLowerCase() === "private" ? "Private" : "Public")}</span>
      </div>
      <a class="vs-g-btn ${user ? "is-primary" : ""}" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${href}">${user ? "View group" : "Explore group"}</a>`;
    const img = card.querySelector("img");
    img?.addEventListener("error", () => {
      img.remove();
      const avatar = card.querySelector(".vs-g-avatar");
      if (avatar) avatar.textContent = name.slice(0, 1).toUpperCase();
    }, {once:true});
    grid.appendChild(card);
  });
}
async function loadGroups() {
  if (!grid) return;
  renderSkeletons();
  stateBox && (stateBox.hidden = true);
  try {
    const snap = await getDocs(collection(db, "groups"));
    const groups = snap.docs.map(d => ({id:d.id, data:d.data()}))
      .filter(g => g.data && g.data.isDeleted !== true && g.data.deleted !== true)
      .sort((a,b) => {
        const aTime = a.data.createdAt?.toMillis?.() ?? (Number(a.data.createdAt) || 0);
        const bTime = b.data.createdAt?.toMillis?.() ?? (Number(b.data.createdAt) || 0);
        return bTime - aTime;
      }).slice(0, 4);
    grid.setAttribute("aria-busy", "false");
    renderGroups(groups, auth.currentUser);
  } catch (error) {
    console.error("VitalStar Discover Groups error:", error);
    grid.innerHTML = "";
    grid.setAttribute("aria-busy", "false");
    showState("Groups could not load. Check your connection or Firebase access, then try again.", "error", true);
  }
}
if (section) {
  loadGroups();
  // Keep cards in sync with auth changes without interfering with the auth guard.
  auth.onAuthStateChanged(() => loadGroups());
}
