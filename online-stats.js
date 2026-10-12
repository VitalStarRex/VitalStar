// VitalStar Online Stats — counts only records confirmed by Firebase.
import { auth, db, rtdb } from "./firebase.js";
import {
  collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref, get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const usersEl = document.getElementById("vsActiveUsers");
const friendsEl = document.getElementById("vsActiveFriends");
const adminsEl = document.getElementById("vsActiveAdmins");
const noteEl = document.getElementById("vsStatsNote");

function setCount(el, count) {
  if (el) el.textContent = Number.isFinite(count) ? count.toLocaleString() : "—";
}
function isOnline(status) {
  if (!status || typeof status !== "object") return false;
  if (status.online === true || status.isOnline === true || status.state === "online") return true;
  // Accept the project's lastSeen/lastActive timestamps when recently updated (last 2 minutes).
  const last = Number(status.lastSeen ?? status.lastActive ?? 0);
  return last > 0 && Date.now() - last <= 120000;
}
async function getStatuses() {
  try {
    const snapshot = await get(ref(rtdb, "status"));
    return snapshot.exists() ? snapshot.val() || {} : {};
  } catch (error) {
    console.warn("VitalStar presence stats unavailable:", error);
    throw error;
  }
}
async function getFriendIds(uid) {
  const ids = new Set();
  const tasks = [
    query(collection(db, "friendRequests"), where("from", "==", uid), where("status", "==", "accepted")),
    query(collection(db, "friendRequests"), where("to", "==", uid), where("status", "==", "accepted"))
  ];
  for (const q of tasks) {
    try {
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data();
        const other = data.from === uid ? data.to : data.from;
        if (other && other !== uid) ids.add(other);
      });
    } catch (error) {
      console.warn("Could not load accepted friends for stats:", error);
    }
  }
  return ids;
}
async function updateStats() {
  if (noteEl) noteEl.hidden = true;
  try {
    const [statuses, userSnapshot] = await Promise.all([
      getStatuses(),
      getDocs(collection(db, "users"))
    ]);
    const onlineIds = new Set(Object.entries(statuses).filter(([, s]) => isOnline(s)).map(([uid]) => uid));
    setCount(usersEl, onlineIds.size);

    const users = userSnapshot.docs.map(d => ({uid:d.id, data:d.data()}));
    const adminIds = new Set(users.filter(({data}) => {
      const role = String(data.role ?? data.accountRole ?? "").toLowerCase();
      return data.isAdmin === true || data.admin === true ||
        ["admin", "superadmin", "super-admin", "moderator"].includes(role);
    }).map(u => u.uid));
    let activeAdmins = 0;
    onlineIds.forEach(uid => { if (adminIds.has(uid)) activeAdmins++; });
    setCount(adminsEl, activeAdmins);

    const current = auth.currentUser;
    if (!current) {
      setCount(friendsEl, 0);
    } else {
      const friendIds = await getFriendIds(current.uid);
      let activeFriends = 0;
      friendIds.forEach(uid => { if (onlineIds.has(uid)) activeFriends++; });
      setCount(friendsEl, activeFriends);
    }
  } catch (error) {
    console.error("VitalStar Online Stats error:", error);
    setCount(usersEl, "—");
    setCount(friendsEl, "—");
    setCount(adminsEl, "—");
    if (noteEl) {
      noteEl.textContent = "Live counts are temporarily unavailable.";
      noteEl.hidden = false;
    }
  }
}
updateStats();
auth.onAuthStateChanged(() => updateStats());
// Refresh counts periodically; no fabricated fallback numbers are shown.
setInterval(updateStats, 60000);
