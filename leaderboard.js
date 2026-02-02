/*************************
 * AUTO-REFRESH LEADERBOARD
 * Updates every 30 seconds
 *************************/

// Configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
let autoRefreshEnabled = true;
let lastUpdateTime = Date.now();
let refreshTimer = null;

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
  renderDataStatus(data);
  
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

function renderDataStatus(data) {
  const status = document.getElementById("data-status");
  if (!status) return;

  status.classList.remove("data-status--warning");
  const lastUpdated = data?.meta?.lastUpdated;
  if (lastUpdated) {
    const timestamp = new Date(lastUpdated).toLocaleString();
    status.textContent = `Live from GitHub — Last saved at ${timestamp}`;
  } else {
    status.textContent = "Live from GitHub — Last saved time unavailable";
  }
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
