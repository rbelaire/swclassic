/*************************
 * ADMIN PASSWORD GATE
 *************************/
const ADMIN_PASSWORD = "classic2026";

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
  });

/*************************
 * RENDER
 *************************/
function render() {
  const container = document.getElementById("matches");
  container.innerHTML = "";

  data.matches.forEach(match => {
    const div = document.createElement("div");
    div.className = "match";

    if (!isValidMatchup(match)) {
      div.classList.add("invalid");
    }

    const title = document.createElement("h3");
    title.textContent = `Match ${match.id}`;

    const p1 = buildPlayerSelect(match, 0);
    const p2 = buildPlayerSelect(match, 1);

    const front9 = buildScoreSelect(match, "front9");
    const back9 = buildScoreSelect(match, "back9");

    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap Players";
    swapBtn.onclick = () => {
      [match.playerIds[0], match.playerIds[1]] =
        [match.playerIds[1], match.playerIds[0]];
      match.points.front9 = null;
      match.points.back9 = null;
      render();
    };

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear Match";
    clearBtn.onclick = () => {
      match.playerIds = [null, null];
      match.points.front9 = null;
      match.points.back9 = null;
      render();
    };

    const players = document.createElement("div");
    players.className = "players";

    const p1Wrap = document.createElement("div");
    p1Wrap.innerHTML = "<strong>Player 1</strong>";
    p1Wrap.appendChild(p1);

    const p2Wrap = document.createElement("div");
    p2Wrap.innerHTML = "<strong>Player 2</strong>";
    p2Wrap.appendChild(p2);

    players.append(p1Wrap, p2Wrap);

    const scores = document.createElement("div");
    scores.className = "scores";
    scores.append(front9, back9);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(swapBtn, clearBtn);

    div.append(title, players, scores, actions);
    container.appendChild(div);
  });

  renderTotals();
}

/*************************
 * PLAYER SELECT
 *************************/
function buildPlayerSelect(match, index) {
  const select = document.createElement("select");

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "-- Select Player --";
  select.appendChild(blank);

  Object.entries(data.players).forEach(([id, p]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${p.name} (${p.team})`;
    if (match.playerIds[index] === id) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = e => {
    match.playerIds[index] = e.target.value || null;
    match.points.front9 = null;
    match.points.back9 = null;
    render();
  };

  return select;
}

/*************************
 * SCORE SELECT (PLAYER 1)
 *************************/
function buildScoreSelect(match, key) {
  const select = document.createElement("select");
  select.className = "score";

  const options = [
    { label: "-- Result (Player 1) --", value: "" },
    { label: "Win", value: "1" },
    { label: "Tie", value: "0.5" },
    { label: "Loss", value: "0" }
  ];

  options.forEach(o => {
    const opt = document.createElement("option");
    opt.textContent = o.label;
    opt.value = o.value;
    if (match.points[key] !== null && String(match.points[key]) === o.value) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  const valid = isValidMatchup(match);
  select.disabled = !valid;
  if (!valid) select.classList.add("disabled");

  select.onchange = e => {
    match.points[key] = e.target.value === "" ? null : Number(e.target.value);
    render();
  };

  return select;
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
 * TOTALS
 *************************/
function calculateTotals() {
  const totals = {};
  Object.keys(data.teams).forEach(t => totals[t] = 0);

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
 * SAVE TO GITHUB (FIXED)
 *************************/
function saveToGitHub() {
  const token = prompt("GitHub token:");
  if (!token) return;

  data.meta.lastUpdated = new Date().toISOString();

  // Step 1: fetch current SHA
  fetch("https://api.github.com/repos/rbelaire/swclassic/contents/data.json", {
    headers: {
      Authorization: `token ${token}`
    }
  })
    .then(res => res.json())
    .then(file => {
      const sha = file.sha;

      // Step 2: overwrite file
      return fetch("https://api.github.com/repos/rbelaire/swclassic/contents/data.json", {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Update tournament data",
          content: btoa(JSON.stringify(data, null, 2)),
          sha: sha
        })
      });
    })
    .then(res => res.json())
    .then(resp => {
      if (resp.content) {
        alert("Saved successfully!");
      } else {
        console.error(resp);
        alert("Save failed. Check token permissions.");
      }
    })
    .catch(err => {
      console.error(err);
      alert("Save failed due to network or auth error.");
    });
}