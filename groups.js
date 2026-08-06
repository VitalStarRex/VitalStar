import { db } from "./firebase.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const groupsList = document.getElementById("groupsList");
const searchInput = document.getElementById("searchInput");
const createBtn = document.getElementById("createGroupBtn");

createBtn.onclick = () => {
    window.location.href = "create-group.html";
};

let allGroups = [];

const q = query(
    collection(db, "groups"),
    orderBy("createdAt", "desc")
);

onSnapshot(q, (snapshot) => {

    allGroups = [];

    snapshot.forEach(doc => {

        allGroups.push({
            id: doc.id,
            ...doc.data()
        });

    });

    displayGroups(allGroups);

});

searchInput.addEventListener("input", () => {

    const text = searchInput.value.toLowerCase();

    const filtered = allGroups.filter(group =>
        group.name.toLowerCase().includes(text)
    );

    displayGroups(filtered);

});

function displayGroups(groups) {

    groupsList.innerHTML = "";

    if (groups.length === 0) {

        groupsList.innerHTML =
            "<h3 style='text-align:center;padding:30px;'>No groups found.</h3>";

        return;
    }

    groups.forEach(group => {

        groupsList.innerHTML += `

<div class="group-card"
onclick="location.href='group.html?id=${group.id}'">

<img class="group-cover"
src="${group.coverPhoto || 'https://via.placeholder.com/800x250'}">

<div class="group-info">

<img class="group-avatar"
src="${group.profilePhoto || 'https://via.placeholder.com/150'}">

<div>

<div class="group-name">
${group.name}
</div>

<div class="group-meta">
👥 ${group.memberCount || 1} Members
</div>

<div class="group-meta">
📂 ${group.category}
</div>

<span class="badge ${group.privacy}">
${group.privacy.toUpperCase()}
</span>

<span class="badge ${group.type}">
${group.type.toUpperCase()}
</span>

</div>

</div>

</div>

`;

    });

}
