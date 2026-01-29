const GITHUB_OWNER = "rbelaire";
const GITHUB_REPO = "swclassic";
const DATA_PATH = "data.json";

// TEMP MVP AUTH (do not commit token)
const GITHUB_TOKEN = prompt("Enter GitHub admin token:");


let data;

fetch("./data.json")
  .then(res => res.json())
  .then(json => {
    data = json;
    render();
  });

function render() {
  const container = document.getElementById("matches");
  container.innerHTML = "";

  data.matches.forEach(match => {
    const div = document.createElement("div");
    div.className = "match";

    const usedPlayers = getUsedPlayers(match.round, match.id);

    const p1 = buildPlayerSelect(match, 0, usedPlayers);
    const p2 = buildPlayerSelect(match, 1, usedPlayers);

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
      render();
    };

    const title = document.createElement("h3");
    title.textContent = `Match ${match.id} (Round ${match.round})`;

    div.append(title, p1, p2, swapBtn, clearBtn);

    if (!isValidMatchup(match)) {
      div.classList.add("invalid");
    }

    container.appendChild(div);
  });
}
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

function getUsedPlayers(round, currentMatchId) {
  const used = new Set();
  data.matches.forEach(m => {
    if (m.round === round && m.id !== currentMatchId) {
      m.playerIds.forEach(p => p && used.add(p));
    }
  });
  return used;
}

function isValidMatchup(match) {
  const [p1, p2] = match.playerIds;
  if (!p1 || !p2) return true;

  return data.players[p1].team !== data.players[p2].team;
}
async function saveToGitHub() {
  if (!GITHUB_TOKEN) {
    alert("Missing GitHub token");
    return;
  }

  // Update timestamp
  data.meta.lastUpdated = new Date().toISOString();

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;

  // Step 1: get current file SHA
  const existing = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`
    }
  }).then(r => r.json());

  if (!existing.sha) {
    alert("Could not fetch data.json SHA");
    return;
  }

  // Step 2: push update
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update matchups",
      content: btoa(JSON.stringify(data, null, 2)),
      sha: existing.sha
    })
  });

  if (response.ok) {
    alert("✅ Matchups saved to GitHub");
  } else {
    alert("❌ Save failed");
    console.error(await response.text());
  }
}
