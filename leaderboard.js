fetch("./data.json")
  .then(res => res.json())
  .then(data => {
    renderTotals(data);
    renderMatches(data);
    renderLastUpdated(data);
  });

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
    const wrapper = document.createElement("div");
    wrapper.className = "foursome";

    const header = document.createElement("div");
    header.className = "foursome-header";
    header.textContent = `Foursome ${index + 1}`;

    wrapper.appendChild(header);

    group.forEach(match => {
      wrapper.appendChild(buildMatch(match, data));
    });

    grid.appendChild(wrapper);
  });
}

function buildMatch(match, data) {
  const div = document.createElement("div");
  div.className = "matchup";

  const header = document.createElement("div");
  header.className = "matchup-header";

  const [p1, p2] = match.playerIds;

  const left = document.createElement("span");
  left.className = "player-name";
  left.textContent = p1 ? data.players[p1].name : "TBD";

  const vs = document.createElement("span");
  vs.textContent = "VS";

  const right = document.createElement("span");
  right.className = "player-name";
  right.textContent = p2 ? data.players[p2].name : "TBD";

  header.append(left, vs, right);

  const scores = document.createElement("div");
  scores.className = "score-display";
  scores.append(
    buildNine("Front 9", match.points.front9),
    buildNine("Back 9", match.points.back9)
  );

  const status = document.createElement("div");
  status.className = "match-status";
  status.textContent = formatStatus(match);

  div.append(header, scores, status);
  return div;
}

function buildNine(label, val) {
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
   META
   ====================== */

function renderLastUpdated(data) {
  const d = new Date(data.meta.lastUpdated);
  document.getElementById("last-updated").textContent =
    `Last updated: ${d.toLocaleString()}`;
}

function formatStatus(match) {
  if (match.status === "complete") return "Final";
  if (match.status === "in_progress") return "On Course";
  return "Not Started";
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
