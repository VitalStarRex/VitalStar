/* VITALSTAR — FRIEND SYSTEM (short version) — Firebase v10.12.2 */
import {
  collection, query, where, onSnapshot, getDocs, getDoc, doc,
  addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onValue, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { auth, db, rtdb } from "./firebase.js";

/* STATE */
let me = null;
let friends = [], incoming = [], outgoing = [], allUsers = [];
const presence = new Map();
const listening = new Set();

const $ = id => document.getElementById(id);
const el = {
  friends: $("friendsList"), requests: $("requestsList"), sent: $("sentList"),
  discover: $("discoverList"), search: $("searchInput"),
  friendsCount: $("friendsCount"), requestsCount: $("requestsCount"),
  sentCount: $("sentCount"), discoverCount: $("discoverCount")
};

/* HELPERS */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

const nameOf = u => u.fullName || u.displayName || u.username || "VitalStar User";
const handleOf = u => !u.username ? "" : u.username.startsWith("@") ? u.username : "@" + u.username;
const avatarOf = u => u.profilePicture || u.photoURL ||
  "https://ui-avatars.com/api/?name=" + encodeURIComponent(nameOf(u)) + "&background=171d32&color=ffffff";
const friendKey = (a, b) => [a, b].sort().join("_");

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

async function getUser(uid) {
  try {
    const s = await getDoc(doc(db, "users", uid));
    if (s.exists()) return { uid, ...s.data() };
  } catch (e) { console.error("getUser:", e); }
  return { uid, fullName: "VitalStar User", username: "", profilePicture: "" };
}

/* PRESENCE */
function lastSeen(ts) {
  if (!ts) return "Offline";
  let t = typeof ts === "object"
    ? (ts.toMillis ? ts.toMillis() : ts.seconds * 1000)
    : Number(ts);
  if (!Number.isFinite(t)) return "Offline";
  const s = Math.max(0, Date.now() - t) / 1000;
  if (s < 60) return "last seen just now";
  const units = [["minute", 60, 60], ["hour", 3600, 24], ["day", 86400, 7], ["week", 604800, 5]];
  for (const [name, size, max] of units) {
    const n = Math.floor(s / size);
    if (n < max) return `last seen ${n} ${name}${n === 1 ? "" : "s"} ago`;
  }
  return "Offline";
}

function listenPresence(uid) {
  if (!uid || listening.has(uid)) return;
  listening.add(uid);
  onValue(ref(rtdb, "status/" + uid), snap => {
    const d = snap.val();
    presence.set(uid, { online: d?.online === true, lastSeen: d?.lastSeen || null });
    renderAll();
  }, e => console.error("Presence:", e));
}

function syncPresence() {
  [
    ...friends.map(u => u.uid),
    ...incoming.map(r => r.from),
    ...outgoing.map(r => r.to),
    ...allUsers.map(u => u.uid)
  ].forEach(listenPresence);
}

/* RENDER */
const btn = (cls, act, id, label) =>
  `<button class="action-btn ${cls}" data-act="${act}" data-id="${esc(id)}">${label}</button>`;

const empty = (icon, title, text) =>
  `<div class="empty"><div class="empty-icon">${icon}</div><strong>${title}</strong><p>${text}</p></div>`;

function card(user, actions) {
  const uid = user.uid || user.id;
  const p = presence.get(uid) || { online: false, lastSeen: null };
  return `
  <div class="user-card" data-uid="${esc(uid)}">
    <div class="avatar-wrap"><img class="avatar" src="${esc(avatarOf(user))}" alt="" loading="lazy"></div>
    <div class="user-details">
      <div class="user-name">${esc(nameOf(user))}</div>
      <div class="username">${esc(handleOf(user))}</div>
      <div class="presence-status ${p.online ? "online" : "offline"}">
        <span class="presence-dot"></span>
        <span>${p.online ? "Online" : esc(lastSeen(p.lastSeen))}</span>
      </div>
    </div>
    <div class="user-actions">${actions}</div>
  </div>`;
}

function relationship(uid) {
  if (friends.some(u => u.uid === uid)) return "friend";
  if (incoming.some(r => r.from === uid)) return "incoming";
  if (outgoing.some(r => r.to === uid)) return "sent";
  return "none";
}

function renderFriends() {
  if (!el.friends) return;
  el.friends.innerHTML = friends.length
    ? friends.map(u => card(u,
        btn("neutral", "profile", u.uid, "Profile") +
        btn("primary", "message", u.uid, "Chat") +
        btn("danger", "remove", u.uid, "Remove"))).join("")
    : empty("👥", "No friends yet", "Discover people and send your first friend request.");
}

function renderRequests() {
  if (!el.requests) return;
  el.requests.innerHTML = incoming.length
    ? incoming.map(r => card(r.user,
        btn("success", "accept", r.id, "Accept") +
        btn("danger", "decline", r.id, "Decline"))).join("")
    : empty("📭", "No friend requests", "New requests will appear here.");
}

function renderSent() {
  if (!el.sent) return;
  el.sent.innerHTML = outgoing.length
    ? outgoing.map(r => card(r.user,
        btn("neutral", "profile", r.user.uid, "Profile") +
        btn("danger", "cancel", r.id, "Cancel"))).join("")
    : empty("📤", "No pending requests", "Requests you send will appear here.");
}

function renderDiscover() {
  if (!el.discover) return;
  const term = el.search ? el.search.value.trim().toLowerCase() : "";
  const users = allUsers.filter(u =>
    !term || nameOf(u).toLowerCase().includes(term) ||
    String(u.username || "").toLowerCase().includes(term));

  if (el.discoverCount) el.discoverCount.textContent = users.length;
  if (!users.length) {
    el.discover.innerHTML = empty("🔎", "No people found", "Try another name or username.");
    return;
  }

  el.discover.innerHTML = users.map(u => {
    const rel = relationship(u.uid);
    const profile = btn("neutral", "profile", u.uid, "Profile");
    const actions =
      rel === "friend" ? profile + btn("primary", "message", u.uid, "Chat") :
      rel === "incoming" ? btn("success", "acceptIncomingByUser", u.uid, "Accept") :
      rel === "sent" ? `<button class="action-btn neutral" disabled>Request Sent</button>` :
      profile + btn("primary", "add", u.uid, "+ Add");
    return card(u, actions);
  }).join("");
}

function renderAll() {
  renderFriends(); renderRequests(); renderSent(); renderDiscover();
}

function updateCounts() {
  const n = friends.length;
  if (el.friendsCount) el.friendsCount.textContent = n === 1 ? "1 friend" : `${n} friends`;
  if (el.requestsCount) el.requestsCount.textContent = incoming.length;
  if (el.sentCount) el.sentCount.textContent = outgoing.length;
  window.VitalStarFriendsCount = n;
}

/* LISTENERS */
function listenFriends() {
  const q = query(collection(db, "friends"), where("users", "array-contains", me.uid));
  onSnapshot(q, async snap => {
    const rows = await Promise.all(snap.docs.map(async d => {
      const users = d.data().users;
      if (!Array.isArray(users) || users.length !== 2) return null;
      const other = users.find(id => id !== me.uid);
      return other ? { ...(await getUser(other)), friendshipId: d.id } : null;
    }));
    friends = rows.filter(Boolean);
    updateCounts(); syncPresence(); renderAll();
  }, e => {
    console.error("Friends:", e);
    if (el.friends) el.friends.innerHTML =
      empty("⚠️", "Could not load friends", esc(e.message));
  });
}

function listenRequests(field, otherField, setter) {
  const q = query(
    collection(db, "friendRequests"),
    where(field, "==", me.uid),
    where("status", "==", "pending")
  );
  onSnapshot(q, async snap => {
    const rows = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      return { id: d.id, ...data, user: await getUser(data[otherField]) };
    }));
    setter(rows);
    updateCounts(); syncPresence(); renderAll();
  }, e => console.error("Requests:", e));
}

async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== me.uid);
    syncPresence(); renderDiscover();
  } catch (e) {
    console.error("Users:", e);
    if (el.discover) el.discover.innerHTML =
      empty("⚠️", "Could not load users", esc(e.message));
  }
}

/* NOTIFICATIONS */
async function notify({ receiverId, type, text, requestId }) {
  if (!receiverId || receiverId === me.uid) return;
  try {
    const sender = await getUser(me.uid);
    const photo = sender.profilePicture || sender.photoURL || "";
    const id = requestId ? `${type}_${requestId}` : `${type}_${me.uid}_${receiverId}`;
    await setDoc(doc(db, "notifications", id), {
      receiverId, recipientId: receiverId, senderId: me.uid,
      senderName: nameOf(sender), senderPhoto: photo, senderPhotoURL: photo,
      type, text, message: text, read: false,
      createdAt: serverTimestamp(),
      ...(requestId ? { requestId } : {})
    });
  } catch (e) { console.error("Notification:", e); }
}

/* ACTIONS */
async function addFriend(uid) {
  if (!me || uid === me.uid) return;
  if (relationship(uid) !== "none") return toast("You already have a connection with this user.");
  try {
    const r = await addDoc(collection(db, "friendRequests"), {
      from: me.uid, to: uid, status: "pending", createdAt: serverTimestamp()
    });
    const sender = await getUser(me.uid);
    await notify({
      receiverId: uid, type: "friend_request", requestId: r.id,
      text: `${nameOf(sender)} sent you a friend request.`
    });
    toast("Friend request sent!");
  } catch (e) {
    console.error("Add friend:", e);
    toast("Could not send request.");
  }
}

async function acceptRequest(id) {
  const req = incoming.find(r => r.id === id);
  if (!req) return;
  try {
    await addDoc(collection(db, "friends"), {
      users: [me.uid, req.from],
      key: friendKey(me.uid, req.from),
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "friendRequests", id), { status: "accepted" });
    const sender = await getUser(me.uid);
    await notify({
      receiverId: req.from, type: "friend_accepted", requestId: id,
      text: `${nameOf(sender)} accepted your friend request.`
    });
    toast("You are now friends!");
  } catch (e) {
    console.error("Accept:", e);
    toast("Could not accept request.");
  }
}

const acceptIncomingByUser = async uid => {
  const req = incoming.find(r => r.from === uid);
  if (req) await acceptRequest(req.id);
};

async function declineRequest(id) {
  try {
    await updateDoc(doc(db, "friendRequests", id), { status: "declined" });
    toast("Friend request declined.");
  } catch (e) {
    console.error("Decline:", e);
    toast("Could not decline request.");
  }
}

async function cancelRequest(id) {
  try {
    await deleteDoc(doc(db, "friendRequests", id));
    toast("Friend request cancelled.");
  } catch (e) {
    console.error("Cancel:", e);
    toast("Could not cancel request.");
  }
}

async function removeFriend(uid) {
  if (!confirm("Remove this person from your friends?")) return;
  try {
    const snap = await getDocs(
      query(collection(db, "friends"), where("users", "array-contains", me.uid))
    );
    const match = snap.docs.find(d => d.data().users?.includes(uid));
    if (match) await deleteDoc(doc(db, "friends", match.id));
    toast("Friend removed.");
  } catch (e) {
    console.error("Remove:", e);
    toast("Could not remove friend.");
  }
}

const openProfile = uid => location.href = "profile.html?uid=" + encodeURIComponent(uid);
const messageUser = uid => location.href = "chat.html?uid=" + encodeURIComponent(uid);

/* TABS + SEARCH */
function activateTab(tab) {
  document.querySelectorAll(".tab").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === tab));
  ["friends", "requests", "sent", "discover"].forEach(name => {
    const s = $(name + "Section");
    if (s) s.style.display = tab === name ? "block" : "none";
  });
  if (tab === "discover" && el.search) el.search.focus();
}

document.querySelectorAll(".tab").forEach(b =>
  b.addEventListener("click", () => activateTab(b.dataset.tab)));
el.search?.addEventListener("input", renderDiscover);

/* PUBLIC API */
const API = {
  add: addFriend, accept: acceptRequest, acceptIncomingByUser,
  decline: declineRequest, cancel: cancelRequest, remove: removeFriend,
  profile: openProfile, message: messageUser,
  getCount: () => friends.length
};
window.VitalStarFriends = API;

/* One click handler for every button (no inline onclick needed) */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b && API[b.dataset.act]) API[b.dataset.act](b.dataset.id);
});

/* AUTH */
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "login.html";
  me = user;
  listenFriends();
  listenRequests("to", "from", rows => incoming = rows);
  listenRequests("from", "to", rows => outgoing = rows);
  await loadUsers();
});
