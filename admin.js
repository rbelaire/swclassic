/*************************
 * ADMIN PASSWORD GATE
 *************************/

const ADMIN_PASSWORD = "classic2026"; // change this

const entered = prompt("Enter admin password:");

if (entered !== ADMIN_PASSWORD) {
  alert("Access denied");
  window.location.href = "index.html";
}

/*************************
 * CONFIG
 *************************/

const GITHUB_OWNER = "rbelaire";
const GITHUB_REPO = "swclassic";
const DATA_PATH = "data.json";

// MVP auth (do NOT commit token)
const GITHUB_TOKEN = prompt("Enter GitHub admin token:");

let data;

/*************************
 * LOAD DATA
 *************************/

fetch("./data.json")
  .then(res => res.json())
  .then(json => {
    data = json;
    render();
  });

/*************************
 * MAIN RENDER
 *************************/

function render() {
  const container = document.getElementById("matches");
  container.innerHTML = "";

  data.matches.forEach(match => {
    const div = document.createElement("div");
    div.className = "match";

    const title = document.createElement("h3");
    title.textContent = `Match ${match.id} (Round ${match.round})`;

    const usedPlayers = getUsedPlayers(match.round, match.id);

    const p1 = buildPlayerSelect(match, 0, usedPlayers);
    const p2 = buildPlayerSelect(match, 1, usedPlayers);

    const front9 = buildScoreSelect(match, "front9");
    const back9 = buildScoreSelect(match, "back9");

    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap";
    swapBtn.onclick = () => {
      [match.playerIds[0], match.playerIds[1]] =
        [match.playerIds[1], match.playerIds[0]];
      render();
    };

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.onclick = () => {
      match.playerIds = [null, null];
      match.points.front9 = null;
      match.points.back9 = null;
      render();
    };

    if (!isValidMatchup(match)) {
      div.classList.add("invalid");
    }

    div.append(
      title,
      p1,
      p2,
      front9,
      back9,
      swapBtn,
      clearBtn
    );

    container.appendChild(div);
  });

  renderTotals();
}

/*************************
 * PLAYER SELECT
 *************************/

function buildPlayerSelect(match, index, usedPlayers) {
  const select = document.createElement("select");
  select.innerHTML = `<option value="">-- Select Player --</option>`;

  Object.entries(data.players).forEach(([id, player]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `${player.name} (${data.teams[player.team].name})`;

    if (usedPlayers.has(id) && match.playerIds[index] !== id) {
      option.disabled = true;
    }

    if (match.playerIds[index] === id) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  select.onchange = e => {
    match.playerIds[index] = e.target.value || null;
    render();
  };

  return select;
}

/*************************
 * SCORE SELECT
 *************************/

function buildScoreSelect(match, key) {
  const select = document.createElement("select");
  select.className = "score";

  const options = [
    { label: "--", value: "" },
    { label: "Win (1)", value: "1" },
    { label: "Tie (0.5)", value: "0.5" },
    { label: "Loss (0)", value: "0" }
  ];

  options.forEach(o => {
    const opt = document.createElement("option");
    opt.textContent = o.label;
    opt.value = o.value;

    if (
      match.points[key] !== null &&
      String(match.points[key]) === o.value
    ) {
      opt.selected = true;
    }

    select.appendChild(opt);
  });

  const valid = isValidMatchup(match);
  select.disabled = !valid;
  if (!valid) select.classList.add("disabled");

  select.onchange = e => {
    match.points[key] =
      e.target.value === "" ? null : Number(e.target.value);
    render();
  };

  return select;
}

/*************************
 * VALIDATION
 *************************/

function isValidMatchup(match) {
  const [p1, p2] = match.playerIds;

  if (!p1 || !p2) {
    match.points.front9 = null;
    match.points.back9 = null;
    return false;
  }

  const valid =
    data.players[p1].team !== data.players[p2].team;

  if (!valid) {
    match.points.front9 = null;
    match.points.back9 = null;
  }

  return valid;
}

function getUsedPlayers(round, currentMatchId) {
  const used = new Set();

  data.matches.forEach(m => {
    if (m.round === round && m.id !== currentMatchId) {
      m.playerIds.forEach(p => p && used.add(p));
    }
  });

  return used;
}

/*************************
 * TOTALS
 *************************/

function calculateTotals() {
  const totals = {};
  Object.keys(data.teams).forEach(t => (totals[t] = 0));

  data.matches.forEach(match => {
    const [p1, p2] = match.playerIds;
    if (!p1 || !p2) return;

    const team1 = data.players[p1].team;
    const team2 = data.players[p2].team;

    ["front9", "back9"].forEach(key => {
      const val = match.points[key];
      if (val === null) return;
      totals[team1] += val;
      totals[team2] += 1 - val;
    });
  });

  return totals;
}

function renderTotals() {
  const div = document.getElementById("totals");
  div.innerHTML = "";

  const totals = calculateTotals();

  Object.entries(totals).forEach(([teamId, score]) => {
    const row = document.createElement("div");
    row.textContent = `${data.teams[teamId].name}: ${score.toFixed(1)}`;
    div.appendChild(row);
  });
}

/*************************
 * SAVE TO GITHUB
 *************************/

async function saveToGitHub() {
  if (!GITHUB_TOKEN) {
    alert("Missing GitHub token");
    return;
  }

  data.meta.lastUpdated = new Date().toISOString();

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;

  const existing = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`
    }
  }).then(r => r.json());

  if (!existing.sha) {
    alert("Could not fetch data.json SHA");
    return;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update matchups and scores",
      content: btoa(JSON.stringify(data, null, 2)),
      sha: existing.sha
    })
  });

  if (response.ok) {
    alert("✅ Saved to GitHub");
  } else {
    alert("❌ Save failed");
    console.error(await response.text());
  }
}
