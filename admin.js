/*************************
 * ADMIN CONSOLE
 * The Classic 2026
 * Tabs: Draft | Matchups | Score Entry
 *************************/

const ADMIN_PASSWORD_HASH = "5a40d95d61e29d6665ff382de6e0b0cc6a3bbb546aeececa59911e08d597587b";
const VALID_USERS = ["admin", "foursome1", "foursome2", "foursome3"];
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

let expandedMatchIndex = null;
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

function showAdmin() {
  document.getElementById("login-overlay").classList.add("hidden");
  document.getElementById("admin-app").style.display = "";

  // Hide tabs + admin-only buttons for foursome users
  const tabBar = document.querySelector(".admin-tabs");
  const clearBtn = document.querySelector(".btn-danger");
  const eyebrow = document.getElementById("admin-eyebrow");
  const title = document.getElementById("admin-title");
  const subtitle = document.getElementById("admin-subtitle");

  if (isFoursomeUser()) {
    if (tabBar) tabBar.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
    if (eyebrow) eyebrow.textContent = `Foursome ${userFoursome + 1} Scorer`;
    if (title) title.textContent = `Foursome ${userFoursome + 1}`;
    if (subtitle) subtitle.textContent = "Enter hole-by-hole scores for your matches.";
  } else {
    if (tabBar) tabBar.style.display = "";
    if (clearBtn) clearBtn.style.display = "";
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

// Check session on load
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

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicAdminData_v2";
const LEADERBOARD_CACHE_KEY = "classicLeaderboardData_v2";

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

function loadData() {
  const cached = getCachedData();
  if (cached) {
    data = cached;
    loadedLastUpdated = cached.meta?.lastUpdated || null;
    render();
  }

  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(json => {
      const errors = validateData(json);
      if (errors.length > 0) {
        alert("Tournament data is invalid:\n\n" + errors.join("\n") + "\n\nPlease contact admin.");
        console.error("Data validation errors:", errors);
        return;
      }
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
  const draftable = players.filter(p => p.team !== "coach");
  const drafted = draftable.filter(p => p.team === "brock" || p.team === "jared");

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
  const players = Object.entries(data.players);
  const teamBrock = players.filter(([, p]) => p.team === "brock").sort((a, b) => a[1].rank - b[1].rank);
  const teamJared = players.filter(([, p]) => p.team === "jared").sort((a, b) => a[1].rank - b[1].rank);
  const pool = players.filter(([, p]) => p.team === null || p.team === "coach").sort((a, b) => a[1].rank - b[1].rank);
  const totalDraftable = players.filter(([, p]) => p.team !== "coach").length;
  const totalDrafted = teamBrock.length + teamJared.length;

  // Status banner
  renderDraftStatus(totalDrafted, totalDraftable);

  // Team columns
  renderAdminTeamColumn("admin-team-brock-slots", teamBrock, TEAM_PICK_LIMIT);
  renderAdminTeamColumn("admin-team-jared-slots", teamJared, TEAM_PICK_LIMIT);

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

  grid.innerHTML = pool.map(([id, p]) => {
    const isCaptain = p.team === "coach";
    const brockBtn = isCaptain
      ? `<button class="btn-brock" disabled>Team Brock</button>`
      : `<button class="btn-brock" onclick="draftPlayer('${id}', 'brock')">Team Brock</button>`;
    const jaredBtn = isCaptain
      ? `<button class="btn-jared" disabled>Team Jared</button>`
      : `<button class="btn-jared" onclick="draftPlayer('${id}', 'jared')">Team Jared</button>`;

    return `
      <div class="draft-pool-card player-card">
        <div class="rank-badge">${p.rank}</div>
        <div class="pool-player-name">${escapeHTML(p.name)}</div>
        <div class="pool-player-info">${p.pops} pops</div>
        <div class="pool-actions">
          ${brockBtn}
          ${jaredBtn}
        </div>
      </div>
    `;
  }).join("");
}

function draftPlayer(id, team) {
  if (!data.players[id]) return;

  // Check team isn't full (captain + 5 picks = team of 6)
  const teamCount = Object.values(data.players).filter(p => p.team === team).length;
  if (teamCount >= TEAM_PICK_LIMIT) {
    alert(`Team ${team === 'brock' ? 'Brock' : 'Jared'} is full (${TEAM_PICK_LIMIT} players).`);
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

  const brockPlayers = Object.entries(data.players)
    .filter(([, p]) => p.team === "brock")
    .sort((a, b) => a[1].rank - b[1].rank);
  const jaredPlayers = Object.entries(data.players)
    .filter(([, p]) => p.team === "jared")
    .sort((a, b) => a[1].rank - b[1].rank);

  // Check draft completeness
  if (brockPlayers.length < TEAM_PICK_LIMIT || jaredPlayers.length < TEAM_PICK_LIMIT) {
    if (statusEl) {
      statusEl.className = "draft-status draft-status--waiting";
      statusEl.textContent = `Draft not complete. Assign all ${TEAM_PICK_LIMIT * 2} players before building matchups.`;
    }
    container.innerHTML = "";
    return;
  }

  // Find which players are already assigned to matches
  const assignedBrock = new Set();
  const assignedJared = new Set();
  data.matches.forEach(match => {
    if (match.playerIds[0]) {
      const p = data.players[match.playerIds[0]];
      if (p && p.team === "brock") assignedBrock.add(match.playerIds[0]);
      if (p && p.team === "jared") assignedJared.add(match.playerIds[0]);
    }
    if (match.playerIds[1]) {
      const p = data.players[match.playerIds[1]];
      if (p && p.team === "brock") assignedBrock.add(match.playerIds[1]);
      if (p && p.team === "jared") assignedJared.add(match.playerIds[1]);
    }
  });

  const allAssigned = assignedBrock.size === TEAM_PICK_LIMIT && assignedJared.size === TEAM_PICK_LIMIT;
  if (statusEl) {
    if (allAssigned) {
      statusEl.className = "draft-status draft-status--complete";
      statusEl.textContent = "All matchups set! Switch to Score Entry to enter results.";
    } else {
      statusEl.className = "draft-status draft-status--live";
      statusEl.textContent = `Assign players to match slots (${assignedBrock.size + assignedJared.size}/${TEAM_PICK_LIMIT * 2} assigned)`;
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

      // Team Brock dropdown
      html += `<div>
        <label>Team Brock</label>
        ${buildMatchupSelect(match, 0, matchIndex, "brock", brockPlayers, assignedBrock)}
      </div>`;

      html += `<div class="matchup-builder-vs">VS</div>`;

      // Team Jared dropdown
      html += `<div>
        <label>Team Jared</label>
        ${buildMatchupSelect(match, 1, matchIndex, "jared", jaredPlayers, assignedJared)}
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

  document.getElementById("total-brock").textContent = totals.brock.toFixed(1);
  document.getElementById("total-jared").textContent = totals.jared.toFixed(1);

  const brockCard = document.querySelector(".total-card.brock");
  const jaredCard = document.querySelector(".total-card.jared");

  brockCard.classList.remove("winning");
  jaredCard.classList.remove("winning");

  if (totals.brock > totals.jared) {
    brockCard.classList.add("winning");
  } else if (totals.jared > totals.brock) {
    jaredCard.classList.add("winning");
  }
}

function calculateTotals() {
  const totals = { brock: 0, jared: 0 };

  data.matches.forEach(match => {
    const [p1, p2] = match.playerIds;
    if (!p1 || !p2) return;

    const t1 = data.players[p1].team;
    const t2 = data.players[p2].team;
    if (t1 === 'coach' || t2 === 'coach') return;

    ["front9", "back9"].forEach(key => {
      const v = match.points[key];
      if (v === null) return;
      totals[t1] += v;
      totals[t2] += 1 - v;
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

    const title = document.createElement("div");
    title.className = "foursome-title";
    title.textContent = `Foursome ${foursomeIndex + 1}`;
    foursomeDiv.appendChild(title);

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

  if (expandedMatchIndex === matchIndex) {
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
  const p1Name = p1 ? escapeHTML(data.players[p1].name) + (data.players[p1].team === 'coach' ? ' (Coach)' : '') : "Not Selected";
  const p2Name = p2 ? escapeHTML(data.players[p2].name) + (data.players[p2].team === 'coach' ? ' (Coach)' : '') : "Not Selected";

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

  const details = `
    <div class="match-details">
      ${!valid && (p1 || p2) ? '<div class="error-message">Invalid matchup: Both players must be from different teams.</div>' : ''}

      <div class="teams-row">
        <div class="team-select-box team-brock">
          <label>Team Brock Player</label>
          ${buildTeamSelect(match, 0, matchIndex, 'brock')}
        </div>
        <div class="vs-text">VS</div>
        <div class="team-select-box team-jared">
          <label>Team Jared Player</label>
          ${buildTeamSelect(match, 1, matchIndex, 'jared')}
        </div>
      </div>

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
  let html = `<select id="${selectId}" onchange="updatePlayer(${matchIndex}, ${playerIndex}, this.value, '${team}')">`;
  html += '<option value="">-- Select Player --</option>';

  const sortedPlayers = Object.entries(data.players)
    .filter(([, p]) => p.team !== 'coach')
    .sort((a, b) => a[1].rank - b[1].rank);

  sortedPlayers.forEach(([id, p]) => {
    const selected = match.playerIds[playerIndex] === id ? 'selected' : '';
    const teamLabel = p.team === 'brock' ? ' [Team Brock]' : p.team === 'jared' ? ' [Team Jared]' : '';
    html += `<option value="${id}" ${selected}>${escapeHTML(p.name)} (${p.pops} pops)${teamLabel}</option>`;
  });

  html += '</select>';
  return html;
}

function buildScoreSelect(match, key, matchIndex, valid) {
  const selectId = `score-${matchIndex}-${key}`;
  const disabled = !valid ? 'disabled' : '';

  const [p1Id, p2Id] = match.playerIds;
  const p1Name = p1Id ? escapeHTML(data.players[p1Id].name) : "Team Brock Player";
  const p2Name = p2Id ? escapeHTML(data.players[p2Id].name) : "Team Jared Player";

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

  // Front 9 grid
  html += `<div class="hole-grid-section">
    <div class="hole-grid-label">Front 9</div>
    <div class="hole-grid">`;
  for (let h = 1; h <= 9; h++) {
    html += buildHoleRow(h, holes[h], p1Name, p2Name, matchIndex);
  }
  html += `</div></div>`;

  // Back 9 grid
  html += `<div class="hole-grid-section">
    <div class="hole-grid-label">Back 9</div>
    <div class="hole-grid">`;
  for (let h = 10; h <= 18; h++) {
    html += buildHoleRow(h, holes[h], p1Name, p2Name, matchIndex);
  }
  html += `</div></div>`;

  html += `</div>`;
  return html;
}

function buildHoleRow(holeNum, value, p1Name, p2Name, matchIndex) {
  const par = COURSE_PARS[holeNum];
  const isP1 = value === 1;
  const isHalved = value === 0.5;
  const isP2 = value === 0;

  return `
    <div class="hole-row">
      <div class="hole-info">
        <span class="hole-num">${holeNum}</span>
        <span class="hole-par">Par ${par}</span>
      </div>
      <div class="hole-buttons">
        <button class="hole-btn hole-btn-p1 ${isP1 ? 'active' : ''}" onclick="setHoleResult(${matchIndex}, ${holeNum}, ${isP1 ? 'null' : '1'})">${p1Name}</button>
        <button class="hole-btn hole-btn-halved ${isHalved ? 'active' : ''}" onclick="setHoleResult(${matchIndex}, ${holeNum}, ${isHalved ? 'null' : '0.5'})">Tie</button>
        <button class="hole-btn hole-btn-p2 ${isP2 ? 'active' : ''}" onclick="setHoleResult(${matchIndex}, ${holeNum}, ${isP2 ? 'null' : '0'})">${p2Name}</button>
      </div>
    </div>`;
}

function setHoleResult(matchIndex, holeNum, value) {
  const match = data.matches[matchIndex];
  if (!match.points.holes) {
    match.points.holes = {};
    for (let i = 1; i <= 18; i++) match.points.holes[i] = null;
  }

  match.points.holes[holeNum] = value;

  // Auto-calculate front9 and back9
  match.points.front9 = calculateNineFromHoles(match.points.holes, 1, 9);
  match.points.back9 = calculateNineFromHoles(match.points.holes, 10, 18);

  markUnsaved();
  render();
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
  if (data.players[p1].team === 'coach' || data.players[p2].team === 'coach') return false;
  return data.players[p1].team !== data.players[p2].team;
}

/*************************
 * UPDATE FUNCTIONS
 *************************/
function updatePlayer(matchIndex, playerIndex, playerId, team) {
  data.matches[matchIndex].playerIds[playerIndex] = playerId || null;

  if (playerId && data.players[playerId] && data.players[playerId].team !== 'coach') {
    data.players[playerId].team = team;
  }

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

  // Reset all players to undrafted (except coaches)
  Object.values(data.players).forEach(p => {
    if (p.team !== "coach") p.team = null;
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
  const match = document.getElementById(`match-${index}`);
  if (!match) return;

  if (expandedMatchIndex === index) {
    match.classList.remove("expanded");
    expandedMatchIndex = null;
    return;
  }

  if (expandedMatchIndex !== null) {
    const previous = document.getElementById(`match-${expandedMatchIndex}`);
    if (previous) {
      previous.classList.remove("expanded");
    }
  }

  match.classList.add("expanded");
  expandedMatchIndex = index;
}

/*************************
 * UNSAVED CHANGES
 *************************/
function markUnsaved() {
  hasUnsavedChanges = true;
  document.getElementById("save-reminder").style.display = "block";
}

function markSaved() {
  hasUnsavedChanges = false;
  document.getElementById("save-reminder").style.display = "none";
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/*************************
 * SAVE DATA
 *************************/
function saveData() {
  const coachInMatch = data.matches.some(match => {
    const [p1, p2] = match.playerIds;
    return (p1 && data.players[p1].team === 'coach') || (p2 && data.players[p2].team === 'coach');
  });
  if (coachInMatch) {
    alert("Cannot save: One or more matches contain a coach (non-playing). Remove coaches from all matches before saving.");
    return;
  }

  const saveBtn = document.querySelector('.btn-primary');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Checking...";
  saveBtn.disabled = true;

  // Optimistic locking: fetch current data and compare lastUpdated
  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(serverData => {
      const serverTimestamp = serverData.meta?.lastUpdated;
      if (loadedLastUpdated && serverTimestamp && serverTimestamp !== loadedLastUpdated) {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        alert("Someone else saved changes since you loaded. Please reload the page to see their changes before saving.");
        return;
      }

      // Safe to save — update timestamp and send
      saveBtn.textContent = "Saving...";
      data.meta.lastUpdated = new Date().toISOString();

      return fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: ADMIN_PASSWORD_HASH,
          expectedLastUpdated: loadedLastUpdated,
          data: data
        })
      })
        .then(res => res.json())
        .then(resp => {
          if (resp.success) {
            loadedLastUpdated = data.meta.lastUpdated;
            markSaved();
            saveCachedData(data);
            saveLeaderboardCache(data);
            alert("Saved successfully!");
          } else {
            throw new Error(resp.error || "Save failed");
          }
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        });
    })
    .catch(err => {
      console.error(err);
      alert("Save failed: " + err.message);
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
}
