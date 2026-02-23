/*************************
 * DRAFT BOARD
 * Auto-refreshes every 10 seconds
 *************************/

const REFRESH_INTERVAL = 10000; // 10 seconds for draft night
let autoRefreshEnabled = true;
let lastUpdateTime = Date.now();
let refreshTimer = null;
const FINAL_DRAFT_ORDER = [
  "brock",
  "jared",
  "jared",
  "brock",
  "jared",
  "jared",
  "brock",
  "brock",
  "brock",
  "jared"
];

const TEAM_PICK_SLOTS = {
  brock: FINAL_DRAFT_ORDER.map((team, index) => ({ pick: index + 1, team })).filter(slot => slot.team === "brock"),
  jared: FINAL_DRAFT_ORDER.map((team, index) => ({ pick: index + 1, team })).filter(slot => slot.team === "jared")
};

/*************************
 * LOAD DATA
 *************************/
let data;
const DATA_CACHE_KEY = "classicDraftData_v3";

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
      showError('Failed to load data. Retrying...');
      setTimeout(loadData, 5000);
    });
}

// Cross-tab sync
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
    console.warn("Unable to read updated draft data.", error);
  }
});

/*************************
 * RENDER
 *************************/
function render() {
  const players = Object.values(data.players);

  const coaches = players.filter(p => p.team === "coach");
  const teamBrock = players.filter(p => p.team === "brock").sort((a, b) => a.rank - b.rank);
  const teamJared = players.filter(p => p.team === "jared").sort((a, b) => a.rank - b.rank);
  const undrafted = players.filter(p => !p.team || p.team === null).sort((a, b) => a.rank - b.rank);

  const totalDraftable = players.filter(p => p.team !== "coach").length;
  const totalDrafted = teamBrock.length + teamJared.length;

  renderStatus(totalDrafted, totalDraftable);
  renderTeam("brock", teamBrock, TEAM_PICK_SLOTS.brock);
  renderTeam("jared", teamJared, TEAM_PICK_SLOTS.jared);
  renderPool(undrafted);
}

function renderStatus(drafted, total) {
  const el = document.getElementById("draft-status");
  if (!el) return;

  if (drafted === 0) {
    el.className = "draft-status draft-status--waiting";
    el.textContent = "Draft has not started";
  } else if (drafted < total) {
    el.className = "draft-status draft-status--live";
    el.textContent = `Draft in progress \u2014 ${drafted} of ${total} picked`;
  } else {
    el.className = "draft-status draft-status--complete";
    el.textContent = "Draft Complete";
  }
}


function renderTeam(team, players, slots) {
  const el = document.getElementById(`team-${team}-slots`);
  if (!el) return;

  let html = "";
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const p = players[i];
    const owner = slot.team === "brock" ? "Brock" : "Jared";
    if (p) {
      html += `
        <div class="draft-slot draft-slot--filled" style="animation-delay: ${i * 0.08}s">
          <div class="draft-slot__placeholder">Pick ${slot.pick} — ${owner}</div>
          <div class="draft-slot__rank">#${p.rank}</div>
          <div class="draft-slot__name">${p.name}</div>
          <div class="draft-slot__pops">${p.pops} pops</div>
        </div>`;
    } else {
      html += `
        <div class="draft-slot draft-slot--empty">
          <div class="draft-slot__placeholder">Pick ${slot.pick} — ${owner}</div>
        </div>`;
    }
  }
  el.innerHTML = html;
}

function renderPool(undrafted) {
  const section = document.getElementById("pool-section");
  const grid = document.getElementById("pool-grid");
  if (!section || !grid) return;

  if (undrafted.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "";

  grid.innerHTML = undrafted.map(p => `
    <div class="player-card" style="animation-delay: ${undrafted.indexOf(p) * 0.05}s">
      <div class="rank-badge">${p.rank}</div>
      <div class="player-name">${p.name}</div>
      <div class="player-stats">
        <div class="stat">
          <div class="stat-label">Pops</div>
          <div class="stat-value">${p.pops}</div>
        </div>
      </div>
    </div>
  `).join("");
}

/*************************
 * AUTO-REFRESH CONTROLS
 *************************/
function updateRefreshIndicator() {
  const indicator = document.getElementById("refresh-indicator");
  if (!indicator) return;

  const secondsAgo = Math.floor((Date.now() - lastUpdateTime) / 1000);
  const statusText = autoRefreshEnabled ? "Auto-refresh ON" : "Auto-refresh OFF";

  if (secondsAgo < 60) {
    indicator.textContent = `${statusText} \u2022 Updated ${secondsAgo}s ago`;
  } else {
    const minutesAgo = Math.floor(secondsAgo / 60);
    indicator.textContent = `${statusText} \u2022 Updated ${minutesAgo}m ago`;
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    if (autoRefreshEnabled) {
      console.log('Auto-refreshing draft board...');
      loadData();
    }
  }, REFRESH_INTERVAL);

  setInterval(updateRefreshIndicator, 1000);
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  const btn = document.getElementById("toggle-refresh-btn");
  if (btn) {
    btn.textContent = autoRefreshEnabled ? "\u23F8 Pause Updates" : "\u25B6 Resume Updates";
    btn.style.background = autoRefreshEnabled ? "var(--color-primary)" : "#666";
  }
  updateRefreshIndicator();
}

function manualRefresh() {
  const btn = document.getElementById("manual-refresh-btn");
  if (btn) {
    btn.textContent = "\u27F3 Refreshing...";
    btn.disabled = true;
  }

  loadData();

  setTimeout(() => {
    if (btn) {
      btn.textContent = "\u27F3 Refresh Now";
      btn.disabled = false;
    }
  }, 1000);
}

function showError(message) {
  const indicator = document.getElementById("refresh-indicator");
  if (indicator) {
    indicator.textContent = `\u26A0\uFE0F ${message}`;
    indicator.style.color = "#c62828";
    setTimeout(() => {
      indicator.style.color = "";
      updateRefreshIndicator();
    }, 3000);
  }
}

/*************************
 * INITIALIZATION
 *************************/
loadData();
startAutoRefresh();
