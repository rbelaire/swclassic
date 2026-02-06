/*************************
 * TOURNAMENT HISTORY
 * The Classic
 *************************/

(function () {
  'use strict';

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
})();
