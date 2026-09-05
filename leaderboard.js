/*************************
 * AUTO-REFRESH LEADERBOARD
 * Updates every 30 seconds
 *************************/

// Configuration
const REFRESH_INTERVAL = 15000; // 15 seconds
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

// Prefer /api/data (reads GitHub directly, updates within seconds of a save);
// fall back to the statically served ./data.json if that endpoint is
// unavailable, so the leaderboard always loads.
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
    render();
  }

  fetchLiveData()
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

  const brockEl = document.getElementById("team-brock");
  const jaredEl = document.getElementById("team-jared");

  brockEl.classList.remove("winning");
  jaredEl.classList.remove("winning");

  if (totals.brock > totals.jared) brockEl.classList.add("winning");
  if (totals.jared > totals.brock) jaredEl.classList.add("winning");
}

function calculateTotals(data) {
  const totals = { brock: 0, jared: 0 };

  data.matches.forEach(match => {
    const [p1, p2] = match.playerIds;
    if (!p1 || !p2) return;

    const t1raw = data.players[p1].team;
    const t2raw = data.players[p2].team;
    const t1 = t1raw === 'coach' ? p1 : t1raw;
    const t2 = t2raw === 'coach' ? p2 : t2raw;

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

// Round headshot for a player. The name is kept as alt/title text for
// accessibility and hover. If the photo is missing, falls back to the name.
function playerAvatar(name) {
  const safe = escapeHTML(name || "");
  const slug = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!slug) return "";
  return `<img class="lb-avatar" src="images/players/${slug}.jpg" alt="${safe}" title="${safe}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'player-name',textContent:this.alt}))">`;
}

// Running match-play margin from the per-hole winners (1 = p1, 0 = p2, 0.5 tie).
function matchPlayStatus(match) {
  const holes = (match.points && match.points.holes) || {};
  let p1 = 0, p2 = 0, played = 0;
  for (let h = 1; h <= 18; h++) {
    const v = holes[h];
    if (v === 1) { p1++; played++; }
    else if (v === 0) { p2++; played++; }
    else if (v === 0.5) { played++; }
  }
  return { p1, p2, played, diff: p1 - p2, remaining: 18 - played };
}

function buildMatch(match, data) {
  const div = document.createElement("article");
  div.className = "matchup";
  div.style.cursor = "pointer";
  div.onclick = () => showMatchupModal(match, data);

  const [p1, p2] = match.playerIds;
  const p1team = p1 ? data.players[p1].team : null;
  const p2team = p2 ? data.players[p2].team : null;
  const p1name = p1 ? data.players[p1].name : "TBD";
  const p2name = p2 ? data.players[p2].name : "TBD";
  const teamColor = (team, id) => (team === "brock" || id === "brock") ? "#d4af37" : "#006747";

  // Match-play status shown in the center, leader indicated by an arrow + color.
  const st = matchPlayStatus(match);
  let statusText, statusStyle, statusClass = "mp-status";
  if (st.played === 0) {
    statusText = "—";
    statusClass += " mp-status--none";
    statusStyle = "";
  } else if (st.diff === 0) {
    statusText = "AS";
    statusClass += " mp-status--as";
    statusStyle = "";
  } else {
    const margin = Math.abs(st.diff);
    const leaderIsP1 = st.diff > 0;
    const color = leaderIsP1 ? teamColor(p1team, p1) : teamColor(p2team, p2);
    statusStyle = `color:${color};`;
    const closed = margin > st.remaining && st.remaining >= 0 && st.played > 0;
    const label = (st.remaining === 0 || closed) && margin > 0
      ? `${margin} UP`   // final margin
      : `${margin} UP`;
    statusText = leaderIsP1 ? `◂ ${label}` : `${label} ▸`;
  }
  const thru = st.played === 0 ? "Not started"
    : st.remaining === 0 ? "Final"
    : `${st.played}/18`;

  div.innerHTML = `
    <div class="matchup-row">
      <div class="matchup-player matchup-player--left">
        ${playerAvatar(p1name)}
      </div>
      <div class="matchup-center">
        <div class="${statusClass}" style="${statusStyle}">${statusText}</div>
        <div class="matchup-scores">
          ${buildNineInline("F9", match.points.front9)}
          ${buildNineInline("B9", match.points.back9)}
        </div>
        <div class="mp-thru">${thru}</div>
      </div>
      <div class="matchup-player matchup-player--right">
        ${playerAvatar(p2name)}
      </div>
    </div>
  `;
  if (p1team) div.style.borderLeft = `4px solid ${teamColor(p1team, p1)}`;
  if (p2team) div.style.borderRight = `4px solid ${teamColor(p2team, p2)}`;
  return div;
}

function buildNineInline(label, val) {
  let cls = "nine-score";
  if (val === 1) cls += " won";
  if (val === 0.5) cls += " tied";
  if (val === 0) cls += " lost";
  return `<div class="${cls}"><div class="nine-label">${label}</div><div class="nine-result">${val === null ? "-" : val}</div></div>`;
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
