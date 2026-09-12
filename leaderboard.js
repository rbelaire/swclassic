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
  const sub = document.getElementById("event-subtitle");
  if (sub && data.meta && data.meta.eventName) sub.textContent = data.meta.eventName;
  renderTotals(data);
  renderTimeline(data);
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
  const T = ClassicTeams(data);

  const gName = document.getElementById("team-green-name");
  const rName = document.getElementById("team-red-name");
  if (gName) gName.textContent = T.green.short;            // RED
  if (rName) rName.textContent = T.red.short;              // BLUE
  const gCapt = document.getElementById("team-green-capt");
  const rCapt = document.getElementById("team-red-capt");
  if (gCapt) gCapt.textContent = T.green.captain || "";    // Gavin
  if (rCapt) rCapt.textContent = T.red.captain || "";      // Bel

  document.getElementById("team-green-score").textContent =
    (totals.green || 0).toFixed(1);
  document.getElementById("team-red-score").textContent =
    (totals.red || 0).toFixed(1);

  const greenEl = document.getElementById("team-green");
  const redEl = document.getElementById("team-red");

  greenEl.classList.remove("winning");
  redEl.classList.remove("winning");

  if (totals.green > totals.red) greenEl.classList.add("winning");
  if (totals.red > totals.green) redEl.classList.add("winning");
}

function calculateTotals(data) {
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
  const safe = escapeHTML(name || "TBD");
  const slug = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  // Undrafted/placeholder slots have no photo — show the label, skip the image.
  if (!slug || slug === "tbd") return `<span class="player-name">${safe}</span>`;
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

  const T = ClassicTeams(data);
  const [p1, p2] = match.playerIds;
  const p1team = p1 ? T.sideOf(data.players[p1]) : null;
  const p2team = p2 ? T.sideOf(data.players[p2]) : null;
  const p1name = p1 ? data.players[p1].name : "TBD";
  const p2name = p2 ? data.players[p2].name : "TBD";
  const teamColor = (team) => T.color(team);

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
    const color = leaderIsP1 ? teamColor(p1team) : teamColor(p2team);
    statusStyle = `color:${color};`;
    const closed = margin > st.remaining && st.remaining >= 0 && st.played > 0;
    const label = (st.remaining === 0 || closed) && margin > 0
      ? `${margin} UP`   // final margin
      : `${margin} UP`;
    statusText = leaderIsP1 ? `◂ ${label}` : `${label} ▸`;
  }
  // A nine is settled once its lead exceeds the holes left in it (clinched)
  // or all 9 are played; a match is Final when closed out or both nines settle.
  const holesObj = (match.points && match.points.holes) || {};
  const nineSettled = (a, b) => {
    let w1 = 0, w2 = 0, pl = 0;
    for (let h = a; h <= b; h++) {
      const v = holesObj[h];
      if (v === 1) { w1++; pl++; } else if (v === 0) { w2++; pl++; } else if (v === 0.5) { pl++; }
    }
    const rem = (b - a + 1) - pl;
    return pl > 0 && (Math.abs(w1 - w2) > rem || pl === (b - a + 1));
  };
  const isFinal = !!match.closed || (nineSettled(1, 9) && nineSettled(10, 18));
  const thru = st.played === 0 ? "Not started"
    : isFinal ? "Final"
    : `${st.played}/18`;

  div.innerHTML = `
    <div class="matchup-row">
      <div class="matchup-player matchup-player--left">
        ${playerAvatar(p1name)}
      </div>
      <div class="matchup-center">
        <div class="${statusClass}" style="${statusStyle}">${statusText}</div>
        <div class="matchup-scores">
          ${buildNineInline("F9", match.points.front9, teamColor(p1team), teamColor(p2team))}
          ${buildNineInline("B9", match.points.back9, teamColor(p1team), teamColor(p2team))}
        </div>
        <div class="mp-thru">${thru}</div>
      </div>
      <div class="matchup-player matchup-player--right">
        ${playerAvatar(p2name)}
      </div>
    </div>
  `;
  if (p1team) div.style.borderLeft = `4px solid ${teamColor(p1team)}`;
  if (p2team) div.style.borderRight = `4px solid ${teamColor(p2team)}`;
  return div;
}

// Shows the point earned on a nine from the WINNER's side: a decided nine is
// worth 1 point, shown as "1" in the winning team's color (gold/green) whether
// the left or right player won — so the box always reflects the point, matching
// the team total. A tie is a half point; an undecided nine shows "-".
function buildNineInline(label, val, c1, c2) {
  if (val === null || val === undefined) {
    return `<div class="nine-score"><div class="nine-label">${label}</div><div class="nine-result">-</div></div>`;
  }
  if (val === 0.5) {
    return `<div class="nine-score tied"><div class="nine-label">${label}</div><div class="nine-result">½</div></div>`;
  }
  const color = val === 1 ? c1 : c2; // 1 = left player won, 0 = right player won
  return `<div class="nine-score" style="border-color:${color}; background:${color}1f;"><div class="nine-label">${label}</div><div class="nine-result" style="color:${color}">1</div></div>`;
}

/* ======================
   SCORE TIMELINE
   - Live snapshot line: team totals over the day (from meta.scoreLog)
   - Hole-by-hole momentum: cumulative holes-won differential 1..18
   ====================== */
function renderTimeline(data) {
  const wrap = document.getElementById("score-timeline");
  if (!wrap) return;
  const T = ClassicTeams(data);
  const log = (data.meta && Array.isArray(data.meta.scoreLog)) ? data.meta.scoreLog : [];
  const momentum = computeMomentum(data);
  const anyHoles = momentum.some(m => m.played);

  if (!anyHoles && log.length === 0) { wrap.style.display = "none"; wrap.innerHTML = ""; return; }
  wrap.style.display = "";

  let html = `<div class="section-header"><h2>How It's Unfolding</h2></div>`;
  html += `<div class="timeline-grid">`;
  html += `<div class="tl-card">
      <div class="tl-title">Team Score Over Time</div>
      <div class="tl-sub"><b class="g">${escapeHTML(T.green.name)}</b> vs <b class="r">${escapeHTML(T.red.name)}</b> &middot; running points</div>
      ${log.length ? snapshotChartSVG(log, T) : '<div class="tl-empty">No saved scores yet.</div>'}
    </div>`;
  html += `<div class="tl-card">
      <div class="tl-title">Hole-by-Hole Momentum</div>
      <div class="tl-sub"><b class="g">${escapeHTML(T.green.name)}</b> up top, <b class="r">${escapeHTML(T.red.name)}</b> below &middot; holes won</div>
      ${anyHoles ? momentumChartSVG(momentum, T) : '<div class="tl-empty">No holes scored yet.</div>'}
    </div>`;
  html += `</div>`;
  wrap.innerHTML = html;
}

function computeMomentum(data) {
  const out = [];
  let cum = 0;
  for (let h = 1; h <= 18; h++) {
    let played = false;
    data.matches.forEach(match => {
      const [p1, p2] = match.playerIds;
      if (!p1 || !p2) return;
      const holes = (match.points && match.points.holes) || {};
      const v = holes[h];
      if (v === 1 || v === 0 || v === 0.5) played = true;
      const t1 = data.players[p1] ? data.players[p1].team : null;
      if (t1 !== 'green' && t1 !== 'red') return;
      const greenIsP1 = t1 === 'green';
      if (v === 1) cum += greenIsP1 ? 1 : -1;
      else if (v === 0) cum += greenIsP1 ? -1 : 1;
    });
    out.push({ hole: h, diff: cum, played });
  }
  return out;
}

function snapshotChartSVG(log, T) {
  const W = 320, H = 150, L = 22, Tp = 12, R = 10, B = 22;
  const iw = W - L - R, ih = H - Tp - B;
  const pts = [{ g: 0, r: 0, t: null }].concat(log.map(e => ({ g: +e.g || 0, r: +e.r || 0, t: e.t })));
  const n = pts.length;
  const maxY = Math.max(1, ...pts.map(p => Math.max(p.g, p.r)));
  const x = i => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => Tp + ih - (v / maxY) * ih;
  const line = key => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const step = Math.ceil(maxY / 4) || 1;
  let grid = '';
  for (let v = 0; v <= maxY; v += step) {
    grid += `<line class="tl-grid-line" x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}"/>`
      + `<text class="tl-axis" x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }
  const fmtT = iso => { if (!iso) return 'Start'; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const gc = T.green.color, rc = T.red.color;
  const dot = (i, key, c) => `<circle cx="${x(i).toFixed(1)}" cy="${y(pts[i][key]).toFixed(1)}" r="3.2" fill="${c}"/>`;
  return `<svg class="tl-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Team score over time">
    ${grid}
    <path d="${line('g')}" fill="none" stroke="${gc}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${line('r')}" fill="none" stroke="${rc}" stroke-width="2.5" stroke-linejoin="round"/>
    ${dot(n - 1, 'g', gc)}${dot(n - 1, 'r', rc)}
    <text class="tl-axis" x="${L}" y="${H - 6}" text-anchor="start">${escapeHTML(fmtT(pts[1] && pts[1].t))}</text>
    <text class="tl-axis" x="${W - R}" y="${H - 6}" text-anchor="end">${escapeHTML(fmtT(pts[n - 1] && pts[n - 1].t))}</text>
  </svg>`;
}

function momentumChartSVG(momentum, T) {
  const W = 320, H = 150, L = 20, Tp = 14, R = 10, B = 20;
  const iw = W - L - R, ih = H - Tp - B;
  let last = -1; momentum.forEach((m, i) => { if (m.played) last = i; });
  const series = [{ x: 0, v: 0 }];
  for (let i = 0; i <= last; i++) series.push({ x: i + 1, v: momentum[i].diff });
  const maxAbs = Math.max(1, ...series.map(s => Math.abs(s.v)));
  const x = h => L + (h / 18) * iw;
  const zeroY = Tp + ih / 2;
  const y = v => zeroY - (v / maxAbs) * (ih / 2);
  const gc = T.green.color, rc = T.red.color;
  const areaPath = sign => {
    let d = `M${x(series[0].x).toFixed(1)},${zeroY.toFixed(1)}`;
    series.forEach(s => {
      const vv = sign > 0 ? Math.max(s.v, 0) : Math.min(s.v, 0);
      d += ` L${x(s.x).toFixed(1)},${y(vv).toFixed(1)}`;
    });
    d += ` L${x(series[series.length - 1].x).toFixed(1)},${zeroY.toFixed(1)} Z`;
    return d;
  };
  const linePath = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.x).toFixed(1)},${y(s.v).toFixed(1)}`).join(' ');
  let xl = '';
  [1, 9, 18].forEach(h => { xl += `<text class="tl-axis" x="${x(h).toFixed(1)}" y="${H - 5}" text-anchor="middle">${h}</text>`; });
  const finalDiff = series[series.length - 1].v;
  const leadName = finalDiff > 0 ? T.green.name : finalDiff < 0 ? T.red.name : '';
  const leadTxt = finalDiff === 0 ? 'All square' : `${Math.abs(finalDiff)} up &middot; ${escapeHTML(leadName)}`;
  const endC = finalDiff >= 0 ? gc : rc;
  return `<svg class="tl-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hole-by-hole momentum">
    <path d="${areaPath(1)}" fill="${gc}" fill-opacity="0.15"/>
    <path d="${areaPath(-1)}" fill="${rc}" fill-opacity="0.15"/>
    <line class="tl-grid-line" x1="${L}" y1="${zeroY.toFixed(1)}" x2="${W - R}" y2="${zeroY.toFixed(1)}"/>
    <path d="${linePath}" fill="none" stroke="${endC}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${x(series[series.length - 1].x).toFixed(1)}" cy="${y(finalDiff).toFixed(1)}" r="3.4" fill="${endC}"/>
    ${xl}
    <text class="tl-axis" x="${W - R}" y="${Tp - 2}" text-anchor="end" style="font-weight:800; fill:${endC};">${leadTxt}</text>
  </svg>`;
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
