// ============================================================
// VITALSTAR — groups.js
// Groups Discovery / My Groups / Trending / Recommended
// ============================================================

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// CONFIG
// ============================================================

const GROUPS_PAGE_SIZE = 12;
const TOP_ACTIVE_LIMIT = 5;
const RECOMMENDED_LIMIT = 10;
const TRENDING_LIMIT = 10;
const NEW_GROUPS_LIMIT = 10;

const GROUPS_STYLE_ID = "vitalstar-groups-styles";

// ============================================================
// STATE
// ============================================================

let currentUser = null;

let state = {
  allGroups: [],
  myGroups: [],
  recommendedGroups: [],
  trendingGroups: [],
  topActiveGroups: [],
  newGroups: [],

  searchTerm: "",
  category: "all",

  loading: false,

  cursors: {
    discover: null,
    new: null,
    trending: null,
    recommended: null
  },

  hasMore: {
    discover: true,
    new: true,
    trending: true,
    recommended: true
  },

  membershipMap: new Map(),

  userProfile: null
};

// ============================================================
// DOM
// ============================================================

let appRoot = null;

// ============================================================
// INIT
// ============================================================

function init() {
  injectStyles();

  onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (!user) {
      showLoggedOut();
      return;
    }

    await startGroupsPage();
  });
}

async function startGroupsPage() {
  appRoot = findGroupsContainer();

  if (!appRoot) {
    console.error(
      "VitalStar Groups: Could not find groups container."
    );

    return;
  }

  renderPageShell();

  await loadUserProfile();

  await loadMyGroups();

  await Promise.all([
    loadTopActiveGroups(),
    loadNewGroups(true),
    loadTrendingGroups(true),
    loadRecommendedGroups(true),
    loadDiscoverGroups(true)
  ]);
}

// ============================================================
// FIND CONTAINER
// ============================================================

function findGroupsContainer() {
  return (
    document.querySelector("#groupsContainer") ||
    document.querySelector("#groupsPage") ||
    document.querySelector("#groupsList") ||
    document.querySelector(".groups-container") ||
    document.querySelector("main")
  );
}

// ============================================================
// LOGGED OUT
// ============================================================

function showLoggedOut() {
  const root = findGroupsContainer();

  if (!root) return;

  root.innerHTML = `
    <div class="vs-groups-login-required">
      <div class="vs-groups-login-icon">
        <i class="fa-solid fa-users"></i>
      </div>

      <h2>Join VitalStar Groups</h2>

      <p>
        Sign in to discover groups, join communities,
        and connect with other members.
      </p>

      <a href="login.html" class="vs-primary-btn">
        Sign In
      </a>
    </div>
  `;
}

// ============================================================
// PAGE SHELL
// ============================================================

function renderPageShell() {
  appRoot.innerHTML = `
    <div class="vs-groups-page">

      <!-- HEADER -->
      <section class="vs-groups-header">

        <div>
          <div class="vs-eyebrow">
            <i class="fa-solid fa-users"></i>
            Communities
          </div>

          <h1>Groups</h1>

          <p>
            Discover communities that match your interests.
          </p>
        </div>

        <a
          href="create-group.html"
          class="vs-create-group-btn"
        >
          <i class="fa-solid fa-plus"></i>
          Create Group
        </a>

      </section>

      <!-- SEARCH -->
      <section class="vs-groups-search">

        <div class="vs-search-box">
          <i class="fa-solid fa-magnifying-glass"></i>

          <input
            id="groupSearchInput"
            type="search"
            placeholder="Search groups..."
            autocomplete="off"
          >

          <button
            id="clearGroupSearch"
            type="button"
            style="display:none"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div
          class="vs-category-scroll"
          id="groupCategories"
        >
          <button
            class="vs-category-btn active"
            data-category="all"
          >
            All
          </button>

          <button
            class="vs-category-btn"
            data-category="technology"
          >
            Technology
          </button>

          <button
            class="vs-category-btn"
            data-category="gaming"
          >
            Gaming
          </button>

          <button
            class="vs-category-btn"
            data-category="education"
          >
            Education
          </button>

          <button
            class="vs-category-btn"
            data-category="music"
          >
            Music
          </button>

          <button
            class="vs-category-btn"
            data-category="sports"
          >
            Sports
          </button>

          <button
            class="vs-category-btn"
            data-category="business"
          >
            Business
          </button>

          <button
            class="vs-category-btn"
            data-category="entertainment"
          >
            Entertainment
          </button>

          <button
            class="vs-category-btn"
            data-category="other"
          >
            Other
          </button>
        </div>

      </section>

      <!-- MY GROUPS -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-user-group"></i>
              My Groups
            </h2>

            <p>Communities you've joined</p>
          </div>

          <button
            class="vs-section-link"
            id="viewAllMyGroups"
          >
            View all
          </button>

        </div>

        <div
          id="myGroupsGrid"
          class="vs-groups-grid"
        >
          ${loadingSkeleton(4)}
        </div>

      </section>

      <!-- TOP ACTIVE -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-fire"></i>
              Top 5 Most Active
            </h2>

            <p>The busiest communities right now</p>
          </div>

        </div>

        <div
          id="topActiveGroups"
          class="vs-groups-grid vs-top-active-grid"
        >
          ${loadingSkeleton(5)}
        </div>

      </section>

      <!-- TRENDING -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-chart-line"></i>
              Trending
            </h2>

            <p>Groups getting attention right now</p>
          </div>

          <button
            class="vs-section-link"
            data-section="trending"
          >
            More
          </button>

        </div>

        <div
          id="trendingGroups"
          class="vs-groups-grid"
        >
          ${loadingSkeleton(4)}
        </div>

        <button
          id="loadMoreTrending"
          class="vs-load-more"
          style="display:none"
        >
          Load more
        </button>

      </section>

      <!-- NEW -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-sparkles"></i>
              New Groups
            </h2>

            <p>Fresh communities waiting for members</p>
          </div>

          <button
            class="vs-section-link"
            data-section="new"
          >
            More
          </button>

        </div>

        <div
          id="newGroups"
          class="vs-groups-grid"
        >
          ${loadingSkeleton(4)}
        </div>

        <button
          id="loadMoreNew"
          class="vs-load-more"
          style="display:none"
        >
          Load more
        </button>

      </section>

      <!-- RECOMMENDED -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              Recommended For You
            </h2>

            <p>Communities you may enjoy</p>
          </div>

        </div>

        <div
          id="recommendedGroups"
          class="vs-groups-grid"
        >
          ${loadingSkeleton(4)}
        </div>

        <button
          id="loadMoreRecommended"
          class="vs-load-more"
          style="display:none"
        >
          Load more
        </button>

      </section>

      <!-- DISCOVER -->
      <section class="vs-group-section">

        <div class="vs-section-header">

          <div>
            <h2>
              <i class="fa-solid fa-compass"></i>
              Discover Groups
            </h2>

            <p>Explore all public communities</p>
          </div>

        </div>

        <div
          id="discoverGroups"
          class="vs-groups-grid"
        >
          ${loadingSkeleton(8)}
        </div>

        <button
          id="loadMoreDiscover"
          class="vs-load-more"
          style="display:none"
        >
          Load more
        </button>

      </section>

      <!-- SEARCH RESULTS -->
      <section
        id="groupSearchResultsSection"
        class="vs-group-section"
        style="display:none"
      >

        <div class="vs-section-header">
          <div>
            <h2>
              <i class="fa-solid fa-magnifying-glass"></i>
              Search Results
            </h2>

            <p id="searchResultLabel"></p>
          </div>
        </div>

        <div
          id="groupSearchResults"
          class="vs-groups-grid"
        ></div>

      </section>

    </div>
  `;

  bindPageEvents();
}

// ============================================================
// PAGE EVENTS
// ============================================================

function bindPageEvents() {
  const search =
    document.querySelector("#groupSearchInput");

  const clear =
    document.querySelector("#clearGroupSearch");

  if (search) {
    let timer;

    search.addEventListener("input", () => {
      clearTimeout(timer);

      state.searchTerm =
        search.value.trim();

      clear.style.display =
        state.searchTerm
          ? "flex"
          : "none";

      timer = setTimeout(
        runSearch,
        350
      );
    });
  }

  if (clear) {
    clear.onclick = () => {
      search.value = "";
      state.searchTerm = "";
      clear.style.display = "none";

      hideSearchResults();

      document
        .querySelectorAll(
          ".vs-category-btn"
        )
        .forEach(btn =>
          btn.classList.remove(
            "active"
          )
        );

      document
        .querySelector(
          '.vs-category-btn[data-category="all"]'
        )
        ?.classList.add("active");
    };
  }

  document
    .querySelectorAll(
      ".vs-category-btn"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              ".vs-category-btn"
            )
            .forEach(btn =>
              btn.classList.remove(
                "active"
              )
            );

          button.classList.add(
            "active"
          );

          state.category =
            button.dataset.category ||
            "all";

          if (state.searchTerm) {
            runSearch();
          } else {
            loadDiscoverGroups(true);
          }
        }
      );
    });

  document
    .querySelector(
      "#loadMoreDiscover"
    )
    ?.addEventListener(
      "click",
      () => loadDiscoverGroups(false)
    );

  document
    .querySelector(
      "#loadMoreNew"
    )
    ?.addEventListener(
      "click",
      () => loadNewGroups(false)
    );

  document
    .querySelector(
      "#loadMoreTrending"
    )
    ?.addEventListener(
      "click",
      () => loadTrendingGroups(false)
    );

  document
    .querySelector(
      "#loadMoreRecommended"
    )
    ?.addEventListener(
      "click",
      () => loadRecommendedGroups(false)
    );

  document
    .querySelector(
      "#viewAllMyGroups"
    )
    ?.addEventListener(
      "click",
      () => {
        const grid =
          document.querySelector(
            "#myGroupsGrid"
          );

        if (!grid) return;

        grid.classList.toggle(
          "expanded"
        );

        document.querySelector(
          "#viewAllMyGroups"
        ).textContent =
          grid.classList.contains(
            "expanded"
          )
            ? "Show less"
            : "View all";
      }
    );
}

// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile() {
  if (!currentUser) return;

  try {
    const snap =
      await getDoc(
        doc(
          db,
          "users",
          currentUser.uid
        )
      );

    state.userProfile =
      snap.exists()
        ? snap.data()
        : {};

  } catch (error) {
    console.error(
      "Could not load user profile:",
      error
    );

    state.userProfile = {};
  }
}

// ============================================================
// MY GROUPS
// ============================================================

async function loadMyGroups() {
  const grid =
    document.querySelector(
      "#myGroupsGrid"
    );

  if (!grid || !currentUser)
    return;

  try {
    const membershipQuery =
      query(
        collectionGroup(
          db,
          "members"
        ),
        where(
          "uid",
          "==",
          currentUser.uid
        ),
        where(
          "status",
          "==",
          "active"
        ),
        limit(100)
      );

    const membershipSnapshot =
      await getDocs(
        membershipQuery
      );

    const groups = [];

    for (
      const membershipDoc of
        membershipSnapshot.docs
    ) {
      const groupRef =
        membershipDoc.ref.parent
          .parent;

      if (!groupRef)
        continue;

      const groupSnap =
        await getDoc(
          groupRef
        );

      if (!groupSnap.exists())
        continue;

      const group =
        normalizeGroup(
          groupSnap.id,
          groupSnap.data()
        );

      state.membershipMap.set(
        group.id,
        {
          status: "active",
          role:
            membershipDoc.data()
              .role || "member"
        }
      );

      groups.push(group);
    }

    groups.sort(
      (a, b) => {
        const aTime =
          getTimestampMillis(
            a.updatedAt ||
              a.lastActivityAt
          );

        const bTime =
          getTimestampMillis(
            b.updatedAt ||
              b.lastActivityAt
          );

        return bTime - aTime;
      }
    );

    state.myGroups =
      groups;

    renderMyGroups();

  } catch (error) {
    console.error(
      "Could not load My Groups:",
      error
    );

    grid.innerHTML =
      emptyState(
        "fa-users",
        "Your groups could not be loaded."
      );
  }
}

function renderMyGroups() {
  const grid =
    document.querySelector(
      "#myGroupsGrid"
    );

  if (!grid) return;

  if (!state.myGroups.length) {
    grid.innerHTML =
      emptyState(
        "fa-user-group",
        "You haven't joined any groups yet.",
        "Explore groups below to find a community."
      );

    return;
  }

  const visible =
    grid.classList.contains(
      "expanded"
    )
      ? state.myGroups
      : state.myGroups.slice(
          0,
          4
        );

  grid.innerHTML = "";

  visible.forEach(
    group =>
      grid.appendChild(
        createGroupCard(
          group,
          {
            myGroup: true
          }
        )
      )
  );
}

// ============================================================
// TOP 5 ACTIVE
// ============================================================

async function loadTopActiveGroups() {
  const container =
    document.querySelector(
      "#topActiveGroups"
    );

  if (!container)
    return;

  try {
    let snapshot;

    try {
      snapshot =
        await getDocs(
          query(
            collection(
              db,
              "groups"
            ),
            where(
              "privacy",
              "==",
              "public"
            ),
            orderBy(
              "activityScore",
              "desc"
            ),
            limit(
              TOP_ACTIVE_LIMIT
            )
          )
        );
    } catch {
      /*
       * Fallback for groups that have not yet received
       * activityScore fields.
       */
      snapshot =
        await getDocs(
          query(
            collection(
              db,
              "groups"
            ),
            where(
              "privacy",
              "==",
              "public"
            ),
            orderBy(
              "updatedAt",
              "desc"
            ),
            limit(
              TOP_ACTIVE_LIMIT
            )
          )
        );
    }

    const groups =
      snapshot.docs.map(
        d =>
          normalizeGroup(
            d.id,
            d.data()
          )
      );

    state.topActiveGroups =
      groups;

    container.innerHTML = "";

    if (!groups.length) {
      container.innerHTML =
        emptyState(
          "fa-fire",
          "No active groups yet."
        );

      return;
    }

    groups.forEach(
      (group, index) => {
        const card =
          createGroupCard(
            group,
            {
              rank:
                index + 1,
              active:
                true
            }
          );

        container.appendChild(
          card
        );
      }
    );

  } catch (error) {
    console.error(
      "Could not load top active groups:",
      error
    );

    container.innerHTML =
      emptyState(
        "fa-fire",
        "Unable to load active groups."
      );
  }
}

// ============================================================
// NEW GROUPS
// ============================================================

async function loadNewGroups(
  reset = false
) {
  const container =
    document.querySelector(
      "#newGroups"
    );

  if (!container)
    return;

  if (state.loading)
    return;

  state.loading = true;

  if (reset) {
    state.cursors.new =
      null;

    state.hasMore.new =
      true;

    container.innerHTML =
      loadingSkeleton(4);
  }

  try {
    const constraints = [
      where(
        "privacy",
        "==",
        "public"
      ),
      orderBy(
        "createdAt",
        "desc"
      ),
      limit(
        NEW_GROUPS_LIMIT
      )
    ];

    if (
      !reset &&
      state.cursors.new
    ) {
      constraints.push(
        startAfter(
          state.cursors.new
        )
      );
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "groups"
          ),
          ...constraints
        )
      );

    if (reset)
      container.innerHTML = "";

    if (
      snapshot.docs.length
    ) {
      state.cursors.new =
        snapshot.docs[
          snapshot.docs.length - 1
        ];
    }

    state.hasMore.new =
      snapshot.docs.length ===
      NEW_GROUPS_LIMIT;

    snapshot.docs.forEach(
      groupDoc => {
        const group =
          normalizeGroup(
            groupDoc.id,
            groupDoc.data()
          );

        container.appendChild(
          createGroupCard(
            group
          )
        );
      }
    );

    if (
      reset &&
      snapshot.empty
    ) {
      container.innerHTML =
        emptyState(
          "fa-sparkles",
          "No new groups yet."
        );
    }

    updateLoadMoreButton(
      "#loadMoreNew",
      state.hasMore.new
    );

  } catch (error) {
    console.error(
      "Could not load new groups:",
      error
    );

    if (reset) {
      container.innerHTML =
        emptyState(
          "fa-sparkles",
          "Could not load new groups."
        );
    }

  } finally {
    state.loading = false;
  }
}

// ============================================================
// TRENDING
// ============================================================

async function loadTrendingGroups(
  reset = false
) {
  const container =
    document.querySelector(
      "#trendingGroups"
    );

  if (!container)
    return;

  if (state.loading)
    return;

  state.loading = true;

  if (reset) {
    state.cursors.trending =
      null;

    state.hasMore.trending =
      true;

    container.innerHTML =
      loadingSkeleton(4);
  }

  try {
    const constraints = [
      where(
        "privacy",
        "==",
        "public"
      ),
      orderBy(
        "activityScore",
        "desc"
      ),
      limit(
        TRENDING_LIMIT
      )
    ];

    if (
      !reset &&
      state.cursors.trending
    ) {
      constraints.push(
        startAfter(
          state.cursors.trending
        )
      );
    }

    let snapshot;

    try {
      snapshot =
        await getDocs(
          query(
            collection(
              db,
              "groups"
            ),
            ...constraints
          )
        );
    } catch {
      snapshot =
        await getDocs(
          query(
            collection(
              db,
              "groups"
            ),
            where(
              "privacy",
              "==",
              "public"
            ),
            orderBy(
              "updatedAt",
              "desc"
            ),
            limit(
              TRENDING_LIMIT
            )
          )
        );
    }

    if (reset)
      container.innerHTML = "";

    if (
      snapshot.docs.length
    ) {
      state.cursors.trending =
        snapshot.docs[
          snapshot.docs.length - 1
        ];
    }

    state.hasMore.trending =
      snapshot.docs.length ===
      TRENDING_LIMIT;

    snapshot.docs.forEach(
      groupDoc => {
        const group =
          normalizeGroup(
            groupDoc.id,
            groupDoc.data()
          );

        container.appendChild(
          createGroupCard(
            group,
            {
              trending: true
            }
          )
        );
      }
    );

    if (
      reset &&
      snapshot.empty
    ) {
      container.innerHTML =
        emptyState(
          "fa-chart-line",
          "No trending groups yet."
        );
    }

    updateLoadMoreButton(
      "#loadMoreTrending",
      state.hasMore.trending
    );

  } catch (error) {
    console.error(
      "Could not load trending groups:",
      error
    );

    if (reset) {
      container.innerHTML =
        emptyState(
          "fa-chart-line",
          "Could not load trending groups."
        );
    }

  } finally {
    state.loading = false;
  }
}

// ============================================================
// RECOMMENDED
// ============================================================

async function loadRecommendedGroups(
  reset = false
) {
  const container =
    document.querySelector(
      "#recommendedGroups"
    );

  if (!container)
    return;

  if (state.loading)
    return;

  state.loading = true;

  if (reset) {
    state.cursors.recommended =
      null;

    state.hasMore.recommended =
      true;

    container.innerHTML =
      loadingSkeleton(4);
  }

  try {
    /*
     * Recommendation strategy:
     *
     * 1. Groups matching categories the user belongs to.
     * 2. Active groups.
     * 3. Groups with more members.
     * 4. Groups the user hasn't joined.
     */

    const categories =
      getPreferredCategories();

    let groups = [];

    if (categories.length) {
      for (
        const category of categories
      ) {
        try {
          const snapshot =
            await getDocs(
              query(
                collection(
                  db,
                  "groups"
                ),
                where(
                  "privacy",
                  "==",
                  "public"
                ),
                where(
                  "category",
                  "==",
                  category
                ),
                orderBy(
                  "activityScore",
                  "desc"
                ),
                limit(8)
              )
            );

          snapshot.docs.forEach(
            groupDoc => {
              const group =
                normalizeGroup(
                  groupDoc.id,
                  groupDoc.data()
                );

              if (
                !state.membershipMap.has(
                  group.id
                )
              ) {
                if (
                  !groups.some(
                    x =>
                      x.id ===
                      group.id
                  )
                ) {
                  groups.push(
                    group
                  );
                }
              }
            }
          );
        } catch {
          // Ignore category query failures.
        }
      }
    }

    /*
     * General fallback recommendations.
     */
    if (
      groups.length <
      RECOMMENDED_LIMIT
    ) {
      try {
        const snapshot =
          await getDocs(
            query(
              collection(
                db,
                "groups"
              ),
              where(
                "privacy",
                "==",
                "public"
              ),
              orderBy(
                "memberCount",
                "desc"
              ),
              limit(30)
            )
          );

        snapshot.docs.forEach(
          groupDoc => {
            const group =
              normalizeGroup(
                groupDoc.id,
                groupDoc.data()
              );

            if (
              state.membershipMap.has(
                group.id
              )
            ) {
              return;
            }

            if (
              groups.some(
                x =>
                  x.id ===
                  group.id
              )
            ) {
              return;
            }

            groups.push(group);
          }
        );
      } catch (error) {
        console.warn(
          "Fallback recommendation query failed:",
          error
        );
      }
    }

    /*
     * Rank recommendations.
     */
    groups.sort(
      (a, b) =>
        recommendationScore(b) -
        recommendationScore(a)
    );

    const finalGroups =
      groups.slice(
        0,
        RECOMMENDED_LIMIT
      );

    state.recommendedGroups =
      finalGroups;

    if (reset)
      container.innerHTML = "";

    finalGroups.forEach(
      group => {
        if (
          !container.querySelector(
            `[data-group-id="${group.id}"]`
          )
        ) {
          container.appendChild(
            createGroupCard(
              group,
              {
                recommended: true
              }
            )
          );
        }
      }
    );

    if (!finalGroups.length) {
      container.innerHTML =
        emptyState(
          "fa-wand-magic-sparkles",
          "No recommendations yet."
        );
    }

    /*
     * Recommendations are generated from a bounded
     * candidate set rather than loading the entire
     * groups collection.
     */
    state.hasMore.recommended =
      false;

    updateLoadMoreButton(
      "#loadMoreRecommended",
      false
    );

  } catch (error) {
    console.error(
      "Could not load recommended groups:",
      error
    );

    if (reset) {
      container.innerHTML =
        emptyState(
          "fa-wand-magic-sparkles",
          "Could not load recommendations."
        );
    }

  } finally {
    state.loading = false;
  }
}

// ============================================================
// DISCOVER
// ============================================================

async function loadDiscoverGroups(
  reset = false
) {
  const container =
    document.querySelector(
      "#discoverGroups"
    );

  if (!container)
    return;

  if (state.loading)
    return;

  state.loading = true;

  if (reset) {
    state.cursors.discover =
      null;

    state.hasMore.discover =
      true;

    container.innerHTML =
      loadingSkeleton(8);
  }

  try {
    const constraints = [];

    constraints.push(
      where(
        "privacy",
        "==",
        "public"
      )
    );

    if (
      state.category &&
      state.category !== "all"
    ) {
      constraints.push(
        where(
          "category",
          "==",
          state.category
        )
      );
    }

    constraints.push(
      orderBy(
        "memberCount",
        "desc"
      )
    );

    constraints.push(
      limit(
        GROUPS_PAGE_SIZE
      )
    );

    if (
      !reset &&
      state.cursors.discover
    ) {
      constraints.push(
        startAfter(
          state.cursors.discover
        )
      );
    }

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "groups"
          ),
          ...constraints
        )
      );

    if (reset)
      container.innerHTML = "";

    if (
      snapshot.docs.length
    ) {
      state.cursors.discover =
        snapshot.docs[
          snapshot.docs.length - 1
        ];
    }

    state.hasMore.discover =
      snapshot.docs.length ===
      GROUPS_PAGE_SIZE;

    snapshot.docs.forEach(
      groupDoc => {
        const group =
          normalizeGroup(
            groupDoc.id,
            groupDoc.data()
          );

        container.appendChild(
          createGroupCard(
            group
          )
        );
      }
    );

    if (
      reset &&
      snapshot.empty
    ) {
      container.innerHTML =
        emptyState(
          "fa-users",
          "No public groups found."
        );
    }

    updateLoadMoreButton(
      "#loadMoreDiscover",
      state.hasMore.discover
    );

  } catch (error) {
    console.error(
      "Could not load discover groups:",
      error
    );

    if (reset) {
      container.innerHTML =
        emptyState(
          "fa-users",
          "Could not load groups."
        );
    }

  } finally {
    state.loading = false;
  }
}

// ============================================================
// SEARCH
// ============================================================

async function runSearch() {
  const term =
    state.searchTerm
      .toLowerCase()
      .trim();

  if (!term) {
    hideSearchResults();
    return;
  }

  const section =
    document.querySelector(
      "#groupSearchResultsSection"
    );

  const container =
    document.querySelector(
      "#groupSearchResults"
    );

  const label =
    document.querySelector(
      "#searchResultLabel"
    );

  if (!section || !container)
    return;

  section.style.display =
    "block";

  label.textContent =
    `Results for "${state.searchTerm}"`;

  container.innerHTML =
    loadingSkeleton(6);

  try {
    /*
     * Firestore prefix search using searchTokens.
     *
     * Your group documents should contain:
     *
     * searchTokens: [
     *   "gaming",
     *   "gaming group",
     *   "football"
     * ]
     */

    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "groups"
          ),
          where(
            "privacy",
            "==",
            "public"
          ),
          where(
            "searchTokens",
            "array-contains",
            term
          ),
          limit(30)
        )
      );

    let groups =
      snapshot.docs.map(
        d =>
          normalizeGroup(
            d.id,
            d.data()
          )
      );

    /*
     * If exact searchTokens didn't find anything,
     * load a bounded list and perform client filtering.
     */
    if (!groups.length) {
      const fallback =
        await getDocs(
          query(
            collection(
              db,
              "groups"
            ),
            where(
              "privacy",
              "==",
              "public"
            ),
            orderBy(
              "memberCount",
              "desc"
            ),
            limit(50)
          )
        );

      groups =
        fallback.docs
          .map(
            d =>
              normalizeGroup(
                d.id,
                d.data()
              )
          )
          .filter(
            group =>
              searchableGroupText(
                group
              ).includes(term)
          );
    }

    if (
      state.category !==
      "all"
    ) {
      groups =
        groups.filter(
          group =>
            String(
              group.category ||
                ""
            ).toLowerCase() ===
            state.category
        );
    }

    container.innerHTML = "";

    if (!groups.length) {
      container.innerHTML =
        emptyState(
          "fa-magnifying-glass",
          "No groups found.",
          "Try another search term."
        );

      return;
    }

    groups.forEach(
      group =>
        container.appendChild(
          createGroupCard(
            group
          )
        )
    );

  } catch (error) {
    console.error(
      "Group search failed:",
      error
    );

    container.innerHTML =
      emptyState(
        "fa-triangle-exclamation",
        "Search failed."
      );
  }
}

function hideSearchResults() {
  const section =
    document.querySelector(
      "#groupSearchResultsSection"
    );

  if (section)
    section.style.display =
      "none";
}

// ============================================================
// NORMALIZE GROUP
// ============================================================

function normalizeGroup(
  id,
  data
) {
  return {
    id,

    name:
      data.name ||
      data.groupName ||
      "Unnamed Group",

    slug:
      data.slug ||
      id,

    description:
      data.description ||
      "A VitalStar community.",

    category:
      String(
        data.category ||
          "other"
      ).toLowerCase(),

    coverURL:
      data.coverURL ||
      data.coverUrl ||
      data.coverImage ||
      "",

    avatarURL:
      data.avatarURL ||
      data.avatarUrl ||
      data.groupImage ||
      data.image ||
      data.photoURL ||
      "",

    privacy:
      data.privacy ||
      data.type ||
      "public",

    type:
      data.type ||
      data.privacy ||
      "public",

    premium:
      Boolean(
        data.premium ||
        data.isPremium ||
        data.subscription
      ),

    verified:
      Boolean(
        data.verified
      ),

    ownerId:
      data.ownerId ||
      "",

    ownerName:
      data.ownerName ||
      "Group Owner",

    memberCount:
      Number(
        data.memberCount ||
          0
      ),

    postCount:
      Number(
        data.postCount ||
          0
      ),

    onlineCount:
      Number(
        data.onlineCount ||
          0
      ),

    activityScore:
      Number(
        data.activityScore ||
          0
      ),

    weeklyActivity:
      Number(
        data.weeklyActivity ||
          0
      ),

    monthlyActivity:
      Number(
        data.monthlyActivity ||
          0
      ),

    lastActivityAt:
      data.lastActivityAt ||
      data.updatedAt ||
      data.createdAt ||
      null,

    createdAt:
      data.createdAt ||
      null,

    updatedAt:
      data.updatedAt ||
      null,

    rules:
      data.rules ||
      "",

    subscription:
      data.subscription ||
      null
  };
}

// ============================================================
// GROUP CARD
// ============================================================

function createGroupCard(
  group,
  options = {}
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "vs-group-card";

  card.dataset.groupId =
    group.id;

  const membership =
    state.membershipMap.get(
      group.id
    );

  const isMember =
    membership?.status ===
    "active";

  const isPending =
    membership?.status ===
    "pending";

  const category =
    capitalize(
      group.category
    );

  const privacyLabel =
    group.privacy ===
    "private"
      ? "Private"
      : "Public";

  const activity =
    getActivityLabel(
      group
    );

  const avatar =
    group.avatarURL ||
    group.coverURL;

  let actionHTML = "";

  if (isMember) {
    actionHTML = `
      <a
        href="group.html?id=${encodeURIComponent(group.id)}"
        class="vs-group-action joined"
      >
        <i class="fa-solid fa-arrow-right"></i>
        Open
      </a>
    `;
  } else if (isPending) {
    actionHTML = `
      <button
        class="vs-group-action pending"
        disabled
      >
        <i class="fa-solid fa-clock"></i>
        Pending
      </button>
    `;
  } else {
    actionHTML = `
      <button
        class="vs-group-action join"
        data-action="join"
      >
        <i class="fa-solid fa-user-plus"></i>
        Join
      </button>
    `;
  }

  const badges = [];

  if (options.rank) {
    badges.push(`
      <span class="vs-rank-badge">
        #${options.rank}
      </span>
    `);
  }

  if (options.trending) {
    badges.push(`
      <span class="vs-trending-badge">
        <i class="fa-solid fa-fire"></i>
        Trending
      </span>
    `);
  }

  if (group.verified) {
    badges.push(`
      <span class="vs-verified-badge">
        <i class="fa-solid fa-check"></i>
      </span>
    `);
  }

  if (group.premium) {
    badges.push(`
      <span class="vs-premium-badge">
        <i class="fa-solid fa-crown"></i>
        Premium
      </span>
    `);
  }

  card.innerHTML = `
    <div
      class="vs-group-cover"
      style="${
        group.coverURL
          ? `background-image:url("${escapeAttribute(
              group.coverURL
            )}")`
          : ""
      }"
    >
      <div class="vs-group-overlay"></div>

      <div class="vs-card-badges">
        ${badges.join("")}
      </div>

      <div
        class="vs-group-avatar"
        ${
          avatar
            ? `style="background-image:url('${escapeAttribute(
                avatar
              )}')"`
            : ""
        }
      >
        ${
          !avatar
            ? escapeHtml(
                getInitials(
                  group.name
                )
              )
            : ""
        }
      </div>
    </div>

    <div class="vs-group-card-body">

      <div class="vs-group-title-row">

        <a
          href="group.html?id=${encodeURIComponent(group.id)}"
          class="vs-group-name"
        >
          ${escapeHtml(
            group.name
          )}
        </a>

        ${
          group.verified
            ? `
              <i
                class="fa-solid fa-circle-check vs-title-verified"
                title="Verified group"
              ></i>
            `
            : ""
        }

      </div>

      <p class="vs-group-description">
        ${escapeHtml(
          truncate(
            group.description,
            100
          )
        )}
      </p>

      <div class="vs-group-meta">

        <span>
          <i class="fa-solid fa-users"></i>
          ${formatNumber(
            group.memberCount
          )}
        </span>

        <span>
          <i class="fa-solid fa-note-sticky"></i>
          ${formatNumber(
            group.postCount
          )}
        </span>

        <span>
          <i class="fa-solid fa-bolt"></i>
          ${escapeHtml(
            activity
          )}
        </span>

      </div>

      <div class="vs-group-tags">

        <span class="vs-group-tag">
          ${escapeHtml(
            category
          )}
        </span>

        <span class="vs-group-tag">
          <i class="fa-solid ${
            group.privacy ===
            "private"
              ? "fa-lock"
              : "fa-globe"
          }"></i>
          ${privacyLabel}
        </span>

      </div>

      <div class="vs-group-card-footer">
        ${actionHTML}
      </div>

    </div>
  `;

  card
    .querySelector(
      '[data-action="join"]'
    )
    ?.addEventListener(
      "click",
      () =>
        joinGroup(
          group,
          card
        )
    );

  return card;
}

// ============================================================
// JOIN GROUP
// ============================================================

async function joinGroup(
  group,
  card
) {
  if (!currentUser) {
    window.location.href =
      "login.html";

    return;
  }

  const button =
    card.querySelector(
      ".vs-group-action"
    );

  if (button) {
    button.disabled =
      true;

    button.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Joining...
    `;
  }

  try {
    const memberRef =
      doc(
        db,
        "groups",
        group.id,
        "members",
        currentUser.uid
      );

    const existing =
      await getDoc(
        memberRef
      );

    /*
     * Private groups use pending membership.
     * Public groups become active immediately.
     */
    const status =
      group.privacy ===
      "private"
        ? "pending"
        : "active";

    const profile =
      state.userProfile ||
      {};

    await setDoc(
      memberRef,
      {
        uid:
          currentUser.uid,

        displayName:
          profile.fullName ||
          currentUser.displayName ||
          "VitalStar User",

        photoURL:
          profile.photoURL ||
          "",

        role:
          existing.exists()
            ? existing.data()
                .role ||
              "member"
            : "member",

        status,

        category:
          group.category,

        joinedAt:
          existing.exists()
            ? existing.data()
                .joinedAt ||
              serverTimestamp()
            : serverTimestamp(),

        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    );

    if (
      status ===
      "active" &&
      !existing.exists()
    ) {
      await updateDoc(
        doc(
          db,
          "groups",
          group.id
        ),
        {
          memberCount:
            increment(1),

          activityScore:
            increment(1),

          lastActivityAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );
    }

    state.membershipMap.set(
      group.id,
      {
        status,
        role: "member"
      }
    );

    await loadMyGroups();

    /*
     * Refresh cards so the Join button
     * immediately becomes Open/Pending.
     */
    refreshGroupCard(
      group.id
    );

    if (
      typeof window.showToast ===
      "function"
    ) {
      window.showToast(
        status === "active"
          ? `Joined ${group.name}!`
          : `Request sent to ${group.name}.`,
        "success"
      );
    }

  } catch (error) {
    console.error(
      "Could not join group:",
      error
    );

    if (button) {
      button.disabled =
        false;

      button.innerHTML = `
        <i class="fa-solid fa-user-plus"></i>
        Join
      `;
    }

    alert(
      error.message ||
      "Could not join this group."
    );
  }
}

// ============================================================
// REFRESH GROUP CARD
// ============================================================

function refreshGroupCard(
  groupId
) {
  document
    .querySelectorAll(
      `[data-group-id="${groupId}"]`
    )
    .forEach(card => {
      /*
       * Re-rendering the exact card requires the original
       * group object. Reloading the section is safer.
       */
      card.remove();
    });
}

// ============================================================
// RECOMMENDATION SCORING
// ============================================================

function getPreferredCategories() {
  const counts =
    new Map();

  state.myGroups.forEach(
    group => {
      if (!group.category)
        return;

      counts.set(
        group.category,
        (counts.get(
          group.category
        ) || 0) + 1
      );
    }
  );

  return Array.from(
    counts.entries()
  )
    .sort(
      (a, b) =>
        b[1] - a[1]
    )
    .map(
      x => x[0]
    )
    .slice(0, 5);
}

function recommendationScore(
  group
) {
  const categories =
    getPreferredCategories();

  let score = 0;

  if (
    categories.includes(
      group.category
    )
  ) {
    score += 100;
  }

  score += Math.min(
    group.activityScore / 2,
    50
  );

  score += Math.min(
    group.memberCount / 10,
    30
  );

  score += Math.min(
    group.postCount / 5,
    20
  );

  if (group.verified)
    score += 10;

  return score;
}

// ============================================================
// ACTIVITY LABEL
// ============================================================

function getActivityLabel(
  group
) {
  const score =
    Number(
      group.activityScore ||
        0
    );

  if (score >= 500)
    return "Very active";

  if (score >= 200)
    return "Highly active";

  if (score >= 50)
    return "Active";

  if (
    group.postCount > 0
  )
    return "Growing";

  return "New";
}

// ============================================================
// SEARCH TEXT
// ============================================================

function searchableGroupText(
  group
) {
  return `
    ${group.name}
    ${group.description}
    ${group.category}
    ${group.ownerName}
    ${group.slug}
  `
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

// ============================================================
// LOAD MORE
// ============================================================

function updateLoadMoreButton(
  selector,
  show
) {
  const button =
    document.querySelector(
      selector
    );

  if (!button)
    return;

  button.style.display =
    show
      ? "block"
      : "none";
}

// ============================================================
// LOADING SKELETON
// ============================================================

function loadingSkeleton(
  count
) {
  return Array.from(
    {
      length: count
    }
  )
    .map(
      () => `
        <div class="vs-group-skeleton">

          <div class="vs-skeleton-cover"></div>

          <div class="vs-skeleton-body">

            <div class="vs-skeleton-line title"></div>

            <div class="vs-skeleton-line"></div>

            <div class="vs-skeleton-line short"></div>

          </div>

        </div>
      `
    )
    .join("");
}

// ============================================================
// EMPTY STATE
// ============================================================

function emptyState(
  icon,
  title,
  description = ""
) {
  return `
    <div class="vs-empty-state">

      <i class="fa-solid ${icon}"></i>

      <strong>
        ${escapeHtml(title)}
      </strong>

      ${
        description
          ? `
            <p>
              ${escapeHtml(
                description
              )}
            </p>
          `
          : ""
      }

    </div>
  `;
}

// ============================================================
// HELPERS
// ============================================================

function formatNumber(
  number
) {
  const value =
    Number(number || 0);

  if (value >= 1000000)
    return (
      (value / 1000000)
        .toFixed(
          value % 1000000
            ? 1
            : 0
        ) +
      "M"
    );

  if (value >= 1000)
    return (
      (value / 1000)
        .toFixed(
          value % 1000
            ? 1
            : 0
        ) +
      "K"
    );

  return String(value);
}

function capitalize(
  value
) {
  if (!value)
    return "Other";

  return String(value)
    .charAt(0)
    .toUpperCase() +
    String(value)
      .slice(1);
}

function truncate(
  value,
  max
) {
  const text =
    String(value || "");

  if (
    text.length <= max
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      max - 3
    ) + "..."
  );
}

function getInitials(
  name
) {
  return String(
    name || "Group"
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      word =>
        word
          .charAt(0)
          .toUpperCase()
    )
    .join("") || "G";
}

function getTimestampMillis(
  timestamp
) {
  if (!timestamp)
    return 0;

  if (
    typeof timestamp.toMillis ===
    "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    timestamp instanceof Date
  ) {
    return timestamp.getTime();
  }

  return 0;
}

function escapeHtml(
  value
) {
  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    String(
      value ?? ""
    );

  return div.innerHTML;
}

function escapeAttribute(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    );
}

// ============================================================
// STYLES
// ============================================================

function injectStyles() {
  if (
    document.getElementById(
      GROUPS_STYLE_ID
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    GROUPS_STYLE_ID;

  style.textContent = `

    .vs-groups-page {
      width:100%;
      max-width:1200px;
      margin:0 auto;
      padding:20px;
      box-sizing:border-box;
    }

    .vs-groups-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:20px;
      margin-bottom:22px;
    }

    .vs-eyebrow {
      color:#315fff;
      font-size:12px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.7px;
      margin-bottom:5px;
    }

    .vs-groups-header h1 {
      margin:0;
      font-size:30px;
      color:#151822;
    }

    .vs-groups-header p {
      margin:6px 0 0;
      color:#7d8494;
      font-size:14px;
    }

    .vs-create-group-btn,
    .vs-primary-btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      text-decoration:none;
      background:linear-gradient(
        135deg,
        #315fff,
        #7c4dff
      );
      color:white;
      border:0;
      border-radius:999px;
      padding:11px 18px;
      font-weight:700;
      cursor:pointer;
    }

    .vs-groups-search {
      background:#fff;
      border:1px solid rgba(0,0,0,.08);
      border-radius:20px;
      padding:14px;
      margin-bottom:30px;
    }

    .vs-search-box {
      height:46px;
      display:flex;
      align-items:center;
      gap:10px;
      background:#f5f6f8;
      border-radius:13px;
      padding:0 14px;
    }

    .vs-search-box i {
      color:#8a90a0;
    }

    .vs-search-box input {
      flex:1;
      border:0;
      outline:0;
      background:transparent;
      color:#1a1d29;
      font-size:14px;
    }

    .vs-search-box button {
      border:0;
      background:none;
      color:#8a90a0;
      cursor:pointer;
      width:30px;
      height:30px;
      align-items:center;
      justify-content:center;
    }

    .vs-category-scroll {
      display:flex;
      gap:8px;
      overflow-x:auto;
      padding-top:12px;
      scrollbar-width:none;
    }

    .vs-category-scroll::-webkit-scrollbar {
      display:none;
    }

    .vs-category-btn {
      white-space:nowrap;
      border:1px solid rgba(0,0,0,.08);
      background:#fff;
      color:#6b7280;
      padding:8px 13px;
      border-radius:999px;
      font-size:12px;
      font-weight:600;
      cursor:pointer;
    }

    .vs-category-btn.active {
      background:#315fff;
      color:#fff;
      border-color:#315fff;
    }

    .vs-group-section {
      margin-bottom:38px;
    }

    .vs-section-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:15px;
      margin-bottom:14px;
    }

    .vs-section-header h2 {
      margin:0;
      color:#191c26;
      font-size:19px;
    }

    .vs-section-header h2 i {
      color:#315fff;
      margin-right:5px;
    }

    .vs-section-header p {
      margin:4px 0 0;
      color:#8a90a0;
      font-size:12px;
    }

    .vs-section-link {
      border:0;
      background:none;
      color:#315fff;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    }

    .vs-groups-grid {
      display:grid;
      grid-template-columns:
        repeat(
          4,
          minmax(0,1fr)
        );
      gap:15px;
    }

    .vs-top-active-grid {
      grid-template-columns:
        repeat(
          5,
          minmax(0,1fr)
        );
    }

    .vs-group-card {
      min-width:0;
      background:#fff;
      border:1px solid rgba(0,0,0,.08);
      border-radius:19px;
      overflow:hidden;
      transition:
        transform .18s ease,
        box-shadow .18s ease;
    }

    .vs-group-card:hover {
      transform:translateY(-2px);
      box-shadow:
        0 10px 28px
        rgba(0,0,0,.08);
    }

    .vs-group-cover {
      height:120px;
      background:
        linear-gradient(
          135deg,
          #315fff,
          #7c4dff
        );
      background-size:cover;
      background-position:center;
      position:relative;
    }

    .vs-group-overlay {
      position:absolute;
      inset:0;
      background:
        linear-gradient(
          to bottom,
          rgba(0,0,0,.04),
          rgba(0,0,0,.25)
        );
    }

    .vs-card-badges {
      position:absolute;
      top:10px;
      left:10px;
      right:10px;
      display:flex;
      gap:5px;
      flex-wrap:wrap;
      z-index:2;
    }

    .vs-rank-badge,
    .vs-trending-badge,
    .vs-premium-badge {
      display:inline-flex;
      align-items:center;
      gap:4px;
      border-radius:999px;
      padding:4px 7px;
      font-size:9px;
      font-weight:800;
      color:#fff;
      background:rgba(0,0,0,.55);
      backdrop-filter:blur(5px);
    }

    .vs-trending-badge {
      background:rgba(220,40,70,.85);
    }

    .vs-premium-badge {
      background:rgba(212,160,0,.9);
    }

    .vs-verified-badge {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:22px;
      height:22px;
      border-radius:50%;
      background:#315fff;
      color:#fff;
      font-size:10px;
    }

    .vs-group-avatar {
      position:absolute;
      bottom:-24px;
      left:15px;
      width:55px;
      height:55px;
      border-radius:16px;
      border:4px solid #fff;
      background:
        linear-gradient(
          135deg,
          #315fff,
          #7c4dff
        );
      background-size:cover;
      background-position:center;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-size:18px;
      font-weight:800;
      z-index:3;
    }

    .vs-group-card-body {
      padding:34px 14px 14px;
    }

    .vs-group-title-row {
      display:flex;
      align-items:center;
      gap:5px;
    }

    .vs-group-name {
      color:#191c26;
      text-decoration:none;
      font-weight:800;
      font-size:14px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .vs-title-verified {
      color:#315fff;
      font-size:12px;
    }

    .vs-group-description {
      margin:7px 0 10px;
      min-height:34px;
      color:#7d8494;
      font-size:11.5px;
      line-height:1.5;
    }

    .vs-group-meta {
      display:flex;
      flex-wrap:wrap;
      gap:9px;
      color:#8a90a0;
      font-size:10.5px;
    }

    .vs-group-meta span {
      display:flex;
      align-items:center;
      gap:4px;
    }

    .vs-group-meta i {
      color:#315fff;
    }

    .vs-group-tags {
      display:flex;
      gap:5px;
      flex-wrap:wrap;
      margin-top:10px;
    }

    .vs-group-tag {
      display:inline-flex;
      align-items:center;
      gap:4px;
      padding:4px 7px;
      background:#f5f6f8;
      border-radius:999px;
      color:#777f8f;
      font-size:9.5px;
      font-weight:600;
    }

    .vs-group-card-footer {
      margin-top:12px;
    }

    .vs-group-action {
      width:100%;
      min-height:36px;
      border-radius:10px;
      border:0;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      font-size:11px;
      font-weight:700;
      cursor:pointer;
      text-decoration:none;
      box-sizing:border-box;
    }

    .vs-group-action.join {
      background:#315fff;
      color:#fff;
    }

    .vs-group-action.joined {
      background:#f0f3ff;
      color:#315fff;
    }

    .vs-group-action.pending {
      background:#f5f6f8;
      color:#8a90a0;
      cursor:default;
    }

    .vs-load-more {
      width:100%;
      margin-top:14px;
      padding:11px;
      border-radius:11px;
      border:1px solid rgba(0,0,0,.08);
      background:#f5f6f8;
      color:#315fff;
      font-weight:700;
      font-size:12px;
      cursor:pointer;
    }

    .vs-empty-state {
      grid-column:1/-1;
      text-align:center;
      padding:35px 20px;
      color:#8a90a0;
    }

    .vs-empty-state i {
      display:block;
      font-size:30px;
      color:#315fff;
      opacity:.65;
      margin-bottom:10px;
    }

    .vs-empty-state strong {
      display:block;
      color:#5e6575;
      font-size:13px;
    }

    .vs-empty-state p {
      margin:6px 0 0;
      font-size:11px;
    }

    .vs-group-skeleton {
      border-radius:19px;
      overflow:hidden;
      background:#fff;
      border:1px solid rgba(0,0,0,.07);
    }

    .vs-skeleton-cover {
      height:120px;
      background:#eef0f4;
      animation:
        vsSkeleton 1.2s
        infinite alternate;
    }

    .vs-skeleton-body {
      padding:30px 14px 15px;
    }

    .vs-skeleton-line {
      height:10px;
      width:90%;
      border-radius:5px;
      background:#eef0f4;
      margin-bottom:9px;
      animation:
        vsSkeleton 1.2s
        infinite alternate;
    }

    .vs-skeleton-line.title {
      width:60%;
      height:13px;
    }

    .vs-skeleton-line.short {
      width:40%;
    }

    @keyframes vsSkeleton {
      from {
        opacity:.5;
      }

      to {
        opacity:1;
      }
    }

    .vs-groups-login-required {
      max-width:500px;
      margin:70px auto;
      text-align:center;
      padding:30px;
    }

    .vs-groups-login-icon {
      width:70px;
      height:70px;
      margin:0 auto 15px;
      border-radius:22px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#eef2ff;
      color:#315fff;
      font-size:28px;
    }

    .vs-groups-login-required h2 {
      margin:0;
    }

    .vs-groups-login-required p {
      color:#7d8494;
      font-size:14px;
      line-height:1.6;
      margin:8px 0 20px;
    }

    @media(max-width:1000px) {

      .vs-groups-grid,
      .vs-top-active-grid {
        grid-template-columns:
          repeat(
            3,
            minmax(0,1fr)
          );
      }

    }

    @media(max-width:700px) {

      .vs-groups-page {
        padding:12px;
      }

      .vs-groups-header {
        align-items:flex-start;
        flex-direction:column;
      }

      .vs-groups-header h1 {
        font-size:25px;
      }

      .vs-create-group-btn {
        width:100%;
      }

      .vs-groups-grid,
      .vs-top-active-grid {
        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );
        gap:10px;
      }

      .vs-group-cover {
        height:105px;
      }

      .vs-group-card-body {
        padding-left:11px;
        padding-right:11px;
      }

    }

    @media(max-width:430px) {

      .vs-groups-grid,
      .vs-top-active-grid {
        grid-template-columns:
          1fr 1fr;
      }

      .vs-group-description {
        font-size:10.5px;
      }

      .vs-group-meta {
        gap:5px;
      }

      .vs-group-meta span {
        font-size:9.5px;
      }

    }

  `;

  document.head.appendChild(
    style
  );
}

// ============================================================
// START
// ============================================================

init();