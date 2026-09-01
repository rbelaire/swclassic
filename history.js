/*************************
 * TOURNAMENT HISTORY
 * The Classic
 *************************/

(function () {
  'use strict';

  const COURSE_PARS = {
    1: 5, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4, 7: 3, 8: 4, 9: 4,
    10: 4, 11: 5, 12: 4, 13: 3, 14: 4, 15: 4, 16: 4, 17: 3, 18: 5
  };

  fetch(`./history-data.json?t=${Date.now()}`, { cache: "no-store" })
    .then(res => res.json())
    .then(data => renderHistory(data))
    .catch(err => {
      console.error('Error loading history:', err);
      document.getElementById('history-container').innerHTML =
        '<p style="text-align:center; color:#c62828;">Failed to load tournament history.</p>';
    });

  function renderHistory(data) {
    const container = document.getElementById('history-container');
    if (!container || !data.tournaments) return;

    // Sort by year descending (most recent first)
    const sorted = [...data.tournaments].sort((a, b) => b.year - a.year);

    container.innerHTML = sorted.map(t => renderTournament(t)).join('');
  }

  function renderTournament(t) {
    let html = `<div class="year-section">`;

    // Year header
    html += `<div class="section-header"><h2>${t.name}</h2></div>`;
    html += `<div class="tournament-meta">${t.date} &mdash; ${t.venue}</div>`;

    if (t.status === 'upcoming') {
      html += `
        <div class="upcoming-banner">
          <h3>Results Pending</h3>
          <p>This tournament has not been played yet.</p>
        </div>`;
    } else if (t.status === 'complete') {
      html += renderCompleteTournament(t);
    }

    if (t.notes) {
      html += `<div class="tournament-notes">${t.notes}</div>`;
    }

    html += `</div>`;
    return html;
  }

  function renderCompleteTournament(t) {
    let html = '';

    // Winner banner
    const brockScore = t.finalScore.brock || 0;
    const jaredScore = t.finalScore.jared || 0;
    const winner = brockScore > jaredScore ? t.captains.brock : t.captains.jared;
    const brockWins = brockScore > jaredScore;
    const jaredWins = jaredScore > brockScore;

    html += `<div class="result-banner">`;
    html += `<h3>Team ${winner} Wins!</h3>`;
    html += `<div class="final-score">`;
    html += `<span class="${brockWins ? 'winner-score' : ''}">Team ${t.captains.brock}: ${brockScore}</span>`;
    html += ` &mdash; `;
    html += `<span class="${jaredWins ? 'winner-score' : ''}">Team ${t.captains.jared}: ${jaredScore}</span>`;
    html += `</div>`;
    html += `</div>`;

    // Match results
    if (t.matches && t.matches.length > 0) {
      html += `<div style="margin-top: 20px;">`;
      t.matches.forEach(m => {
        const p1Winner = m.result && m.result.p1 > m.result.p2;
        const p2Winner = m.result && m.result.p2 > m.result.p1;

        html += `<div class="history-match">`;
        html += `<div class="h-player ${p1Winner ? 'h-winner' : ''}">${m.player1}${m.result ? ' <span class="h-score">(' + m.result.p1 + ')</span>' : ''}</div>`;
        html += `<div class="h-vs">vs</div>`;
        html += `<div class="h-player ${p2Winner ? 'h-winner' : ''}">${m.player2}${m.result ? ' <span class="h-score">(' + m.result.p2 + ')</span>' : ''}</div>`;
        html += `</div>`;
        html += renderHoleScorecard(m);
      });
      html += `</div>`;
    }

    // MVP card
    if (t.mvp) {
      html += `
        <div class="mvp-card">
          <div class="mvp-label">Most Valuable Player</div>
          <div class="mvp-name">${t.mvp}</div>
        </div>`;
    }

    return html;
  }

  function renderHoleScorecard(m) {
    if (!m || !m.holes) return '';
    const played = Object.keys(COURSE_PARS).some(h => {
      const v = m.holes[h];
      return v === 0 || v === 1 || v === 0.5;
    });
    if (!played) return '';

    const sideClass = side =>
      side === 'brock' ? 'hsc-brock' : side === 'jared' ? 'hsc-jared' : 'hsc-none';

    const nine = (start, end, label, nineVal) => {
      let cells = '';
      for (let h = start; h <= end; h++) {
        const v = m.holes[h];
        let cls = 'hsc-cell';
        if (v === 1) cls += ' ' + sideClass(m.side1);
        else if (v === 0) cls += ' ' + sideClass(m.side2);
        else if (v === 0.5) cls += ' hsc-tie';
        else cls += ' hsc-empty';
        cells += `<div class="${cls}"><span class="hsc-h">${h}</span><span class="hsc-p">${COURSE_PARS[h]}</span></div>`;
      }
      const res = nineVal === 1 ? m.player1
        : nineVal === 0 ? m.player2
        : nineVal === 0.5 ? 'Halved' : '&mdash;';
      return `<div class="hsc-nine">
        <div class="hsc-nine-label">${label}<span class="hsc-nine-res">${res}</span></div>
        <div class="hsc-row">${cells}</div>
      </div>`;
    };

    const legend = `<div class="hsc-legend">
      <span class="hsc-chip ${sideClass(m.side1)}">${m.player1}</span>
      <span class="hsc-chip ${sideClass(m.side2)}">${m.player2}</span>
      <span class="hsc-chip hsc-tie">Tie</span>
    </div>`;

    return `<div class="h-scorecard">
      ${legend}
      ${nine(1, 9, 'Front 9', m.front9)}
      ${nine(10, 18, 'Back 9', m.back9)}
    </div>`;
  }
})();
