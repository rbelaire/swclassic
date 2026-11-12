/* ======================
   MATCHUP MODAL (Shared)
   ====================== */

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Scorecard Data - Handicap rankings per hole
const SCORECARD = {
  front9: [
    { hole: 1, par: 5, handicap: 5, yardage: { black: 548, yellow: 530, silver: 513 } },
    { hole: 2, par: 4, handicap: 9, yardage: { black: 388, yellow: 360, silver: 333 } },
    { hole: 3, par: 3, handicap: 13, yardage: { black: 174, yellow: 150, silver: 132 } },
    { hole: 4, par: 5, handicap: 15, yardage: { black: 530, yellow: 524, silver: 491 } },
    { hole: 5, par: 4, handicap: 1, yardage: { black: 463, yellow: 441, silver: 419 } },
    { hole: 6, par: 4, handicap: 7, yardage: { black: 369, yellow: 345, silver: 319 } },
    { hole: 7, par: 3, handicap: 11, yardage: { black: 196, yellow: 166, silver: 165 } },
    { hole: 8, par: 4, handicap: 17, yardage: { black: 379, yellow: 345, silver: 302 } },
    { hole: 9, par: 4, handicap: 3, yardage: { black: 435, yellow: 411, silver: 385 } }
  ],
  back9: [
    { hole: 10, par: 4, handicap: 18, yardage: { black: 353, yellow: 324, silver: 311 } },
    { hole: 11, par: 5, handicap: 14, yardage: { black: 506, yellow: 482, silver: 450 } },
    { hole: 12, par: 4, handicap: 16, yardage: { black: 367, yellow: 341, silver: 316 } },
    { hole: 13, par: 3, handicap: 4, yardage: { black: 185, yellow: 153, silver: 147 } },
    { hole: 14, par: 4, handicap: 12, yardage: { black: 376, yellow: 353, silver: 330 } },
    { hole: 15, par: 4, handicap: 6, yardage: { black: 385, yellow: 365, silver: 332 } },
    { hole: 16, par: 4, handicap: 2, yardage: { black: 450, yellow: 411, silver: 380 } },
    { hole: 17, par: 3, handicap: 8, yardage: { black: 227, yellow: 211, silver: 182 } },
    { hole: 18, par: 5, handicap: 10, yardage: { black: 584, yellow: 560, silver: 530 } }
  ]
};

function showMatchupModal(match, data) {
  const [p1Id, p2Id] = match.playerIds;
  if (!p1Id || !p2Id) return;

  const lead1 = data.players[p1Id];
  const lead2 = data.players[p2Id];
  if (!lead1 || !lead2) return;

  // Each side is a pair: show "A & B" and colour by the pair's team.
  const p1 = { name: ClassicTeams.pairName(match, 0, data.players) || lead1.name, team: lead1.team };
  const p2 = { name: ClassicTeams.pairName(match, 1, data.players) || lead2.name, team: lead2.team };
  const F = ClassicTeams.FORMAT;

  // Build modal HTML
  const modalHTML = `
    <div class="modal-overlay" onclick="closeMatchupModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeMatchupModal()">\u2715</button>

        <div class="modal-header">
          <div class="modal-header-names">
            <span class="modal-header-p1">${escapeHTML(p1.name)}</span>
            <span class="modal-header-vs">vs</span>
            <span class="modal-header-p2">${escapeHTML(p2.name)}</span>
          </div>
          <div class="modal-header-sub">${escapeHTML(F.front9.label)} (Front 9) \u2022 ${escapeHTML(F.back9.label)} (Back 9) \u2022 No handicap strokes</div>
        </div>

        <div class="modal-body">
          ${buildCompactScorecard(match, p1, p2)}
        </div>
      </div>
    </div>
  `;

  const modalDiv = document.createElement('div');
  modalDiv.id = 'matchup-modal';
  modalDiv.innerHTML = modalHTML;
  document.body.appendChild(modalDiv);
}

function closeMatchupModal() {
  const modal = document.getElementById('matchup-modal');
  if (modal) modal.remove();
}

/*************************
 * COMPACT HOLE-BY-HOLE SCORECARD
 *************************/

function buildCompactScorecard(match, p1, p2) {
  const holes = match.points.holes;
  if (!holes) return '<div class="modal-section"><p style="text-align:center;opacity:0.6;">No scores yet</p></div>';

  const anyPlayed = Object.values(holes).some(v => v !== null && v !== undefined);
  if (!anyPlayed) return '<div class="modal-section"><p style="text-align:center;opacity:0.6;">No scores yet</p></div>';

  // Count wins per nine
  let f9p1 = 0, f9p2 = 0, b9p1 = 0, b9p2 = 0;
  let totalPlayed = 0;
  for (let h = 1; h <= 18; h++) {
    const v = holes[h];
    if (v === null || v === undefined) continue;
    totalPlayed++;
    if (h <= 9) {
      if (v === 1) f9p1++;
      else if (v === 0) f9p2++;
    } else {
      if (v === 1) b9p1++;
      else if (v === 0) b9p2++;
    }
  }

  const progressText = totalPlayed >= 18 ? 'Final' : `Thru ${totalPlayed}`;

  let html = `<div class="modal-section compact-scorecard-section">
    <div class="compact-scorecard-header">
      <span class="compact-scorecard-progress">${progressText}</span>
    </div>`;

  // Front 9
  html += buildCompactNine(holes, 1, 9, p1, p2, f9p1, f9p2, 'Front 9 \u00b7 Scramble', match.points.front9);

  // Back 9
  html += buildCompactNine(holes, 10, 18, p1, p2, b9p1, b9p2, 'Back 9 \u00b7 Alt Shot', match.points.back9);

  // Overall 18 (the third point)
  const t = match.points.total;
  const tp1 = f9p1 + b9p1, tp2 = f9p2 + b9p2;
  const tText = t === 1 ? p1.name : t === 0 ? p2.name : t === 0.5 ? 'Halved' : '-';
  const tClass = t === 1 ? 'result-' + (p1.team === 'red' ? 'red' : 'green')
    : t === 0 ? 'result-' + (p2.team === 'red' ? 'red' : 'green')
    : t === 0.5 ? 'result-halved' : 'result-pending';
  html += `<div class="compact-nine">
    <div class="compact-nine-header">
      <span class="compact-nine-label">Overall 18</span>
      <span class="compact-nine-tally">${tp1} - ${tp2}</span>
      <span class="compact-nine-result ${tClass}">${escapeHTML(tText)}</span>
    </div>
  </div>`;

  html += `</div>`;
  return html;
}

function buildCompactNine(holes, startHole, endHole, p1, p2, p1Wins, p2Wins, label, nineResult) {
  // Map p1/p2 to their color team (green/red)
  const p1Team = p1.team === 'red' ? 'red' : 'green';
  const p2Team = p2.team === 'red' ? 'red' : 'green';

  // Nine result text
  let resultText = '';
  let resultClass = '';
  if (nineResult === 1) { resultText = p1.name; resultClass = 'result-' + p1Team; }
  else if (nineResult === 0) { resultText = p2.name; resultClass = 'result-' + p2Team; }
  else if (nineResult === 0.5) { resultText = 'Halved'; resultClass = 'result-halved'; }
  else { resultText = '-'; resultClass = 'result-pending'; }

  let html = `<div class="compact-nine">
    <div class="compact-nine-header">
      <span class="compact-nine-label">${label}</span>
      <span class="compact-nine-tally">${p1Wins} - ${p2Wins}</span>
      <span class="compact-nine-result ${resultClass}">${escapeHTML(resultText)}</span>
    </div>
    <div class="compact-holes-row">`;

  for (let h = startHole; h <= endHole; h++) {
    const v = holes[h];
    let circleClass = 'compact-hole';

    if (v === 1) circleClass += ' hole-' + p1Team;
    else if (v === 0) circleClass += ' hole-' + p2Team;
    else if (v === 0.5) circleClass += ' hole-halved';
    else circleClass += ' hole-empty';

    html += `<div class="${circleClass}"><span class="compact-hole-num">${h}</span></div>`;
  }

  html += `</div></div>`;
  return html;
}
