/*************************
 * ADMIN CONSOLE
 * The Classic 2026
 * Tabs: Draft | Matchups | Score Entry
 *************************/

const ADMIN_PASSWORD = "classic2026";
let hasUnsavedChanges = false;
let expandedMatchIndex = null;
let activeTab = "draft";
let adminUser = "";

// Login handling
function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById("login-user").value.trim();
  const pass = document.getElementById("login-pass").value;
  const errorEl = document.getElementById("login-error");

  if (pass !== ADMIN_PASSWORD) {
    errorEl.textContent = "Invalid password";
    document.getElementById("login-pass").value = "";
    document.getElementById("login-pass").focus();
    return;
  }

  adminUser = user;
  sessionStorage.setItem("adminAuth", "true");
  sessionStorage.setItem("adminUser", user);
  showAdmin();
}

function showAdmin() {
  document.getElementById("login-overlay").classList.add("hidden");
  document.getElementById("admin-app").style.display = "";
  loadData();
}

// Check session on load
if (sessionStorage.getItem("adminAuth") === "true") {
  adminUser = sessionStorage.getItem("adminUser") || "";
  showAdmin();
}

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicAdminData";
const LEADERBOARD_CACHE_KEY = "classicLeaderboardData";

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

function loadData() {
  const cached = getCachedData();
  if (cached) {
    data = cached;
    render();
  }

  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(json => {
      if (!data || isNewerData(json, data)) {
        data = json;
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
}

/*************************
 * DRAFT TAB
 *************************/
function renderDraft() {
  const players = Object.entries(data.players);
  const teamBrock = players.filter(([, p]) => p.team === "brock").sort((a, b) => a[1].rank - b[1].rank);
  const teamJared = players.filter(([, p]) => p.team === "jared").sort((a, b) => a[1].rank - b[1].rank);
  const undrafted = players.filter(([, p]) => !p.team || p.team === null).sort((a, b) => a[1].rank - b[1].rank);
  const totalDraftable = players.filter(([, p]) => p.team !== "coach").length;
  const totalDrafted = teamBrock.length + teamJared.length;

  // Status banner
  renderDraftStatus(totalDrafted, totalDraftable);

  // Team columns
  renderAdminTeamColumn("admin-team-brock-slots", teamBrock, 6);
  renderAdminTeamColumn("admin-team-jared-slots", teamJared, 6);

  // Player pool
  renderDraftPool(undrafted);
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
          <div class="draft-slot__name">${p.name}</div>
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

function renderDraftPool(undrafted) {
  const header = document.getElementById("admin-pool-header");
  const grid = document.getElementById("admin-pool-grid");
  if (!header || !grid) return;

  if (undrafted.length === 0) {
    header.style.display = "none";
    grid.innerHTML = "";
    return;
  }
  header.style.display = "";

  grid.innerHTML = undrafted.map(([id, p]) => `
    <div class="draft-pool-card">
      <div class="pool-player-name">${p.name}</div>
      <div class="pool-player-info">#${p.rank} &bull; ${p.pops} pops</div>
      <div class="pool-actions">
        <button class="btn-brock" onclick="draftPlayer('${id}', 'brock')">Team Brock</button>
        <button class="btn-jared" onclick="draftPlayer('${id}', 'jared')">Team Jared</button>
      </div>
    </div>
  `).join("");
}

function draftPlayer(id, team) {
  if (!data.players[id]) return;

  // Check team isn't full (6 slots)
  const teamCount = Object.values(data.players).filter(p => p.team === team).length;
  if (teamCount >= 6) {
    alert(`Team ${team === 'brock' ? 'Brock' : 'Jared'} is full (6 players).`);
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
  if (brockPlayers.length < 6 || jaredPlayers.length < 6) {
    if (statusEl) {
      statusEl.className = "draft-status draft-status--waiting";
      statusEl.textContent = "Draft not complete. Assign all 12 players before building matchups.";
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

  const allAssigned = assignedBrock.size === 6 && assignedJared.size === 6;
  if (statusEl) {
    if (allAssigned) {
      statusEl.className = "draft-status draft-status--complete";
      statusEl.textContent = "All matchups set! Switch to Score Entry to enter results.";
    } else {
      statusEl.className = "draft-status draft-status--live";
      statusEl.textContent = `Assign players to match slots (${assignedBrock.size + assignedJared.size}/12 assigned)`;
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

    html += `<option value="${id}" ${isSelected ? "selected" : ""}>${p.name} (${p.pops} pops)</option>`;
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
  const p1Name = p1 ? data.players[p1].name + (data.players[p1].team === 'coach' ? ' (Coach)' : '') : "Not Selected";
  const p2Name = p2 ? data.players[p2].name + (data.players[p2].team === 'coach' ? ' (Coach)' : '') : "Not Selected";

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

      <div class="scores-grid">
        <div class="score-wrap">
          <label>Front 9 Winner</label>
          ${buildScoreSelect(match, "front9", matchIndex, valid)}
        </div>
        <div class="score-wrap">
          <label>Back 9 Winner</label>
          ${buildScoreSelect(match, "back9", matchIndex, valid)}
        </div>
      </div>

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
    html += `<option value="${id}" ${selected}>${p.name} (${p.pops} pops)${teamLabel}</option>`;
  });

  html += '</select>';
  return html;
}

function buildScoreSelect(match, key, matchIndex, valid) {
  const selectId = `score-${matchIndex}-${key}`;
  const disabled = !valid ? 'disabled' : '';

  const [p1Id, p2Id] = match.playerIds;
  const p1Name = p1Id ? data.players[p1Id].name : "Team Brock Player";
  const p2Name = p2Id ? data.players[p2Id].name : "Team Jared Player";

  let html = `<select id="${selectId}" onchange="updateScore(${matchIndex}, '${key}', this.value)" ${disabled}>`;
  html += '<option value="">-- Select Winner --</option>';
  html += `<option value="1"${match.points[key] === 1 ? ' selected' : ''}>${p1Name} Wins</option>`;
  html += `<option value="0.5"${match.points[key] === 0.5 ? ' selected' : ''}>Tie</option>`;
  html += `<option value="0"${match.points[key] === 0 ? ' selected' : ''}>${p2Name} Wins</option>`;
  html += '</select>';

  return html;
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

function clearMatch(matchIndex) {
  if (!confirm("Clear all scores for this match?")) return;
  const match = data.matches[matchIndex];
  match.points.front9 = null;
  match.points.back9 = null;
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
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  data.meta.lastUpdated = new Date().toISOString();

  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: ADMIN_PASSWORD,
      data: data
    })
  })
    .then(res => res.json())
    .then(resp => {
      if (resp.success) {
        markSaved();
        saveCachedData(data);
        saveLeaderboardCache(data);
        alert("Saved successfully!");
      } else {
        throw new Error(resp.error || "Save failed");
      }
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    })
    .catch(err => {
      console.error(err);
      alert("Save failed: " + err.message);
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
}
