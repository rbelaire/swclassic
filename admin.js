/*************************
 * ADMIN CONSOLE
 * The Classic
 * Tabs: Draft | Matchups | Score Entry
 *************************/

const ADMIN_PASSWORD_HASH = "5a40d95d61e29d6665ff382de6e0b0cc6a3bbb546aeececa59911e08d597587b";
const VALID_USERS = ["admin", "foursome1", "foursome2", "foursome3"];
// Scan-to-score tokens now live in data.json (meta.foursomeTokens) so they can
// be rotated each season from the admin console without a code change.
let hasUnsavedChanges = false;
const TEAM_PICK_LIMIT = 5;

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

let expandedMatches = new Set();
let grossMatches = new Set(); // matches showing optional gross-score inputs
let loadedLastUpdated = null;
let activeTab = "draft";
let adminUser = "";
let userRole = "admin"; // "admin" or "foursome"
let userFoursome = null; // 0, 1, 2 (index)

// Login handling
async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value;
  const errorEl = document.getElementById("login-error");

  const userLower = user.toLowerCase();
  if (!VALID_USERS.includes(userLower)) {
    errorEl.textContent = "Invalid username";
    document.getElementById("login-pass").value = "";
    document.getElementById("login-pass").focus();
    return;
  }

  const passHash = await hashPassword(pass);
  if (passHash !== ADMIN_PASSWORD_HASH) {
    errorEl.textContent = "Invalid password";
    document.getElementById("login-pass").value = "";
    document.getElementById("login-pass").focus();
    return;
  }

  adminUser = userLower;
  localStorage.setItem("adminAuth", "true");
  localStorage.setItem("adminUser", userLower);
  localStorage.setItem("adminLoginTime", Date.now().toString());
  // Keep the plaintext on this device to authenticate saves server-side.
  try { localStorage.setItem("adminPass", pass); } catch (e) {}
  applyRole();
  showAdmin();
}

function applyRole() {
  const match = adminUser.match(/^foursome(\d)$/);
  if (match) {
    userRole = "foursome";
    userFoursome = parseInt(match[1]) - 1; // 0-indexed
  } else {
    userRole = "admin";
    userFoursome = null;
  }
}

function isFoursomeUser() {
  return userRole === "foursome";
}

// iOS Safari anchors position:fixed to the layout viewport, so the sticky save
// bar jumps when the browser's toolbar animates in/out on scroll. Pin the bar
// to the *visual* viewport's bottom so it tracks the toolbar smoothly.
let barPinInit = false;
function pinFoursomeBar() {
  const bar = document.getElementById("foursome-save-bar");
  if (!bar || bar.style.display === "none") return;
  const vv = window.visualViewport;
  if (!vv) { bar.style.bottom = "0px"; return; }
  const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  bar.style.bottom = offset + "px";
}
function initBarPinning() {
  pinFoursomeBar();
  if (barPinInit) return;
  barPinInit = true;
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", pinFoursomeBar);
    window.visualViewport.addEventListener("scroll", pinFoursomeBar);
  }
  window.addEventListener("scroll", pinFoursomeBar, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(pinFoursomeBar, 250));
}

function showAdmin() {
  document.getElementById("login-overlay").classList.add("hidden");
  document.getElementById("admin-app").style.display = "";

  // Hide tabs + admin-only buttons for foursome users
  const tabBar = document.querySelector(".admin-tabs");
  const clearBtn = document.querySelector(".btn-danger");
  const archiveBtn = document.getElementById("archive-btn");
  const eyebrow = document.getElementById("admin-eyebrow");
  const title = document.getElementById("admin-title");
  const subtitle = document.getElementById("admin-subtitle");

  if (isFoursomeUser()) {
    if (tabBar) tabBar.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
    if (archiveBtn) archiveBtn.style.display = "none";
    if (eyebrow) eyebrow.textContent = `Foursome ${userFoursome + 1} Scorer`;
    if (title) title.textContent = `Foursome ${userFoursome + 1}`;
    if (subtitle) subtitle.textContent = "Enter hole-by-hole scores for your matches.";
    const saveBar = document.getElementById("foursome-save-bar");
    if (saveBar) { saveBar.style.display = "flex"; initBarPinning(); }
    // Hide the header save button — the sticky bar handles it
    const saveBtn = document.getElementById("save-btn");
    if (saveBtn) saveBtn.style.display = "none";
  } else {
    if (tabBar) tabBar.style.display = "";
    if (clearBtn) clearBtn.style.display = "";
    if (archiveBtn) archiveBtn.style.display = "";
    if (eyebrow) eyebrow.textContent = "Admin Console";
    if (title) title.textContent = "Admin Console";
    if (subtitle) subtitle.textContent = "Draft players, build matchups, and enter scores.";
  }

  loadData();
}

function logout() {
  if (hasUnsavedChanges && !confirm("You have unsaved changes. Log out anyway?")) return;
  localStorage.removeItem("adminAuth");
  localStorage.removeItem("adminUser");
  localStorage.removeItem("adminLoginTime");
  adminUser = "";
  hasUnsavedChanges = false;
  document.getElementById("admin-app").style.display = "none";
  document.getElementById("login-overlay").classList.remove("hidden");
  document.getElementById("login-form").reset();
  document.getElementById("login-error").textContent = "";
}

function isSessionExpired() {
  const loginTime = localStorage.getItem("adminLoginTime");
  if (!loginTime) return true;
  const elapsed = Date.now() - parseInt(loginTime, 10);
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;
  return elapsed > EIGHT_HOURS;
}

// Scan-to-score: log a foursome in directly from its QR token (no password).
// Tokens are read from the live data (meta.foursomeTokens) so they rotate each
// season. Async because it needs the current data to validate the token.
async function tryTokenLogin() {
  const token = new URLSearchParams(window.location.search).get("s");
  if (!token) return false;
  let json;
  try { json = await fetchLiveData(); } catch (e) { return false; }
  const num = json && json.meta && json.meta.foursomeTokens
    ? json.meta.foursomeTokens[token] : null;
  if (!num) return false;
  adminUser = "foursome" + num;
  localStorage.setItem("adminAuth", "true");
  localStorage.setItem("adminUser", adminUser);
  localStorage.setItem("adminLoginTime", Date.now().toString());
  try { localStorage.setItem("foursomeToken", token); } catch (e) {}
  applyRole();
  data = json;
  loadedLastUpdated = json.meta && json.meta.lastUpdated ? json.meta.lastUpdated : null;
  showAdmin();
  // Strip the token from the URL so it isn't bookmarked or shared onward
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (e) {}
  return true;
}

// On load: QR token first, otherwise restore an existing session
(async () => {
  if (await tryTokenLogin()) return;
  if (localStorage.getItem("adminAuth") === "true") {
    if (isSessionExpired()) {
      localStorage.removeItem("adminAuth");
      localStorage.removeItem("adminUser");
      localStorage.removeItem("adminLoginTime");
    } else {
      adminUser = localStorage.getItem("adminUser") || "";
      applyRole();
      showAdmin();
    }
  }
})();

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicAdminData_v3";
const LEADERBOARD_CACHE_KEY = "classicLeaderboardData_v3";

function getCachedData() {
  try {
    const cached = localStorage.getItem(DATA_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("Unable to read cached data.", error);
    return null;
  }
}

function saveCachedData(updatedData) {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.warn("Unable to cache data.", error);
  }
}

function saveLeaderboardCache(updatedData) {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.warn("Unable to cache leaderboard data.", error);
  }
}

function isNewerData(nextData, currentData) {
  if (!currentData?.meta?.lastUpdated) return true;
  if (!nextData?.meta?.lastUpdated) return false;
  return Date.parse(nextData.meta.lastUpdated) >= Date.parse(currentData.meta.lastUpdated);
}

function validateData(d) {
  const errors = [];
  if (!d || typeof d !== "object") {
    errors.push("Data is missing or not an object.");
    return errors;
  }
  if (!d.players || typeof d.players !== "object" || Object.keys(d.players).length === 0) {
    errors.push("Players object is missing or empty.");
  }
  if (!Array.isArray(d.matches)) {
    errors.push("Matches array is missing.");
  } else {
    if (d.matches.length !== 6) {
      errors.push(`Expected 6 matches, found ${d.matches.length}.`);
    }
    d.matches.forEach((m, i) => {
      if (!Array.isArray(m.playerIds)) {
        errors.push(`Match ${i + 1} is missing playerIds array.`);
      }
      if (!m.points || typeof m.points !== "object") {
        errors.push(`Match ${i + 1} is missing points object.`);
      }
    });
  }
  return errors;
}

// Read current scores from /api/data (straight from GitHub, updated within
// seconds of any save) so a phone taking over scoring loads the latest holes
// immediately; fall back to the statically served ./data.json.
function fetchLiveData() {
  return fetch(`/api/data?t=${Date.now()}`, { cache: "no-store" })
    .then(res => {
      if (!res.ok) return Promise.reject(new Error("api/data " + res.status));
      return res.json();
    })
    .catch(() =>
      fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" }).then(res => res.json())
    );
}

function loadData() {
  const cached = getCachedData();
  if (cached) {
    data = cached;
    loadedLastUpdated = cached.meta?.lastUpdated || null;
    render();
  }

  fetchLiveData()
    .then(json => {
      const errors = validateData(json);
      if (errors.length > 0) {
        alert("Tournament data is invalid:\n\n" + errors.join("\n") + "\n\nPlease contact admin.");
        console.error("Data validation errors:", errors);
        return;
      }
      // Don't clobber in-progress edits that haven't been saved yet.
      let hasLocalUnsaved = false;
      try { hasLocalUnsaved = localStorage.getItem("classicUnsaved") === "1"; } catch (e) {}
      if (data && hasLocalUnsaved) return;
      if (!data || isNewerData(json, data)) {
        data = json;
        loadedLastUpdated = json.meta?.lastUpdated || null;
        render();
        saveCachedData(json);
        saveLeaderboardCache(json);
      }
    })
    .catch(err => {
      alert("Error loading tournament data. Please refresh.");
      console.error(err);
    });
}

/*************************
 * TAB SWITCHING
 *************************/
function switchTab(tab) {
  activeTab = tab;

  // Update tab buttons
  document.querySelectorAll(".admin-tab").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  if (activeBtn) activeBtn.classList.add("active");

  // Update tab content
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  const activeContent = document.getElementById(`tab-${tab}`);
  if (activeContent) activeContent.classList.add("active");

  // Re-render the active tab
  if (data) render();
}

function detectDefaultTab() {
  if (!data) return "draft";

  const players = Object.values(data.players);
  const draftable = players.filter(p => !p.captain);
  const drafted = draftable.filter(p => p.team === "green" || p.team === "red");

  // Not all drafted yet -> Draft tab
  if (drafted.length < draftable.length) return "draft";

  // All drafted but no matchups set -> Matchups tab
  const hasMatchups = data.matches.some(m => m.playerIds[0] && m.playerIds[1]);
  if (!hasMatchups) return "matchups";

  // Matchups set -> Score Entry tab
  return "scores";
}

/*************************
 * RENDER DISPATCH
 *************************/
function render() {
  try {
    if (isFoursomeUser()) {
      // Foursome users: always scores tab, only their foursome
      activeTab = "scores";
      document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
      const scoresTab = document.getElementById("tab-scores");
      if (scoresTab) scoresTab.classList.add("active");

      renderStats();
      renderTotals();
      renderFoursomes();
      return;
    }

    // Auto-detect tab on first load
    if (!render._initialized) {
      render._initialized = true;
      const defaultTab = detectDefaultTab();
      if (defaultTab !== activeTab) {
        switchTab(defaultTab);
        return; // switchTab calls render
      }
    }

    if (activeTab === "draft") {
      renderDraft();
    } else if (activeTab === "matchups") {
      renderMatchupBuilder();
    } else if (activeTab === "scores") {
      renderStats();
      renderTotals();
      renderFoursomes();
    }
  } catch (err) {
    console.error("Render error:", err);
    alert("Error rendering page: " + err.message + "\n\nTry refreshing the page.");
  }
}

/*************************
 * DRAFT TAB
 *************************/
function renderDraft() {
  renderEventSetup();
  const T = ClassicTeams(data);
  const gh = document.getElementById("admin-team-green-header");
  const rh = document.getElementById("admin-team-red-header");
  if (gh) gh.textContent = "Team " + T.green.name;
  if (rh) rh.textContent = "Team " + T.red.name;

  const players = Object.entries(data.players);
  const teamGreen = players.filter(([, p]) => p.team === "green" && !p.captain).sort((a, b) => a[1].rank - b[1].rank);
  const teamRed = players.filter(([, p]) => p.team === "red" && !p.captain).sort((a, b) => a[1].rank - b[1].rank);
  const pool = players.filter(([, p]) => p.team === null && !p.captain).sort((a, b) => a[1].rank - b[1].rank);
  const totalDraftable = players.filter(([, p]) => !p.captain).length;
  const totalDrafted = teamGreen.length + teamRed.length;

  // Status banner
  renderDraftStatus(totalDrafted, totalDraftable);

  // Team columns
  renderAdminTeamColumn("admin-team-green-slots", teamGreen, TEAM_PICK_LIMIT);
  renderAdminTeamColumn("admin-team-red-slots", teamRed, TEAM_PICK_LIMIT);

  // Player pool
  renderDraftPool(pool);
}

function renderDraftStatus(drafted, total) {
  const el = document.getElementById("admin-draft-status");
  if (!el) return;

  if (drafted === 0) {
    el.className = "draft-status draft-status--waiting";
    el.textContent = "Draft has not started \u2014 click a team button to assign players";
  } else if (drafted < total) {
    el.className = "draft-status draft-status--live";
    el.textContent = `Draft in progress \u2014 ${drafted} of ${total} picked`;
  } else {
    el.className = "draft-status draft-status--complete";
    el.textContent = "Draft Complete \u2014 switch to Matchups tab to build pairings";
  }
}

function renderAdminTeamColumn(elId, players, slots) {
  const el = document.getElementById(elId);
  if (!el) return;

  let html = "";
  for (let i = 0; i < slots; i++) {
    const entry = players[i];
    if (entry) {
      const [id, p] = entry;
      html += `
        <div class="draft-slot draft-slot--filled" style="animation-delay: ${i * 0.08}s">
          <div class="draft-slot__rank">#${p.rank}</div>
          <div class="draft-slot__name">${escapeHTML(p.name)}</div>
          <div class="draft-slot__pops">${p.pops} pops</div>
          <button class="draft-slot__undraft" onclick="undraftPlayer('${id}')">Remove</button>
        </div>`;
    } else {
      html += `
        <div class="draft-slot draft-slot--empty">
          <div class="draft-slot__placeholder">Pick ${i + 1}</div>
        </div>`;
    }
  }
  el.innerHTML = html;
}

function renderDraftPool(pool) {
  const header = document.getElementById("admin-pool-header");
  const grid = document.getElementById("admin-pool-grid");
  if (!header || !grid) return;

  if (pool.length === 0) {
    header.style.display = "none";
    grid.innerHTML = "";
    return;
  }
  header.style.display = "";

  const T = ClassicTeams(data);
  grid.innerHTML = pool.map(([id, p]) => {
    const greenBtn = `<button class="btn-green" onclick="draftPlayer('${id}', 'green')">Team ${escapeHTML(T.green.name)}</button>`;
    const redBtn = `<button class="btn-red" onclick="draftPlayer('${id}', 'red')">Team ${escapeHTML(T.red.name)}</button>`;

    return `
      <div class="draft-pool-card player-card">
        <div class="rank-badge">${p.rank}</div>
        <div class="pool-player-name">${escapeHTML(p.name)}</div>
        <div class="pool-player-info">${p.pops} pops</div>
        <div class="pool-actions">
          ${greenBtn}
          ${redBtn}
        </div>
      </div>
    `;
  }).join("");
}

function draftPlayer(id, team) {
  if (!data.players[id]) return;

  // Count drafted players on the team (captains don't count toward the 5 picks).
  const teamCount = Object.values(data.players).filter(p => p.team === team && !p.captain).length;
  if (teamCount >= TEAM_PICK_LIMIT) {
    const T = ClassicTeams(data);
    alert(`Team ${T.name(team)} is full (${TEAM_PICK_LIMIT} players).`);
    return;
  }

  data.players[id].team = team;
  markUnsaved();
  render();
}

function undraftPlayer(id) {
  if (!confirm(`Remove ${data.players[id].name} from their team?`)) return;

  data.players[id].team = null;

  // Clear player from any match slots
  data.matches.forEach(match => {
    if (match.playerIds[0] === id) match.playerIds[0] = null;
    if (match.playerIds[1] === id) match.playerIds[1] = null;
  });

  markUnsaved();
  render();
}

/*************************
 * MATCHUP BUILDER TAB
 *************************/
function renderMatchupBuilder() {
  const container = document.getElementById("matchup-builder-container");
  const statusEl = document.getElementById("matchup-status");
  if (!container) return;

  const T = ClassicTeams(data);
  const greenPlayers = Object.entries(data.players)
    .filter(([id, p]) => p.team === "green")
    .sort((a, b) => a[1].rank - b[1].rank);
  const redPlayers = Object.entries(data.players)
    .filter(([id, p]) => p.team === "red")
    .sort((a, b) => a[1].rank - b[1].rank);

  // Check draft completeness (each team needs 5 picks + captain = 6)
  if (greenPlayers.length <= TEAM_PICK_LIMIT || redPlayers.length <= TEAM_PICK_LIMIT) {
    if (statusEl) {
      statusEl.className = "draft-status draft-status--waiting";
      statusEl.textContent = `Draft not complete. Assign all ${TEAM_PICK_LIMIT * 2} players before building matchups.`;
    }
    container.innerHTML = "";
    return;
  }

  // Find which players are already assigned to matches
  const assignedGreen = new Set();
  const assignedRed = new Set();
  data.matches.forEach(match => {
    [0, 1].forEach(i => {
      const id = match.playerIds[i];
      if (!id) return;
      const p = data.players[id];
      if (!p) return;
      if (p.team === "green") assignedGreen.add(id);
      if (p.team === "red") assignedRed.add(id);
    });
  });

  const matchSlots = TEAM_PICK_LIMIT + 1; // drafted players + captain
  const allAssigned = assignedGreen.size === matchSlots && assignedRed.size === matchSlots;
  if (statusEl) {
    if (allAssigned) {
      statusEl.className = "draft-status draft-status--complete";
      statusEl.textContent = "All matchups set! Switch to Score Entry to enter results.";
    } else {
      statusEl.className = "draft-status draft-status--live";
      statusEl.textContent = `Assign players to match slots (${assignedGreen.size + assignedRed.size}/${matchSlots * 2} assigned)`;
    }
  }

  // Build foursomes (2 matches each)
  let html = "";
  for (let f = 0; f < 3; f++) {
    html += `<div class="matchup-builder-foursome"><h3>Foursome ${f + 1}</h3>`;

    for (let m = 0; m < 2; m++) {
      const matchIndex = f * 2 + m;
      const match = data.matches[matchIndex];

      html += `<div class="matchup-builder-match">`;

      // Team Green dropdown
      html += `<div>
        <label>Team ${escapeHTML(T.green.name)}</label>
        ${buildMatchupSelect(match, 0, matchIndex, "green", greenPlayers, assignedGreen)}
      </div>`;

      html += `<div class="matchup-builder-vs">VS</div>`;

      // Team Red dropdown
      html += `<div>
        <label>Team ${escapeHTML(T.red.name)}</label>
        ${buildMatchupSelect(match, 1, matchIndex, "red", redPlayers, assignedRed)}
      </div>`;

      html += `</div>`; // end match
    }

    html += `</div>`; // end foursome
  }

  container.innerHTML = html;
}

function buildMatchupSelect(match, playerIndex, matchIndex, team, teamPlayers, assignedSet) {
  const currentId = match.playerIds[playerIndex];
  let html = `<select onchange="updateMatchupPlayer(${matchIndex}, ${playerIndex}, this.value)">`;
  html += `<option value="">-- Select --</option>`;

  teamPlayers.forEach(([id, p]) => {
    // Show if: currently selected for this slot, or not assigned elsewhere
    const isSelected = currentId === id;
    const isAvailable = !assignedSet.has(id) || isSelected;
    if (!isAvailable) return;

    html += `<option value="${id}" ${isSelected ? "selected" : ""}>${escapeHTML(p.name)} (${p.pops} pops)</option>`;
  });

  html += `</select>`;
  return html;
}

function updateMatchupPlayer(matchIndex, playerIndex, playerId) {
  data.matches[matchIndex].playerIds[playerIndex] = playerId || null;
  markUnsaved();
  render();
}

/*************************
 * SCORE ENTRY TAB
 *************************/
function renderStats() {
  // Hide stats and totals for foursome users
  const statsSection = document.querySelector(".admin-stats");
  const totalsSection = document.querySelector(".totals-panel");
  if (isFoursomeUser()) {
    if (statsSection) statsSection.style.display = "none";
    if (totalsSection) totalsSection.style.display = "none";
    return;
  }
  if (statsSection) statsSection.style.display = "";
  if (totalsSection) totalsSection.style.display = "";

  let complete = 0;
  let inProgress = 0;
  let notStarted = 0;

  data.matches.forEach(match => {
    const front = match.points.front9;
    const back = match.points.back9;

    if (front !== null && back !== null) {
      complete++;
    } else if (front !== null || back !== null) {
      inProgress++;
    } else {
      notStarted++;
    }
  });

  const totalMatches = data.matches.length;
  const progress = Math.round((complete / totalMatches) * 100);

  document.getElementById("stat-complete").textContent = complete;
  document.getElementById("stat-in-progress").textContent = inProgress;
  document.getElementById("stat-not-started").textContent = notStarted;
  document.getElementById("stat-progress").textContent = progress + "%";
}

function renderTotals() {
  const totals = calculateTotals();
  const T = ClassicTeams(data);

  const gName = document.getElementById("total-green-name");
  const rName = document.getElementById("total-red-name");
  if (gName) gName.textContent = "Team " + T.green.name;
  if (rName) rName.textContent = "Team " + T.red.name;

  document.getElementById("total-green").textContent = totals.green.toFixed(1);
  document.getElementById("total-red").textContent = totals.red.toFixed(1);

  const greenCard = document.querySelector(".total-card.green");
  const redCard = document.querySelector(".total-card.red");

  greenCard.classList.remove("winning");
  redCard.classList.remove("winning");

  if (totals.green > totals.red) {
    greenCard.classList.add("winning");
  } else if (totals.red > totals.green) {
    redCard.classList.add("winning");
  }
}

function calculateTotals() {
  const T = ClassicTeams(data);
  const totals = { green: 0, red: 0 };

  data.matches.forEach(match => {
    const [p1, p2] = match.playerIds;
    if (!p1 || !p2) return;

    const s1 = T.sideOf(data.players[p1]);
    const s2 = T.sideOf(data.players[p2]);
    if (!s1 || !s2) return;

    ["front9", "back9"].forEach(key => {
      const v = match.points[key];
      if (v === null) return;
      totals[s1] += v;
      totals[s2] += 1 - v;
    });
  });

  return totals;
}

function renderFoursomes() {
  const container = document.getElementById("foursomes");
  container.innerHTML = "";

  const foursomes = [];
  for (let i = 0; i < data.matches.length; i += 2) {
    foursomes.push(data.matches.slice(i, i + 2));
  }

  foursomes.forEach((matches, foursomeIndex) => {
    // Foursome users only see their own foursome
    if (isFoursomeUser() && foursomeIndex !== userFoursome) return;

    const foursomeDiv = document.createElement("div");
    foursomeDiv.className = "foursome-container";

    if (!isFoursomeUser()) {
      const title = document.createElement("div");
      title.className = "foursome-title";
      title.textContent = `Foursome ${foursomeIndex + 1}`;
      foursomeDiv.appendChild(title);
    }

    matches.forEach((match, localIndex) => {
      const matchIndex = foursomeIndex * 2 + localIndex;
      foursomeDiv.appendChild(buildMatch(match, matchIndex));
    });

    container.appendChild(foursomeDiv);
  });
}

function buildMatch(match, matchIndex) {
  const div = document.createElement("div");
  div.className = "match";
  div.id = `match-${matchIndex}`;

  if (expandedMatches.has(matchIndex)) {
    div.classList.add("expanded");
  }

  const front = match.points.front9;
  const back = match.points.back9;
  let status = "not-started";
  let statusText = "Not Started";

  if (front !== null && back !== null) {
    status = "complete";
    statusText = "Complete";
    div.classList.add("complete");
  } else if (front !== null || back !== null) {
    status = "in-progress";
    statusText = "In Progress";
  }

  const valid = isValidMatchup(match);
  if (!valid && (match.playerIds[0] || match.playerIds[1])) {
    div.classList.add("invalid");
  }

  const [p1, p2] = match.playerIds;
  const p1Name = p1 ? escapeHTML(data.players[p1].name) + (data.players[p1].captain ? ' (Capt)' : '') : "Not Selected";
  const p2Name = p2 ? escapeHTML(data.players[p2].name) + (data.players[p2].captain ? ' (Capt)' : '') : "Not Selected";

  const header = `
    <div class="match-header" onclick="toggleMatch(${matchIndex})">
      <div class="match-title">Match ${match.id}</div>
      <div class="match-status-badge ${status}">${statusText}</div>
    </div>
    <div class="match-preview" onclick="toggleMatch(${matchIndex})">
      <div><strong>${p1Name}</strong> vs <strong>${p2Name}</strong></div>
      <div>
        F9: ${front === null ? "-" : front} |
        B9: ${back === null ? "-" : back}
      </div>
    </div>
  `;

  const playerSelects = isFoursomeUser() ? '' : `
      <div class="teams-row">
        <div class="team-select-box team-green">
          <label>Team ${escapeHTML(ClassicTeams(data).green.name)} Player</label>
          ${buildTeamSelect(match, 0, matchIndex, 'green')}
        </div>
        <div class="vs-text">VS</div>
        <div class="team-select-box team-red">
          <label>Team ${escapeHTML(ClassicTeams(data).red.name)} Player</label>
          ${buildTeamSelect(match, 1, matchIndex, 'red')}
        </div>
      </div>`;

  const details = `
    <div class="match-details">
      ${!valid && (p1 || p2) ? '<div class="error-message">Invalid matchup: Both players must be from different teams.</div>' : ''}
      ${playerSelects}
      ${valid ? buildHoleByHoleGrid(match, matchIndex) : ''}
      <div class="match-actions">
        <button class="match-btn" onclick="clearMatch(${matchIndex})">
          Clear Scores
        </button>
      </div>
    </div>
  `;

  div.innerHTML = header + details;
  return div;
}

function buildTeamSelect(match, playerIndex, matchIndex, team) {
  const selectId = `player-${matchIndex}-${playerIndex}`;
  let html = `<select id="${selectId}" onchange="updatePlayer(${matchIndex}, ${playerIndex}, this.value)">`;
  html += '<option value="">-- Select Player --</option>';

  const sortedPlayers = Object.entries(data.players)
    .filter(([id, p]) => p.team === team)
    .sort((a, b) => a[1].rank - b[1].rank);

  sortedPlayers.forEach(([id, p]) => {
    const selected = match.playerIds[playerIndex] === id ? 'selected' : '';
    const label = p.captain ? `${escapeHTML(p.name)} (Capt)` : `${escapeHTML(p.name)} (${p.pops} pops)`;
    html += `<option value="${id}" ${selected}>${label}</option>`;
  });

  html += '</select>';
  return html;
}

function buildScoreSelect(match, key, matchIndex, valid) {
  const selectId = `score-${matchIndex}-${key}`;
  const disabled = !valid ? 'disabled' : '';

  const T = ClassicTeams(data);
  const [p1Id, p2Id] = match.playerIds;
  const p1Name = p1Id ? escapeHTML(data.players[p1Id].name) : `Team ${T.green.name} Player`;
  const p2Name = p2Id ? escapeHTML(data.players[p2Id].name) : `Team ${T.red.name} Player`;

  let html = `<select id="${selectId}" onchange="updateScore(${matchIndex}, '${key}', this.value)" ${disabled}>`;
  html += '<option value="">-- Select Winner --</option>';
  html += `<option value="1"${match.points[key] === 1 ? ' selected' : ''}>${p1Name} Wins</option>`;
  html += `<option value="0.5"${match.points[key] === 0.5 ? ' selected' : ''}>Tie</option>`;
  html += `<option value="0"${match.points[key] === 0 ? ' selected' : ''}>${p2Name} Wins</option>`;
  html += '</select>';

  return html;
}

/*************************
 * HOLE-BY-HOLE SCORING
 *************************/

// Course par data for quick lookup
const COURSE_PARS = {
  1: 5, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4, 7: 3, 8: 4, 9: 4,
  10: 4, 11: 5, 12: 4, 13: 3, 14: 4, 15: 4, 16: 4, 17: 3, 18: 5
};

// Which holes the underdog receives a pop on (hardest holes, par 3s excluded),
// and which side (1 = p1, 2 = p2) is the underdog. Uses the course handicaps.
function strokeHolesForMatch(match) {
  const [p1, p2] = match.playerIds;
  if (!p1 || !p2 || !data.players[p1] || !data.players[p2]) {
    return { holes: new Set(), underdog: 0, diff: 0 };
  }
  const pops1 = data.players[p1].pops || 0;
  const pops2 = data.players[p2].pops || 0;
  const diff = Math.abs(pops1 - pops2);
  if (diff === 0) return { holes: new Set(), underdog: 0, diff: 0 };
  const underdog = pops1 > pops2 ? 1 : 2;
  const rows = [];
  const course = (data.course) || {};
  ["front9", "back9"].forEach(nine => {
    const c = course[nine] || {};
    Object.keys(c).forEach(h => rows.push({ hole: +h, par: c[h].par, hcp: c[h].handicap }));
  });
  const eligible = rows.filter(r => r.par !== 3).sort((a, b) => a.hcp - b.hcp).slice(0, diff);
  return { holes: new Set(eligible.map(r => r.hole)), underdog, diff };
}

// Derive the hole winner from gross strokes + pops: 1 = p1, 0 = p2, 0.5 tie.
function winnerFromGross(match, holeNum, g1, g2) {
  if (g1 == null || g2 == null || g1 === "" || g2 === "") return null;
  const sh = strokeHolesForMatch(match);
  let net1 = Number(g1), net2 = Number(g2);
  if (sh.holes.has(holeNum)) {
    if (sh.underdog === 1) net1 -= 1; else net2 -= 1;
  }
  return net1 < net2 ? 1 : net2 < net1 ? 0 : 0.5;
}

function toggleGross(matchIndex) {
  if (grossMatches.has(matchIndex)) grossMatches.delete(matchIndex);
  else grossMatches.add(matchIndex);
  render();
}

function setHoleGross(matchIndex, holeNum, playerIndex, value) {
  const match = data.matches[matchIndex];
  if (!match.points.gross) match.points.gross = {};
  const pair = match.points.gross[holeNum] || [null, null];
  const v = value === "" ? null : Math.max(1, Math.min(20, parseInt(value, 10) || 0));
  pair[playerIndex] = v;
  match.points.gross[holeNum] = pair;

  // If both strokes are in, auto-set the hole winner (net, with pops).
  const derived = winnerFromGross(match, holeNum, pair[0], pair[1]);
  if (derived !== null) {
    if (!match.points.holes) { match.points.holes = {}; for (let i = 1; i <= 18; i++) match.points.holes[i] = null; }
    match.points.holes[holeNum] = derived;
    match.points.front9 = calculateNineFromHoles(match.points.holes, 1, 9);
    match.points.back9 = calculateNineFromHoles(match.points.holes, 10, 18);
    const f = match.points.front9, b = match.points.back9;
    match.status = (f !== null && b !== null) ? "complete" : (f !== null || b !== null) ? "in_progress" : "not_started";
  }
  markUnsaved();
  updateMatchInPlace(matchIndex);
}

function buildHoleByHoleGrid(match, matchIndex) {
  const [p1Id, p2Id] = match.playerIds;
  const p1Name = p1Id ? escapeHTML(data.players[p1Id].name) : "P1";
  const p2Name = p2Id ? escapeHTML(data.players[p2Id].name) : "P2";
  const holes = match.points.holes || {};

  // Calculate nine results for display
  const front9Result = calculateNineFromHoles(holes, 1, 9);
  const back9Result = calculateNineFromHoles(holes, 10, 18);

  // Count holes played per nine
  const front9Played = countHolesPlayed(holes, 1, 9);
  const back9Played = countHolesPlayed(holes, 10, 18);

  let html = `<div class="hole-scoring-section">`;

  // Nine result summary bar
  html += `<div class="nine-results-bar">
    <div class="nine-result-item">
      <span class="nine-result-label">Front 9</span>
      <span class="nine-result-value ${front9Result === null ? 'pending' : ''}">${formatNineResult(front9Result, p1Name, p2Name, front9Played)}</span>
    </div>
    <div class="nine-result-item">
      <span class="nine-result-label">Back 9</span>
      <span class="nine-result-value ${back9Result === null ? 'pending' : ''}">${formatNineResult(back9Result, p1Name, p2Name, back9Played)}</span>
    </div>
  </div>`;

  // Optional gross-score mode + pops note
  const grossMode = grossMatches.has(matchIndex);
  const sh = strokeHolesForMatch(match);
  let popsNote = "Even — no pops";
  if (sh.diff > 0) {
    const uId = match.playerIds[sh.underdog - 1];
    const uName = uId && data.players[uId] ? escapeHTML(data.players[uId].name) : "Underdog";
    popsNote = `${uName} gets ${sh.diff} (hardest non-par-3 holes)`;
  }
  html += `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin:8px 0; flex-wrap:wrap;">
    <label style="font-size:0.85em; color:#0d3d1f; font-weight:600; display:flex; align-items:center; gap:6px; cursor:pointer;">
      <input type="checkbox" onchange="toggleGross(${matchIndex})" ${grossMode ? "checked" : ""}> Gross scoring (auto-scores holes)
    </label>
    <span style="font-size:0.78em; color:#006747; font-weight:600;">${popsNote}</span>
  </div>`;
  const gross = match.points.gross || {};

  // Front 9 grid
  html += `<div class="hole-grid-section">
    <div class="hole-grid-label">Front 9</div>
    <div class="hole-grid">`;
  for (let h = 1; h <= 9; h++) {
    html += buildHoleRow(h, holes[h], p1Name, p2Name, matchIndex, grossMode, gross, sh);
  }
  html += `</div></div>`;

  // Back 9 grid
  html += `<div class="hole-grid-section">
    <div class="hole-grid-label">Back 9</div>
    <div class="hole-grid">`;
  for (let h = 10; h <= 18; h++) {
    html += buildHoleRow(h, holes[h], p1Name, p2Name, matchIndex, grossMode, gross, sh);
  }
  html += `</div></div>`;

  html += `</div>`;
  return html;
}

function buildHoleRow(holeNum, value, p1Name, p2Name, matchIndex, grossMode, gross, sh) {
  const par = COURSE_PARS[holeNum];
  const isP1 = value === 1;
  const isHalved = value === 0.5;
  const isP2 = value === 0;

  let grossRow = "";
  if (grossMode) {
    const g = (gross && gross[holeNum]) || [null, null];
    const dot = sh && sh.holes && sh.holes.has(holeNum)
      ? `<span class="g-net" title="Pop hole">● pop</span>` : `<span class="g-net"></span>`;
    grossRow = `
      <div class="hole-gross">
        <input type="number" inputmode="numeric" min="1" max="20" aria-label="${p1Name} strokes" placeholder="${p1Name.slice(0, 3)}" value="${g[0] == null ? "" : g[0]}" onchange="setHoleGross(${matchIndex}, ${holeNum}, 0, this.value)">
        ${dot}
        <input type="number" inputmode="numeric" min="1" max="20" aria-label="${p2Name} strokes" placeholder="${p2Name.slice(0, 3)}" value="${g[1] == null ? "" : g[1]}" onchange="setHoleGross(${matchIndex}, ${holeNum}, 1, this.value)">
      </div>`;
  }

  return `
    <div class="hole-row">
      <div class="hole-info">
        <span class="hole-num">${holeNum}</span>
        <span class="hole-par">Par ${par}</span>
      </div>
      <div class="hole-buttons">
        <button class="hole-btn hole-btn-p1 ${isP1 ? 'active' : ''}" data-hole="${holeNum}" data-res="1" onclick="setHoleResult(${matchIndex}, ${holeNum}, 1)">${p1Name}</button>
        <button class="hole-btn hole-btn-halved ${isHalved ? 'active' : ''}" data-hole="${holeNum}" data-res="0.5" onclick="setHoleResult(${matchIndex}, ${holeNum}, 0.5)">Tie</button>
        <button class="hole-btn hole-btn-p2 ${isP2 ? 'active' : ''}" data-hole="${holeNum}" data-res="0" onclick="setHoleResult(${matchIndex}, ${holeNum}, 0)">${p2Name}</button>
      </div>
      ${grossRow}
    </div>`;
}

function setHoleResult(matchIndex, holeNum, value) {
  const match = data.matches[matchIndex];
  if (!match.points.holes) {
    match.points.holes = {};
    for (let i = 1; i <= 18; i++) match.points.holes[i] = null;
  }

  // Tapping the already-selected result clears it (toggle off); otherwise set it.
  match.points.holes[holeNum] = (match.points.holes[holeNum] === value) ? null : value;

  // Auto-calculate front9 and back9
  match.points.front9 = calculateNineFromHoles(match.points.holes, 1, 9);
  match.points.back9 = calculateNineFromHoles(match.points.holes, 10, 18);

  // Keep the stored status in step with the scores
  const f = match.points.front9, b = match.points.back9;
  match.status = (f !== null && b !== null) ? "complete"
    : (f !== null || b !== null) ? "in_progress" : "not_started";

  markUnsaved();
  updateMatchInPlace(matchIndex);
}

// Update only the hole buttons and nine-result summary for a match
// without rebuilding the entire DOM (preserves expand state and scroll position)
function updateMatchInPlace(matchIndex) {
  const match = data.matches[matchIndex];
  const matchEl = document.getElementById(`match-${matchIndex}`);
  if (!matchEl) { render(); return; }

  const [p1Id, p2Id] = match.playerIds;
  const p1Name = p1Id ? escapeHTML(data.players[p1Id].name) : "P1";
  const p2Name = p2Id ? escapeHTML(data.players[p2Id].name) : "P2";
  const holes = match.points.holes || {};

  // Update each hole's button highlight from the current value. Buttons are
  // selected by their stable data-hole/data-res attributes, and the active
  // class simply reflects whether that button's result matches the value.
  matchEl.querySelectorAll('.hole-btn[data-hole]').forEach(btn => {
    const h = Number(btn.getAttribute('data-hole'));
    const res = Number(btn.getAttribute('data-res')); // 1, 0.5, or 0
    const v = holes[h];
    btn.classList.toggle('active', v !== null && v !== undefined && v === res);
  });

  // Update the nine-result summary bar
  const front9Result = calculateNineFromHoles(holes, 1, 9);
  const back9Result = calculateNineFromHoles(holes, 10, 18);
  const front9Played = countHolesPlayed(holes, 1, 9);
  const back9Played = countHolesPlayed(holes, 10, 18);

  const nineValues = matchEl.querySelectorAll('.nine-result-value');
  if (nineValues[0]) {
    nineValues[0].textContent = formatNineResult(front9Result, p1Name, p2Name, front9Played);
    nineValues[0].classList.toggle('pending', front9Result === null);
  }
  if (nineValues[1]) {
    nineValues[1].textContent = formatNineResult(back9Result, p1Name, p2Name, back9Played);
    nineValues[1].classList.toggle('pending', back9Result === null);
  }

  // Update match header status badge
  const front = match.points.front9;
  const back = match.points.back9;
  let status = 'not-started';
  let statusText = 'Not Started';
  if (front !== null && back !== null) { status = 'complete'; statusText = 'Complete'; }
  else if (front !== null || back !== null) { status = 'in-progress'; statusText = 'In Progress'; }

  const badge = matchEl.querySelector('.match-status-badge');
  if (badge) {
    badge.className = `match-status-badge ${status}`;
    badge.textContent = statusText;
  }
  matchEl.classList.toggle('complete', front !== null && back !== null);

  // Update match preview F9/B9 line
  const preview = matchEl.querySelector('.match-preview div:last-child');
  if (preview) {
    preview.textContent = `F9: ${front === null ? '-' : front} | B9: ${back === null ? '-' : back}`;
  }

  // Also update the totals panel (non-destructive)
  if (!isFoursomeUser()) renderTotals();
}

function calculateNineFromHoles(holes, startHole, endHole) {
  if (!holes) return null;

  let p1Wins = 0;
  let p2Wins = 0;
  let anyPlayed = false;

  for (let h = startHole; h <= endHole; h++) {
    const v = holes[h];
    if (v === null || v === undefined) continue;
    anyPlayed = true;
    if (v === 1) p1Wins++;
    else if (v === 0) p2Wins++;
    // 0.5 = halved, doesn't count for either
  }

  if (!anyPlayed) return null;
  if (p1Wins > p2Wins) return 1;
  if (p2Wins > p1Wins) return 0;
  return 0.5;
}

function countHolesPlayed(holes, startHole, endHole) {
  if (!holes) return 0;
  let count = 0;
  for (let h = startHole; h <= endHole; h++) {
    if (holes[h] !== null && holes[h] !== undefined) count++;
  }
  return count;
}

function formatNineResult(result, p1Name, p2Name, holesPlayed) {
  if (result === null) return holesPlayed > 0 ? `In progress (${holesPlayed} holes)` : 'Not started';
  if (result === 1) return `${p1Name} wins (${holesPlayed} holes)`;
  if (result === 0) return `${p2Name} wins (${holesPlayed} holes)`;
  return `Halved (${holesPlayed} holes)`;
}

function isValidMatchup(match) {
  const [p1, p2] = match.playerIds;
  if (!p1 || !p2) return false;
  const side1 = data.players[p1].team; // "green" | "red" | null
  const side2 = data.players[p2].team;
  return !!side1 && !!side2 && side1 !== side2;
}

/*************************
 * UPDATE FUNCTIONS
 *************************/
function updatePlayer(matchIndex, playerIndex, playerId) {
  data.matches[matchIndex].playerIds[playerIndex] = playerId || null;
  markUnsaved();
  render();
}

function updateScore(matchIndex, key, value) {
  data.matches[matchIndex].points[key] = value === "" ? null : Number(value);
  markUnsaved();
  render();
}

function clearAll() {
  if (!confirm("Reset EVERYTHING? This will undo the draft, matchups, and all scores.")) return;
  if (!confirm("Are you sure? This cannot be undone without re-drafting.")) return;

  // Reset all players to undrafted (except captains, who keep their team slot)
  Object.values(data.players).forEach(p => {
    if (!p.captain) p.team = null;
  });

  // Reset all matches
  data.matches.forEach(match => {
    match.playerIds = [null, null];
    match.points.front9 = null;
    match.points.back9 = null;
    if (match.points.holes) {
      for (let i = 1; i <= 18; i++) match.points.holes[i] = null;
    }
    match.status = "not_started";
  });

  markUnsaved();
  render._initialized = false;
  switchTab("draft");
}

function clearMatch(matchIndex) {
  if (!confirm("Clear all scores for this match?")) return;
  const match = data.matches[matchIndex];
  match.points.front9 = null;
  match.points.back9 = null;
  if (match.points.holes) {
    for (let i = 1; i <= 18; i++) match.points.holes[i] = null;
  }
  markUnsaved();
  render();
}

function toggleMatch(index) {
  if (expandedMatches.has(index)) {
    expandedMatches.delete(index);
  } else {
    expandedMatches.add(index);
  }
  const match = document.getElementById(`match-${index}`);
  if (match) match.classList.toggle("expanded", expandedMatches.has(index));
}

/*************************
 * UNSAVED CHANGES
 *************************/
function markUnsaved() {
  hasUnsavedChanges = true;
  // Persist in-progress edits to this device so a reload or dead-zone doesn't
  // lose them; the flag tells loadData not to overwrite them from the server.
  try { if (typeof data !== "undefined" && data) saveCachedData(data); } catch (e) {}
  try { localStorage.setItem("classicUnsaved", "1"); } catch (e) {}
  document.getElementById("save-reminder").style.display = "block";
  const btn = document.getElementById("save-btn");
  if (btn) {
    btn.classList.add("unsaved");
    btn.style.background = "#c22e2e";
    btn.style.color = "#fff";
  }
  const status = document.getElementById("foursome-save-status");
  if (status) status.textContent = "Unsaved changes";
}

function markSaved() {
  hasUnsavedChanges = false;
  try { localStorage.removeItem("classicUnsaved"); } catch (e) {}
  document.getElementById("save-reminder").style.display = "none";
  const btn = document.getElementById("save-btn");
  if (btn) {
    btn.classList.remove("unsaved");
    btn.style.background = "";
    btn.style.color = "";
  }
  const status = document.getElementById("foursome-save-status");
  if (status) status.textContent = "Saved ✓";
}

function showToast(message, type = "success") {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `admin-toast admin-toast--${type} admin-toast--visible`;
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove("admin-toast--visible");
  }, 3000);
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// When the connection returns, push any scores entered while offline.
window.addEventListener('online', () => {
  if (hasUnsavedChanges) {
    showToast("Back online — uploading scores…");
    saveData();
  }
});

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (hasUnsavedChanges) saveData();
  }
});

/*************************
 * SAVE DATA
 *************************/
function saveData() {
  const foursomeMode = isFoursomeUser();
  const saveBtn = document.getElementById(foursomeMode ? 'foursome-save-btn' : 'save-btn');
  const originalText = saveBtn ? saveBtn.textContent : "Save";

  // Sends the current data to the server. Foursome scorers tag their group so
  // the server merges only their two matches — concurrent groups never clobber
  // each other. The admin sends a full document guarded by the optimistic lock.
  const postSave = () => {
    if (saveBtn) saveBtn.textContent = "Saving...";
    data.meta.lastUpdated = new Date().toISOString();

    return fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: ADMIN_PASSWORD_HASH,
        adminPassword: localStorage.getItem("adminPass") || "",
        foursomeToken: localStorage.getItem("foursomeToken") || "",
        expectedLastUpdated: loadedLastUpdated,
        foursome: foursomeMode ? userFoursome : null,
        data: data
      })
    })
      .then(async res => {
        const text = await res.text();
        let resp;
        try { resp = JSON.parse(text); }
        catch (e) { resp = { error: `HTTP ${res.status}: ${(text || "no response").slice(0, 140)}` }; }
        if (!res.ok && !resp.error) resp.error = `HTTP ${res.status}`;
        return resp;
      })
      .then(resp => {
        if (resp.success) {
          loadedLastUpdated = resp.lastUpdated || data.meta.lastUpdated;
          if (data.meta) data.meta.lastUpdated = loadedLastUpdated;
          markSaved();
          saveCachedData(data);
          saveLeaderboardCache(data);
          showToast("Saved successfully!");
        } else {
          const msg = resp.error || "Save failed";
          const friendly = /\bconflict\b/i.test(msg) ? "Save conflict — reload to get the latest, then re-enter."
            : "Save failed: " + msg;
          throw new Error(friendly);
        }
        if (saveBtn) { saveBtn.textContent = originalText; saveBtn.disabled = false; }
      });
  };

  if (saveBtn) { saveBtn.textContent = "Checking..."; saveBtn.disabled = true; }

  // Foursome scorers save straight through (server-side per-group merge is
  // conflict-free). The admin does a client-side pre-check on the whole file.
  if (foursomeMode) {
    postSave().catch(err => {
      console.error(err);
      showToast(!navigator.onLine
        ? "Offline — scores are saved on this phone and will upload when you reconnect."
        : (err.message || "Save failed — check your connection."), "error");
      if (saveBtn) { saveBtn.textContent = originalText; saveBtn.disabled = false; }
    });
    return;
  }

  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(serverData => {
      const serverTimestamp = serverData.meta?.lastUpdated;
      if (loadedLastUpdated && serverTimestamp && serverTimestamp !== loadedLastUpdated) {
        if (saveBtn) { saveBtn.textContent = originalText; saveBtn.disabled = false; }
        showToast("Conflict: someone else saved first. Reload to get latest changes.", "error");
        return;
      }
      return postSave();
    })
    .catch(err => {
      console.error(err);
      showToast(!navigator.onLine
        ? "Offline — scores are saved on this phone and will upload when you reconnect."
        : (err.message || "Save failed — check your connection."), "error");
      if (saveBtn) { saveBtn.textContent = originalText; saveBtn.disabled = false; }
    });
}

/*************************
 * ARCHIVE ROUND -> HISTORY
 * Snapshots the finished round (hole-by-hole) into history-data.json so the
 * History page keeps a permanent scorecard even after data.json is reused.
 *************************/
function formatTournamentDate(iso) {
  if (!iso) return "";
  const parts = String(iso).split("-").map(Number);
  const [y, m, d] = parts;
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  if (!y || !m || !d || m < 1 || m > 12) return String(iso);
  return `${months[m - 1]} ${d}, ${y}`;
}

function buildHistoryMatches() {
  return data.matches.map(m => {
    const [p1, p2] = m.playerIds;
    const pl1 = p1 ? data.players[p1] : null;
    const pl2 = p2 ? data.players[p2] : null;
    // Team side each player counts for: "green" | "red".
    const side1 = pl1 ? pl1.team : null;
    const side2 = pl2 ? pl2.team : null;
    const f = m.points.front9;
    const b = m.points.back9;
    const p1pts = (f === null ? 0 : f) + (b === null ? 0 : b);
    const p2pts = (f === null ? 0 : 1 - f) + (b === null ? 0 : 1 - b);
    return {
      id: m.id,
      player1: pl1 ? pl1.name : "TBD",
      player2: pl2 ? pl2.name : "TBD",
      side1,
      side2,
      pops1: pl1 ? pl1.pops : null,
      pops2: pl2 ? pl2.pops : null,
      holes: Object.assign({}, m.points.holes),
      gross: m.points.gross ? Object.assign({}, m.points.gross) : undefined,
      front9: f,
      back9: b,
      result: { p1: p1pts, p2: p2pts }
    };
  });
}

function archiveToHistory() {
  if (!data) { showToast("No data loaded yet.", "error"); return; }

  const totals = calculateTotals();
  const T = ClassicTeams(data);
  const year = parseInt(String(data.meta?.tournamentDate || "").slice(0, 4), 10) || new Date().getFullYear();
  const greenName = T.green.name;
  const redName = T.red.name;

  if (!confirm(
    `Archive the current round to History as ${year}?\n\n` +
    `Team ${greenName} ${totals.green} — Team ${redName} ${totals.red}\n\n` +
    `This saves a hole-by-hole record and marks the tournament complete. ` +
    `You can run it again to update the archive.`
  )) return;

  const mvpInput = (prompt("MVP for the history page? (optional — leave blank to skip)", "") || "").trim();

  const archiveBtn = document.getElementById("archive-btn");
  const orig = archiveBtn ? archiveBtn.textContent : "";
  if (archiveBtn) { archiveBtn.textContent = "Archiving..."; archiveBtn.disabled = true; }
  const restore = () => { if (archiveBtn) { archiveBtn.textContent = orig; archiveBtn.disabled = false; } };

  fetch(`./history-data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => (res.ok ? res.json() : { tournaments: [] }))
    .then(hist => {
      if (!hist || !Array.isArray(hist.tournaments)) hist = { tournaments: [] };
      const existing = hist.tournaments.find(t => t.year === year);

      const record = {
        year,
        name: `The Classic ${year}`,
        date: formatTournamentDate(data.meta?.tournamentDate),
        venue: data.meta?.venue || "Farm D' Allie Golf Club",
        status: "complete",
        teams: {
          green: { name: greenName, score: totals.green },
          red: { name: redName, score: totals.red }
        },
        matches: buildHistoryMatches(),
        mvp: mvpInput || existing?.mvp || null,
        notes: existing?.notes || ""
      };

      if (existing) Object.assign(existing, record);
      else hist.tournaments.push(record);

      return fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: ADMIN_PASSWORD_HASH,
          adminPassword: localStorage.getItem("adminPass") || "",
          file: "history-data.json",
          data: hist
        })
      }).then(r => r.json());
    })
    .then(resp => {
      if (resp && resp.success) showToast("Round archived to History ✓");
      else throw new Error(resp && resp.error ? resp.error : "Archive failed");
      restore();
    })
    .catch(err => {
      console.error(err);
      showToast("Archive failed — " + (err.message || "try again."), "error");
      restore();
    });
}

/*************************
 * EVENT SETUP + NEW SEASON
 *************************/
function genToken() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode.apply(null, bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Full-document admin save of the current `data` to data.json. Returns a promise.
function saveFullData() {
  data.meta = data.meta || {};
  data.meta.lastUpdated = new Date().toISOString();
  return fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: ADMIN_PASSWORD_HASH,
      adminPassword: localStorage.getItem("adminPass") || "",
      expectedLastUpdated: loadedLastUpdated,
      data: data
    })
  })
    .then(async res => {
      const text = await res.text();
      let resp; try { resp = JSON.parse(text); } catch (e) { resp = { error: `HTTP ${res.status}` }; }
      if (!resp.success) throw new Error(resp.error || "Save failed");
      loadedLastUpdated = resp.lastUpdated || data.meta.lastUpdated;
      data.meta.lastUpdated = loadedLastUpdated;
      saveCachedData(data);
      saveLeaderboardCache(data);
      return resp;
    });
}

// Populate the Event Setup fields from the current meta (once, so it doesn't
// clobber the admin while they're typing).
function renderEventSetup() {
  if (renderEventSetup._done) return;
  const m = (data && data.meta) || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el != null && el.value === "") el.value = v; };
  set("es-name", m.eventName || "");
  set("es-date", m.tournamentDate || "");
  set("es-venue", m.venue && m.venue !== "Pending" ? m.venue : "");
  set("es-teetime", m.teeTime || "");
  set("es-tz", m.timezoneOffset || "-05:00");
  set("es-tees", Array.isArray(m.teeTimes) ? m.teeTimes.join(", ") : "");
  renderEventSetup._done = true;
}

function readEventInputs() {
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
  const tees = val("es-tees").split(",").map(s => s.trim()).filter(Boolean);
  return {
    eventName: val("es-name") || "The Classic",
    tournamentDate: val("es-date") || null,
    venue: val("es-venue") || "Pending",
    teeTime: val("es-teetime") || "08:00",
    timezoneOffset: val("es-tz") || "-05:00",
    teeTimes: tees
  };
}

function saveEventInfo() {
  if (!data) return;
  const statusEl = document.getElementById("es-status");
  const info = readEventInputs();
  data.meta = Object.assign({}, data.meta, info);
  if (statusEl) statusEl.textContent = "Saving…";
  saveFullData()
    .then(() => { if (statusEl) statusEl.textContent = "Event info saved ✓"; showToast("Event info saved!"); })
    .catch(err => { if (statusEl) statusEl.textContent = ""; showToast("Save failed: " + err.message, "error"); });
}

function startNewSeason() {
  if (!data) return;
  const hasScores = data.matches.some(m => m.points && (m.points.front9 !== null || m.points.back9 !== null));
  const warn = "START A NEW SEASON?\n\n" +
    (hasScores ? "⚠ There are scores in the current event. Click \"Archive Round → History\" FIRST if you haven't.\n\n" : "") +
    "This will:\n" +
    "• Clear all teams, matchups, and scores\n" +
    "• Generate NEW scan-to-score tokens (old QR cards stop working)\n" +
    "• Keep the Event Setup info above\n\n" +
    "This cannot be undone. Continue?";
  if (!confirm(warn)) return;

  // Apply any edited event info first.
  data.meta = Object.assign({}, data.meta, readEventInputs());
  // Undraft everyone except captains (they keep their team slot).
  Object.values(data.players).forEach(p => { if (!p.captain) p.team = null; });
  // Clear matchups + scores.
  data.matches.forEach(m => {
    m.playerIds = [null, null];
    m.points = { front9: null, back9: null, holes: {} };
    for (let i = 1; i <= 18; i++) m.points.holes[i] = null;
    m.status = "not_started";
  });
  // Rotate scan-to-score tokens.
  data.meta.foursomeTokens = { [genToken()]: 1, [genToken()]: 2, [genToken()]: 3 };

  const statusEl = document.getElementById("es-status");
  if (statusEl) statusEl.textContent = "Starting new season…";
  saveFullData()
    .then(() => {
      render();
      showToast("New season started ✓");
      const toks = Object.entries(data.meta.foursomeTokens)
        .sort((a, b) => a[1] - b[1])
        .map(([t, n]) => `Foursome ${n}:  ${location.origin}/admin.html?s=${t}`)
        .join("\n");
      if (statusEl) statusEl.textContent = "New season ready — new QR links generated.";
      alert("NEW scan-to-score links (regenerate the foursome cards with these):\n\n" + toks +
        "\n\nOld cards no longer work.");
    })
    .catch(err => { if (statusEl) statusEl.textContent = ""; showToast("Failed: " + err.message, "error"); });
}
