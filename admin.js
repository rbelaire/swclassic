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
