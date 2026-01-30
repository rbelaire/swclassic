/*************************
 * AUTO-REFRESH LEADERBOARD
 * Updates every 30 seconds
 *************************/

// Configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
let autoRefreshEnabled = true;
let lastUpdateTime = Date.now();
let refreshTimer = null;

// Scorecard Data - Handicap rankings per hole
const SCORECARD = {
  front9: [
    { hole: 1, par: 5, handicap: 5, yardage: { black: 548, yellow: 530, silver: 513 } },
    { hole: 2, par: 4, handicap: 9, yardage: { black: 388, yellow: 360, silver: 333 } },
    { hole: 3, par: 3, handicap: 13, yardage: { black: 174, yellow: 150, silver: 132 } },
    { hole: 4, par: 5, handicap: 15, yardage: { black: 530, yellow: 524, silver: 491 } },
    { hole: 5, par: 4, handicap: 1, yardage: { black: 463, yellow: 441, silver: 419 } },
    { hole: 6, par: 4, handicap: 7, yardage: { black: 369, yellow: 345, silver: 319 } },
    { hole: 7, par: 3, handicap: 11, yardage: { black: 196, yellow: 166, silver: 165 } },
    { hole: 8, par: 4, handicap: 17, yardage: { black: 379, yellow: 345, silver: 302 } },
    { hole: 9, par: 4, handicap: 3, yardage: { black: 435, yellow: 411, silver: 385 } }
  ],
  back9: [
    { hole: 10, par: 4, handicap: 18, yardage: { black: 353, yellow: 324, silver: 311 } },
    { hole: 11, par: 5, handicap: 14, yardage: { black: 506, yellow: 482, silver: 450 } },
    { hole: 12, par: 4, handicap: 16, yardage: { black: 367, yellow: 341, silver: 316 } },
    { hole: 13, par: 3, handicap: 4, yardage: { black: 185, yellow: 153, silver: 147 } },
    { hole: 14, par: 4, handicap: 12, yardage: { black: 376, yellow: 353, silver: 330 } },
    { hole: 15, par: 4, handicap: 6, yardage: { black: 385, yellow: 365, silver: 332 } },
    { hole: 16, par: 4, handicap: 2, yardage: { black: 450, yellow: 411, silver: 380 } },
    { hole: 17, par: 3, handicap: 8, yardage: { black: 227, yellow: 211, silver: 182 } },
    { hole: 18, par: 5, handicap: 10, yardage: { black: 584, yellow: 560, silver: 530 } }
  ]
};

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicLeaderboardData";

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
  
  // Add cache-busting parameter to ensure fresh data
  fetch(`./data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(json => {
      if (!data || isNewerData(json, data)) {
        data = json;
        saveCachedData(json);
        render();
      }
      lastUpdateTime = Date.now();
           updateRefreshIndicator();
    })
    .catch(error => {
      console.error('Error loading data:', error);
      showError('Failed to load latest scores. Retrying...');
      // Retry after 5 seconds on error
      setTimeout(loadData, 5000);
    });
}
window.addEventListener("storage", event => {
  if (event.key !== DATA_CACHE_KEY || !event.newValue) return;
  try {
    const nextData = JSON.parse(event.newValue);
    if (!data || isNewerData(nextData, data)) {
      data = nextData;
      render();
      updateRefreshIndicator();
    }
  } catch (error) {
    console.warn("Unable to read updated leaderboard data.", error);
  }
});

/*************************
 * RENDER
 *************************/
function render() {
  renderTotals(data);
  renderMatches(data);
  renderLastUpdated(data);
  
  // Add fade-in animation
  const container = document.getElementById("matches-grid");
  container.style.opacity = "0";
  setTimeout(() => {
    container.style.opacity = "1";
  }, 100);
}

/* ======================
   TOTALS
   ====================== */

function renderTotals(data) {
  const totals = calculateTotals(data);

  document.getElementById("team-brock-score").textContent =
    (totals.brock || 0).toFixed(1);

  document.getElementById("team-jared-score").textContent =
    (totals.jared || 0).toFixed(1);

  const brockCard = document.getElementById("team-brock");
  const jaredCard = document.getElementById("team-jared");

  brockCard.classList.remove("winning");
  jaredCard.classList.remove("winning");

  if (totals.brock > totals.jared) brockCard.classList.add("winning");
  if (totals.jared > totals.brock) jaredCard.classList.add("winning");
}

function calculateTotals(data) {
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

/* ======================
   MATCHES → FOURSOMES
   ====================== */

function renderMatches(data) {
  const grid = document.getElementById("matches-grid");
  grid.innerHTML = "";

  const foursomes = chunk(data.matches, 2);

  foursomes.forEach((group, index) => {
    const wrapper = document.createElement("section");
    wrapper.className = "foursome";
    wrapper.setAttribute("aria-label", `Foursome ${index + 1}`);

    const header = document.createElement("header");
    header.className = "foursome-header";
    const title = document.createElement("h3");
    title.className = "foursome-title";
    title.textContent = `Foursome ${index + 1}`;

    const status = document.createElement("span");
    const statusData = getFoursomeStatus(group);
    status.className = `foursome-status ${statusData.className}`;
    status.textContent = statusData.label;

    header.append(title, status);

    wrapper.appendChild(header);

    group.forEach(match => {
      wrapper.appendChild(buildMatch(match, data));
    });

    grid.appendChild(wrapper);
  });
}

function buildMatch(match, data) {
  const div = document.createElement("article");
  div.className = "matchup";
  div.style.cursor = "pointer";
  div.onclick = () => showMatchupModal(match, data);

  const header = document.createElement("header");
  header.className = "matchup-header";

  const [p1, p2] = match.playerIds;

  const names = document.createElement("div");
  names.className = "matchup-names";

  const left = document.createElement("span");
  left.className = "player-name";
  left.textContent = p1 ? data.players[p1].name : "TBD";

  const vs = document.createElement("span");
  vs.className = "matchup-vs";
  vs.textContent = "vs";

  const right = document.createElement("span");
  right.className = "player-name";
  right.textContent = p2 ? data.players[p2].name : "TBD";

  names.append(left, vs, right);
  header.append(names);

  const scores = document.createElement("div");
  scores.className = "score-display";
  scores.setAttribute("role", "group");
  scores.setAttribute("aria-label", "Front 9 and Back 9 scores");
  scores.append(
    buildNine("Front 9", match.points.front9),
    buildNine("Back 9", match.points.back9)
  );

    div.append(header, scores);
  return div;
}

function buildNine(label, val) {
  const div = document.createElement("div");
  div.className = "nine-score";

  if (val === 1) div.classList.add("won");
  if (val === 0.5) div.classList.add("tied");
  if (val === 0) div.classList.add("lost");

  div.innerHTML = `
    <div class="nine-label">${label}</div>
    <div class="nine-result">${val === null ? "-" : val}</div>
  `;
  return div;
}

/* ======================
   META
   ====================== */

function renderLastUpdated(data) {
  const d = new Date(data.meta.lastUpdated);
  document.getElementById("last-updated").textContent =
    `Last updated: ${d.toLocaleString()}`;
}

function getFoursomeStatus(group) {
  const hasPlayers = group.every(match => match.playerIds?.every(Boolean));
  if (!hasPlayers) {
    return { label: "Not Started", className: "foursome-status--not-started" };
  }

  const front9Complete = group.every(match => match.points.front9 !== null);
  const back9Complete = group.every(match => match.points.back9 !== null);

  if (front9Complete && back9Complete) {
    return { label: "Complete", className: "foursome-status--complete" };
  }
  if (front9Complete) {
    return { label: "In Progress", className: "foursome-status--in-progress" };
  }
  return { label: "Not Started", className: "foursome-status--not-started" };
}

/* ======================
   AUTO-REFRESH CONTROLS
   ====================== */

function updateRefreshIndicator() {
  const indicator = document.getElementById("refresh-indicator");
  if (!indicator) return;
  
  const secondsAgo = Math.floor((Date.now() - lastUpdateTime) / 1000);
  const statusText = autoRefreshEnabled ? "Auto-refresh ON" : "Auto-refresh OFF";
  
  if (secondsAgo < 60) {
    indicator.textContent = `${statusText} • Updated ${secondsAgo}s ago`;
  } else {
    const minutesAgo = Math.floor(secondsAgo / 60);
    indicator.textContent = `${statusText} • Updated ${minutesAgo}m ago`;
  }
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    if (autoRefreshEnabled) {
      console.log('Auto-refreshing leaderboard...');
      loadData();
    }
  }, REFRESH_INTERVAL);
  
  // Update the "X seconds ago" indicator every second
  setInterval(updateRefreshIndicator, 1000);
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  const btn = document.getElementById("toggle-refresh-btn");
  if (btn) {
    btn.textContent = autoRefreshEnabled ? "⏸ Pause Updates" : "▶ Resume Updates";
    btn.style.background = autoRefreshEnabled ? "var(--color-primary)" : "#666";
  }
  updateRefreshIndicator();
}

function manualRefresh() {
  const btn = document.getElementById("manual-refresh-btn");
  if (btn) {
    btn.textContent = "⟳ Refreshing...";
    btn.disabled = true;
  }
  
  loadData();
  
  setTimeout(() => {
    if (btn) {
      btn.textContent = "⟳ Refresh Now";
      btn.disabled = false;
    }
  }, 1000);
}

function showError(message) {
  const indicator = document.getElementById("refresh-indicator");
  if (indicator) {
    indicator.textContent = `⚠️ ${message}`;
    indicator.style.color = "#c62828";
    
    setTimeout(() => {
      indicator.style.color = "";
      updateRefreshIndicator();
    }, 3000);
  }
}

/* ======================
   HELPERS
   ====================== */

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/* ======================
   MATCHUP MODAL
   ====================== */

function showMatchupModal(match, data) {
  const [p1Id, p2Id] = match.playerIds;
  
  // Don't show modal if players not selected yet
  if (!p1Id || !p2Id) {
    return;
  }
  
  const p1 = data.players[p1Id];
  const p2 = data.players[p2Id];
  
  // Calculate differential
  const popsDiff = Math.abs(p1.pops - p2.pops);
  const underdog = p1.pops > p2.pops ? p1 : p2;
  const favorite = p1.pops > p2.pops ? p2 : p1;
  
  // Get strokes per nine
  const strokeHoles = getStrokeHoles(popsDiff);
  const front9Strokes = strokeHoles.filter(h => h.hole <= 9);
  const back9Strokes = strokeHoles.filter(h => h.hole >= 10);
  
  // Build modal HTML
  const modalHTML = `
    <div class="modal-overlay" onclick="closeMatchupModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeMatchupModal()">✕</button>
        
        <div class="modal-header">
          <h2>Match ${match.id} Details</h2>
        </div>
        
        <div class="modal-body">
          <!-- Players -->
          <div class="modal-matchup">
            <div class="modal-player">
              <div class="modal-player-name">${p1.name}</div>
              <div class="modal-player-info">${p1.pops} pops • Team ${p1.team === 'brock' ? 'Brock' : 'Jared'}</div>
            </div>
            <div class="modal-vs">VS</div>
            <div class="modal-player">
              <div class="modal-player-name">${p2.name}</div>
              <div class="modal-player-info">${p2.pops} pops • Team ${p2.team === 'brock' ? 'Brock' : 'Jared'}</div>
            </div>
          </div>
          
          <!-- Handicap Advantage -->
          <div class="modal-section">
            <h3>📊 Handicap Advantage</h3>
            ${popsDiff === 0 
              ? `<p>Even match - no handicap strokes.</p>`
              : `<p><strong>${underdog.name}</strong> gets <strong>${popsDiff} stroke${popsDiff > 1 ? 's' : ''}</strong> on the hardest holes.</p>`
            }
          </div>
          
          ${popsDiff > 0 ? `
          <!-- Front 9 Breakdown -->
          <div class="modal-section">
            <h3>⛳ Front 9 Breakdown</h3>
            <p><strong>${underdog.name}</strong> gets <strong>${front9Strokes.length} stroke${front9Strokes.length !== 1 ? 's' : ''}</strong>:</p>
            <div class="hole-list">
              ${front9Strokes.map(h => `
                <div class="hole-item">
                  <span class="hole-number">Hole ${h.hole}</span>
                  <span class="hole-details">Par ${h.par} • ${h.yardage.black}yds • H${h.handicap}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Back 9 Breakdown -->
          <div class="modal-section">
            <h3>⛳ Back 9 Breakdown</h3>
            <p><strong>${underdog.name}</strong> gets <strong>${back9Strokes.length} stroke${back9Strokes.length !== 1 ? 's' : ''}</strong>:</p>
            <div class="hole-list">
              ${back9Strokes.map(h => `
                <div class="hole-item">
                  <span class="hole-number">Hole ${h.hole}</span>
                  <span class="hole-details">Par ${h.par} • ${h.yardage.black}yds • H${h.handicap}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- Current Score -->
          <div class="modal-section">
            <h3>📈 Current Score</h3>
            <div class="score-summary">
              <div class="score-row">
                <span>Front 9:</span>
                <span><strong>${match.points.front9 === null ? 'Not Started' : `${p1.name} ${match.points.front9} - ${1 - match.points.front9} ${p2.name}`}</strong></span>
              </div>
              <div class="score-row">
                <span>Back 9:</span>
                <span><strong>${match.points.back9 === null ? 'Not Started' : `${p1.name} ${match.points.back9} - ${1 - match.points.back9} ${p2.name}`}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  const modalDiv = document.createElement('div');
  modalDiv.id = 'matchup-modal';
  modalDiv.innerHTML = modalHTML;
  document.body.appendChild(modalDiv);
}

function closeMatchupModal() {
  const modal = document.getElementById('matchup-modal');
  if (modal) {
    modal.remove();
  }
}

function getStrokeHoles(numStrokes) {
  if (numStrokes === 0) return [];
  
  // Combine all holes and sort by handicap (1 = hardest)
  const allHoles = [...SCORECARD.front9, ...SCORECARD.back9];
  const sortedByDifficulty = allHoles.sort((a, b) => a.handicap - b.handicap);
  
  // Return the N hardest holes
  return sortedByDifficulty.slice(0, numStrokes);
}

/* ======================
   INITIALIZATION
   ====================== */

// Load data immediately on page load
loadData();

// Start auto-refresh
startAutoRefresh();

// Add smooth transitions
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById("matches-grid");
  if (grid) {
    grid.style.transition = "opacity 0.3s ease";
  }
});
