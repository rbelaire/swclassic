fetch("./data.json")
  .then(res => res.json())
  .then(data => {
    renderTotals(data);
    renderMatches(data);
    renderStats(data);
    renderLastUpdated(data);
  });

/* ======================
   TEAM TOTALS
   ====================== */

function renderTotals(data) {
  const totals = calculateTotals(data);

  const brock = totals.brock || 0;
  const jared = totals.jared || 0;

  document.getElementById("team-brock-score").textContent = brock.toFixed(1);
  document.getElementById("team-jared-score").textContent = jared.toFixed(1);

  const cards = document.querySelectorAll(".team-card");
  cards.forEach(c => c.classList.remove("winning"));

  if (brock > jared) cards[0].classList.add("winning");
  if (jared > brock) cards[1].classList.add("winning");
}

function calculateTotals(data) {
  const totals = { brock: 0, jared: 0 };

  data.matches.forEach(m => {
    const [p1, p2] = m.playerIds;
    if (!p1 || !p2) return;

    const t1 = data.players[p1].team;
    const t2 = data.players[p2].team;

    ["front9", "back9"].forEach(k => {
      const v = m.points[k];
      if (v === null) return;
      totals[t1] += v;
      totals[t2] += 1 - v;
    });
  });

  return totals;
}

/* ======================
   MATCH CARDS
   ====================== */

function renderMatches(data) {
  const grid = document.getElementById("matches-grid");
  grid.innerHTML = "";

  const rounds = groupByRound(data.matches);

  Object.entries(rounds).forEach(([round, matches]) => {
    const card = document.createElement("div");
    card.className = "match-card";

    const h3 = document.createElement("h3");
    h3.textContent = `Foursome ${round}`;
    card.appendChild(h3);

    matches.forEach(m => {
      card.appendChild(buildMatchup(m, data));
    });

    grid.appendChild(card);
  });
}

function buildMatchup(match, data) {
  const div = document.createElement("div");
  div.className = "matchup";

  const header = document.createElement("div");
  header.className = "matchup-header";

  const [p1, p2] = match.playerIds;

  const p1Name = p1 ? `${data.players[p1].name} (${data.players[p1].team})` : "TBD";
  const p2Name = p2 ? `${data.players[p2].name} (${data.players[p2].team})` : "TBD";

  const left = document.createElement("span");
  left.className = "player-name";
  left.textContent = p1Name;

  const vs = document.createElement("span");
  vs.textContent = "VS";
  vs.style.fontSize = "1.5em";

  const right = document.createElement("span");
  right.className = "player-name";
  right.textContent = p2Name;

  header.append(left, vs, right);

  const scoreDisplay = document.createElement("div");
  scoreDisplay.className = "score-display";
  scoreDisplay.append(
    buildNine("Front 9", match.points.front9, p1, data),
    buildNine("Back 9", match.points.back9, p1, data)
  );

  const status = document.createElement("div");
  status.className = "match-status";
  status.textContent = formatStatus(match);

  div.append(header, scoreDisplay, status);
  return div;
}

function buildNine(label, val, p1, data) {
  const div = document.createElement("div");
  div.className = "nine-score";

  if (val === 1) div.classList.add("won");
  if (val === 0.5) div.classList.add("tied");

  div.innerHTML = `
    <div class="nine-label">${label}</div>
    <div class="nine-result">${val === null ? "-" : val}</div>
  `;
  return div;
}

/* ======================
   STATS + META
   ====================== */

function renderStats(data) {
  let complete = 0, progress = 0, notStarted = 0, points = 0;

  data.matches.forEach(m => {
    if (m.status === "complete") complete++;
    else if (m.status === "in_progress") progress++;
    else notStarted++;

    ["front9", "back9"].forEach(k => {
      if (m.points[k] !== null) points++;
    });
  });

  document.getElementById("stat-complete").textContent = complete;
  document.getElementById("stat-progress").textContent = progress;
  document.getElementById("stat-not-started").textContent = notStarted;
  document.getElementById("stat-points").textContent = points.toFixed(1);
}

function renderLastUpdated(data) {
  const d = new Date(data.meta.lastUpdated);
  document.getElementById("last-updated").textContent =
    `Last updated: ${d.toLocaleString()}`;
}

/* ======================
   HELPERS
   ====================== */

function groupByRound(matches) {
  return matches.reduce((acc, m) => {
    acc[m.round] = acc[m.round] || [];
    acc[m.round].push(m);
    return acc;
  }, {});
}

function formatStatus(match) {
  if (match.status === "complete") return "Final";
  if (match.status === "in_progress") return "On Course";
  return "Not Started";
}
