/*************************
 * IMPROVED ADMIN INTERFACE
 * The Classic 2026
 *************************/

const ADMIN_PASSWORD = "classic2026";
let hasUnsavedChanges = false;
let expandedMatches = new Set(); // Track which matches are expanded

// Password check
if (sessionStorage.getItem("adminAuth") !== "true") {
  const entered = prompt("Enter admin password:");
  if (entered !== ADMIN_PASSWORD) {
    alert("Access denied");
    window.location.href = "index.html";
  }
  sessionStorage.setItem("adminAuth", "true");
}

/*************************
 * LOAD DATA
 *************************/
let data;

fetch("./data.json")
  .then(res => res.json())
  .then(json => {
    data = json;
    render();
  })
  .catch(err => {
    alert("Error loading tournament data. Please refresh.");
    console.error(err);
  });

/*************************
 * RENDER
 *************************/
function render() {
  renderStats();
  renderTotals();
  renderFoursomes();
}

/*************************
 * STATISTICS DASHBOARD
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

/*************************
 * TOTALS
 *************************/
function renderTotals() {
  const totals = calculateTotals();

  document.getElementById("total-brock").textContent = totals.brock.toFixed(1);
  document.getElementById("total-jared").textContent = totals.jared.toFixed(1);

  // Highlight winner
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

    ["front9", "back9"].forEach(key => {
      const v = match.points[key];
      if (v === null) return;
      totals[t1] += v;
      totals[t2] += 1 - v;
    });
  });

  return totals;
}

/*************************
 * FOURSOMES
 *************************/
function renderFoursomes() {
  const container = document.getElementById("foursomes");
  container.innerHTML = "";

  // Group matches into foursomes (2 matches per foursome)
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

/*************************
 * BUILD MATCH
 *************************/
function buildMatch(match, matchIndex) {
  const div = document.createElement("div");
  div.className = "match";
  div.id = `match-${matchIndex}`;
  
  // Restore expanded state if it was expanded before
  if (expandedMatches.has(matchIndex)) {
    div.classList.add("expanded");
  }

  // Determine status
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

  // Check validity
  const valid = isValidMatchup(match);
  if (!valid && (match.playerIds[0] || match.playerIds[1])) {
    div.classList.add("invalid");
  }

  // Match Header
  const [p1, p2] = match.playerIds;
  const p1Name = p1 ? data.players[p1].name : "Not Selected";
  const p2Name = p2 ? data.players[p2].name : "Not Selected";

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

  // Match Details
  const details = `
    <div class="match-details">
      ${!valid && (p1 || p2) ? '<div class="error-message">⚠️ Invalid matchup: Both players are from the same team. Choose opponents from different teams.</div>' : ''}
      
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
          ❌ Clear Scores
        </button>
      </div>
    </div>
  `;

  div.innerHTML = header + details;
  return div;
}

/*************************
 * TEAM SELECT
 *************************/
function buildTeamSelect(match, playerIndex, matchIndex, team) {
  const selectId = `player-${matchIndex}-${playerIndex}`;
  let html = `<select id="${selectId}" onchange="updatePlayer(${matchIndex}, ${playerIndex}, this.value, '${team}')">`;
  html += '<option value="">-- Select Player --</option>';

  // Show ALL players, sorted by rank
  const sortedPlayers = Object.entries(data.players).sort((a, b) => a[1].rank - b[1].rank);
  
  sortedPlayers.forEach(([id, p]) => {
    const selected = match.playerIds[playerIndex] === id ? 'selected' : '';
    const teamLabel = p.team !== 'TBD' ? ` [${p.team === 'brock' ? 'Team Brock' : 'Team Jared'}]` : '';
    html += `<option value="${id}" ${selected}>${p.name} (${p.pops} pops)${teamLabel}</option>`;
  });

  html += '</select>';
  return html;
}

/*************************
 * SCORE SELECT
 *************************/
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

/*************************
 * VALIDATION
 *************************/
function isValidMatchup(match) {
  const [p1, p2] = match.playerIds;
  if (!p1 || !p2) return false;
  return data.players[p1].team !== data.players[p2].team;
}

/*************************
 * UPDATE FUNCTIONS
 *************************/
function updatePlayer(matchIndex, playerIndex, playerId, team) {
  data.matches[matchIndex].playerIds[playerIndex] = playerId || null;
  
  // Auto-assign team when player is selected
  if (playerId && data.players[playerId]) {
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

/*************************
 * TOGGLE MATCH
 *************************/
function toggleMatch(index) {
  const match = document.getElementById(`match-${index}`);
  match.classList.toggle("expanded");
  
  // Track expanded state
  if (match.classList.contains("expanded")) {
    expandedMatches.add(index);
  } else {
    expandedMatches.delete(index);
  }
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

// Warn on page exit
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/*************************
 * SAVE TO GITHUB
 *************************/
function saveToGitHub() {
  const token = prompt("GitHub Personal Access Token:");
  if (!token) return;

  const saveBtn = document.querySelector('.btn-primary');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "💾 Saving...";
  saveBtn.disabled = true;

  data.meta.lastUpdated = new Date().toISOString();

  // Step 1: Get current file SHA
  fetch("https://api.github.com/repos/rbelaire/swclassic/contents/data.json", {
    headers: {
      Authorization: `token ${token}`
    }
  })
    .then(res => res.json())
    .then(file => {
      const sha = file.sha;

      // Step 2: Update file
      return fetch("https://api.github.com/repos/rbelaire/swclassic/contents/data.json", {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update tournament scores",
          content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
          sha: sha
        })
      });
    })
    .then(res => res.json())
    .then(resp => {
      if (resp.content) {
        markSaved();
        alert("✅ Scores saved successfully!\n\nThe leaderboard will update automatically within 30 seconds.");
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      } else {
        throw new Error("Save failed");
      }
    })
    .catch(err => {
      console.error(err);
      alert("❌ Save failed. Check your token and try again.");
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
}
