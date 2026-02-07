/* ======================
   MATCHUP MODAL (Shared)
   ====================== */

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

  const p1 = data.players[p1Id];
  const p2 = data.players[p2Id];

  // Calculate differential
  const popsDiff = Math.abs(p1.pops - p2.pops);
  const underdog = p1.pops > p2.pops ? p1 : p2;

  // Get strokes per nine
  const strokeHoles = getStrokeHoles(popsDiff);
  const front9Strokes = strokeHoles.filter(h => h.hole <= 9);
  const back9Strokes = strokeHoles.filter(h => h.hole >= 10);

  // Build modal HTML
  const modalHTML = `
    <div class="modal-overlay" onclick="closeMatchupModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeMatchupModal()">\u2715</button>

        <div class="modal-header">
          <div class="modal-header-names">
            <span class="modal-header-p1">${p1.name}</span>
            <span class="modal-header-vs">vs</span>
            <span class="modal-header-p2">${p2.name}</span>
          </div>
          <div class="modal-header-sub">${p1.pops} pops vs ${p2.pops} pops${popsDiff > 0 ? ` \u2022 ${underdog.name} gets ${popsDiff}` : ' \u2022 Even match'}</div>
        </div>

        <div class="modal-body">
          ${buildCompactScorecard(match, p1, p2)}

          ${popsDiff > 0 ? buildPopsBreakdown(front9Strokes, back9Strokes, underdog) : ''}
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

function getStrokeHoles(numStrokes) {
  if (numStrokes === 0) return [];
  const allHoles = [...SCORECARD.front9, ...SCORECARD.back9];
  const sortedByDifficulty = allHoles.sort((a, b) => a.handicap - b.handicap);
  return sortedByDifficulty.slice(0, numStrokes);
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
  html += buildCompactNine(holes, 1, 9, p1, p2, f9p1, f9p2, 'Front 9', match.points.front9);

  // Back 9
  html += buildCompactNine(holes, 10, 18, p1, p2, b9p1, b9p2, 'Back 9', match.points.back9);

  html += `</div>`;
  return html;
}

function buildCompactNine(holes, startHole, endHole, p1, p2, p1Wins, p2Wins, label, nineResult) {
  // Nine result text
  let resultText = '';
  let resultClass = '';
  if (nineResult === 1) { resultText = p1.name; resultClass = 'result-p1'; }
  else if (nineResult === 0) { resultText = p2.name; resultClass = 'result-p2'; }
  else if (nineResult === 0.5) { resultText = 'Halved'; resultClass = 'result-halved'; }
  else { resultText = '-'; resultClass = 'result-pending'; }

  let html = `<div class="compact-nine">
    <div class="compact-nine-header">
      <span class="compact-nine-label">${label}</span>
      <span class="compact-nine-tally">${p1.name.substring(0, 3)} ${p1Wins} - ${p2Wins} ${p2.name.substring(0, 3)}</span>
      <span class="compact-nine-result ${resultClass}">${resultText}</span>
    </div>
    <div class="compact-holes-row">`;

  for (let h = startHole; h <= endHole; h++) {
    const v = holes[h];
    let circleClass = 'compact-hole';

    if (v === 1) circleClass += ' hole-p1';
    else if (v === 0) circleClass += ' hole-p2';
    else if (v === 0.5) circleClass += ' hole-halved';
    else circleClass += ' hole-empty';

    html += `<div class="${circleClass}"><span class="compact-hole-num">${h}</span></div>`;
  }

  html += `</div></div>`;
  return html;
}

/*************************
 * POPS BREAKDOWN WITH CIRCLE ICONS
 *************************/

function buildPopsBreakdown(front9Strokes, back9Strokes, underdog) {
  const front9Set = new Set(front9Strokes.map(h => h.hole));
  const back9Set = new Set(back9Strokes.map(h => h.hole));

  let html = `<div class="modal-section pops-section">
    <div class="pops-header">
      <span class="pops-title">${underdog.name}'s Stroke Holes</span>
      <span class="pops-count">${front9Strokes.length + back9Strokes.length} total</span>
    </div>`;

  // Front 9 pops
  html += `<div class="pops-nine">
    <span class="pops-nine-label">Front</span>
    <div class="pops-holes-row">`;
  for (let h = 1; h <= 9; h++) {
    const isStroke = front9Set.has(h);
    html += `<div class="pops-hole ${isStroke ? 'pops-stroke' : 'pops-no-stroke'}"><span>${h}</span></div>`;
  }
  html += `<span class="pops-nine-count">${front9Strokes.length}</span></div></div>`;

  // Back 9 pops
  html += `<div class="pops-nine">
    <span class="pops-nine-label">Back</span>
    <div class="pops-holes-row">`;
  for (let h = 10; h <= 18; h++) {
    const isStroke = back9Set.has(h);
    html += `<div class="pops-hole ${isStroke ? 'pops-stroke' : 'pops-no-stroke'}"><span>${h}</span></div>`;
  }
  html += `<span class="pops-nine-count">${back9Strokes.length}</span></div></div>`;

  html += `</div>`;
  return html;
}
