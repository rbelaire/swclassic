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

  // Don't show modal if players not selected yet
  if (!p1Id || !p2Id) {
    return;
  }

  const p1 = data.players[p1Id];
  const p2 = data.players[p2Id];

  // Calculate differential
  const popsDiff = Math.abs(p1.pops - p2.pops);
  const underdog = p1.pops > p2.pops ? p1 : p2;
  const favorite = p1.pops > p2.pops ? p2 : p1;

  // Get strokes per nine
  const strokeHoles = getStrokeHoles(popsDiff);
  const front9Strokes = strokeHoles.filter(h => h.hole <= 9);
  const back9Strokes = strokeHoles.filter(h => h.hole >= 10);

  // Build modal HTML
  const modalHTML = `
    <div class="modal-overlay" onclick="closeMatchupModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeMatchupModal()">✕</button>

        <div class="modal-header">
          <h2>Match ${match.id} Details</h2>
        </div>

        <div class="modal-body">
          <!-- Players -->
          <div class="modal-matchup">
            <div class="modal-player">
              <div class="modal-player-name">${p1.name}</div>
              <div class="modal-player-info">${p1.pops} pops • Team ${p1.team === 'brock' ? 'Brock' : 'Jared'}</div>
            </div>
            <div class="modal-vs">VS</div>
            <div class="modal-player">
              <div class="modal-player-name">${p2.name}</div>
              <div class="modal-player-info">${p2.pops} pops • Team ${p2.team === 'brock' ? 'Brock' : 'Jared'}</div>
            </div>
          </div>

          <!-- Handicap Advantage -->
          <div class="modal-section">
            <h3>📊 Handicap Advantage</h3>
            ${popsDiff === 0
              ? `<p>Even match - no handicap strokes.</p>`
              : `<p><strong>${underdog.name}</strong> gets <strong>${popsDiff} stroke${popsDiff > 1 ? 's' : ''}</strong> on the hardest holes.</p>`
            }
          </div>

          ${popsDiff > 0 ? `
          <!-- Front 9 Breakdown -->
          <div class="modal-section">
            <h3>⛳ Front 9 Breakdown</h3>
            <p><strong>${underdog.name}</strong> gets <strong>${front9Strokes.length} stroke${front9Strokes.length !== 1 ? 's' : ''}</strong>:</p>
            <div class="hole-list">
              ${front9Strokes.map(h => `
                <div class="hole-item">
                  <span class="hole-number">Hole ${h.hole}</span>
                  <span class="hole-details">Par ${h.par} • ${h.yardage.black}yds • H${h.handicap}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Back 9 Breakdown -->
          <div class="modal-section">
            <h3>⛳ Back 9 Breakdown</h3>
            <p><strong>${underdog.name}</strong> gets <strong>${back9Strokes.length} stroke${back9Strokes.length !== 1 ? 's' : ''}</strong>:</p>
            <div class="hole-list">
              ${back9Strokes.map(h => `
                <div class="hole-item">
                  <span class="hole-number">Hole ${h.hole}</span>
                  <span class="hole-details">Par ${h.par} • ${h.yardage.black}yds • H${h.handicap}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Current Score -->
          <div class="modal-section">
            <h3>📈 Current Score</h3>
            <div class="score-summary">
              <div class="score-row">
                <span>Front 9:</span>
                <span><strong>${match.points.front9 === null ? 'Not Started' : `${p1.name} ${match.points.front9} - ${1 - match.points.front9} ${p2.name}`}</strong></span>
              </div>
              <div class="score-row">
                <span>Back 9:</span>
                <span><strong>${match.points.back9 === null ? 'Not Started' : `${p1.name} ${match.points.back9} - ${1 - match.points.back9} ${p2.name}`}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to page
  const modalDiv = document.createElement('div');
  modalDiv.id = 'matchup-modal';
  modalDiv.innerHTML = modalHTML;
  document.body.appendChild(modalDiv);
}

function closeMatchupModal() {
  const modal = document.getElementById('matchup-modal');
  if (modal) {
    modal.remove();
  }
}

function getStrokeHoles(numStrokes) {
  if (numStrokes === 0) return [];

  // Combine all holes and sort by handicap (1 = hardest)
  const allHoles = [...SCORECARD.front9, ...SCORECARD.back9];
  const sortedByDifficulty = allHoles.sort((a, b) => a.handicap - b.handicap);

  // Return the N hardest holes
  return sortedByDifficulty.slice(0, numStrokes);
}
