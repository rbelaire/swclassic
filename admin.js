/*************************
 * ENHANCED ADMIN INTERFACE
 * The Classic 2026
 *************************/

const ADMIN_PASSWORD = "classic2026";
let hasUnsavedChanges = false;

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
  renderMatches();
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
 * MATCHES
 *************************/
function renderMatches() {
  const container = document.getElementById("matches");
  container.innerHTML = "";

  data.matches.forEach((match, index) => {
    const div = document.createElement("div");
    div.className = "match";
    div.id = `match-${index}`;

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
    if (!valid) {
      div.classList.add("invalid");
    }

    // Match Header (always visible)
    const [p1, p2] = match.playerIds;
    const p1Name = p1 ? data.players[p1].name : "TBD";
    const p2Name = p2 ? data.players[p2].name : "TBD";

    const header = `
      <div class="match-header" onclick="toggleMatch(${index})">
        <div class="match-title">Match ${match.id}</div>
        <div class="match-status-badge ${status}">${statusText}</div>
      </div>
      <div class="match-preview" onclick="toggleMatch(${index})">
        <div><strong>${p1Name}</strong> vs <strong>${p2Name}</strong></div>
        <div>
          F9: ${front === null ? "-" : front} | 
          B9: ${back === null ? "-" : back}
        </div>
      </div>
    `;

    // Match Details (collapsible)
    const details = `
      <div class="match-details">
        ${!valid ? '<div style="color: #c62828; font-weight: bold; margin-bottom: 15px;">⚠️ Invalid matchup: Players must be from different teams</div>' : ''}
        
        <div class="players-grid">
          <div class="player-select-wrap">
            <label>Player 1</label>
            ${buildPlayerSelect(match, 0, index)}
          </div>
          <div class="player-select-wrap">
            <label>Player 2</label>
            ${buildPlayerSelect(match, 1, index)}
          </div>
        </div>

        <div class="scores-grid">
          <div class="score-wrap">
            <label>Front 9 (Player 1)</label>
            ${buildScoreSelect(match, "front9", index, valid)}
          </div>
          <div class="score-wrap">
            <label>Back 9 (Player 1)</label>
            ${buildScoreSelect(match, "back9", index, valid)}
          </div>
        </div>

        <div class="match-actions">
          <button class="match-btn" onclick="swapPlayers(${index})">
            🔄 Swap Players
          </button>
          <button class="match-btn" onclick="clearMatch(${index})">
            ❌ Clear Scores
          </button>
        </div>
      </div>
    `;

    div.innerHTML = header + details;
    container.appendChild(div);
  });
}

/*************************
 * PLAYER SELECT
 *************************/
function buildPlayerSelect(match, index, matchIndex) {
  const selectId = `player-${matchIndex}-${index}`;
  let html = `<select id="${selectId}" onchange="updatePlayer(${matchIndex}, ${index}, this.value)">`;
  html += '<option value="">-- Select Player --</option>';

  Object.entries(data.players).forEach(([id, p]) => {
    const selected = match.playerIds[index] === id ? 'selected' : '';
    html += `<option value="${id}" ${selected}>${p.name} (${p.team})</option>`;
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
  
  let html = `<select id="${selectId}" onchange="updateScore(${matchIndex}, '${key}', this.value)" ${disabled}>`;
  html += '<option value="">-- Select Result --</option>';
  html += '<option value="1"' + (match.points[key] === 1 ? ' selected' : '') + '>Win (1.0)</option>';
  html += '<option value="0.5"' + (match.points[key] === 0.5 ? ' selected' : '') + '>Tie (0.5)</option>';
  html += '<option value="0"' + (match.points[key] === 0 ? ' selected' : '') + '>Loss (0.0)</option>';
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
function updatePlayer(matchIndex, playerIndex, playerId) {
  data.matches[matchIndex].playerIds[playerIndex] = playerId || null;
  data.matches[matchIndex].points.front9 = null;
  data.matches[matchIndex].points.back9 = null;
  markUnsaved();
  render();
}

function updateScore(matchIndex, key, value) {
  data.matches[matchIndex].points[key] = value === "" ? null : Number(value);
  markUnsaved();
  render();
}

function swapPlayers(matchIndex) {
  const match = data.matches[matchIndex];
  [match.playerIds[0], match.playerIds[1]] = [match.playerIds[1], match.playerIds[0]];
  match.points.front9 = null;
  match.points.back9 = null;
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
}

/*************************
 * QUICK ACTIONS
 *************************/
function markAllNotStarted() {
  if (!confirm("Reset all scores to Not Started?")) return;
  data.matches.forEach(m => {
    m.points.front9 = null;
    m.points.back9 = null;
  });
  markUnsaved();
  render();
}

function markAllInProgress() {
  if (!confirm("Mark all matches as In Progress (Front 9 only)?")) return;
  data.matches.forEach(m => {
    if (isValidMatchup(m)) {
      m.points.front9 = m.points.front9 === null ? 0 : m.points.front9;
    }
  });
  markUnsaved();
  render();
}

function expandAll() {
  document.querySelectorAll('.match').forEach(m => m.classList.add('expanded'));
}

function collapseAll() {
  document.querySelectorAll('.match').forEach(m => m.classList.remove('expanded'));
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
