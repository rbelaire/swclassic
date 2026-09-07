/*************************
 * THE CLASSIC — SINGLE YEAR RECAP
 * Performance summary + hole-by-hole matches for one tournament,
 * read from history-data.json. Defaults to 2026 (override with ?year=).
 *************************/
(function () {
  'use strict';

  const COURSE_PARS = {
    1: 5, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4, 7: 3, 8: 4, 9: 4,
    10: 4, 11: 5, 12: 4, 13: 3, 14: 4, 15: 4, 16: 4, 17: 3, 18: 5
  };

  const YEAR = parseInt(new URLSearchParams(location.search).get('year'), 10) || 2026;

  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function slug(name) { return String(name || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function avatar(name) {
    const s = slug(name);
    if (!s) return '';
    return `<img class="h-avatar" src="images/players/${s}.jpg" alt="" loading="lazy" onerror="this.remove()">`;
  }

  // Legacy records key teams brock/jared; new ones use teams:{green,red}.
  // Normalize to green (team one) / red (team two).
  function sideKey(side) {
    return (side === 'green' || side === 'brock') ? 'green'
      : (side === 'red' || side === 'jared') ? 'red' : 'none';
  }
  function sideClass(side) {
    const k = sideKey(side);
    return k === 'green' ? 'hsc-green' : k === 'red' ? 'hsc-red' : 'hsc-none';
  }
  function teamInfo(t) {
    if (t.teams) {
      return {
        green: { name: t.teams.green.name, score: t.teams.green.score || 0 },
        red: { name: t.teams.red.name, score: t.teams.red.score || 0 }
      };
    }
    return {
      green: { name: t.captains.brock, score: t.finalScore.brock || 0 },
      red: { name: t.captains.jared, score: t.finalScore.jared || 0 }
    };
  }

  fetch(`./history-data.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      const t = (data.tournaments || []).find(x => x.year === YEAR);
      const root = document.getElementById('recap');
      if (!t) { root.innerHTML = `<p style="text-align:center;opacity:.7;">No record found for ${YEAR}.</p>`; return; }
      render(t);
    })
    .catch(err => {
      console.error('Error loading recap:', err);
      document.getElementById('recap').innerHTML =
        '<p style="text-align:center;color:#c22e2e;">Failed to load the 2026 recap.</p>';
    });

  function render(t) {
    const ti = teamInfo(t);
    const sub = document.getElementById('recap-sub');
    if (sub) sub.textContent = [t.date, t.venue].filter(Boolean).join('  ·  ');
    document.title = `${t.name} — Recap`;

    let html = '';
    html += resultBanner(ti);
    html += summary(t, ti);
    html += matchDetail(t);
    document.getElementById('recap').innerHTML = html;
  }

  function resultBanner(ti) {
    const gWins = ti.green.score > ti.red.score;
    const winner = gWins ? ti.green.name : ti.red.name;
    return `
      <div class="result-banner">
        <h3>Team ${esc(winner)} Wins</h3>
        <div class="final-score">
          <span class="hsc-green-text ${gWins ? 'winner-score' : ''}">Team ${esc(ti.green.name)}: ${ti.green.score}</span>
          <span class="fs-dash">&mdash;</span>
          <span class="hsc-red-text ${!gWins ? 'winner-score' : ''}">Team ${esc(ti.red.name)}: ${ti.red.score}</span>
        </div>
      </div>`;
  }

  // Per-match outcome from the point result (2 pts per match).
  function outcome(m) {
    const a = (m.result && m.result.p1) || 0;
    const b = (m.result && m.result.p2) || 0;
    const kA = sideKey(m.side1), kB = sideKey(m.side2);
    let winnerSide = 'tie', winnerName = null, loserName = null;
    if (a > b) { winnerSide = kA; winnerName = m.player1; loserName = m.player2; }
    else if (b > a) { winnerSide = kB; winnerName = m.player2; loserName = m.player1; }
    return { a, b, kA, kB, winnerSide, winnerName, loserName, margin: Math.abs(a - b), perfect: Math.max(a, b) === 2 && Math.min(a, b) === 0 };
  }

  function summary(t, ti) {
    const matches = t.matches || [];
    let greenMatch = 0, redMatch = 0, halvedMatch = 0;
    const perfect = { green: [], red: [] };
    matches.forEach(m => {
      const o = outcome(m);
      if (o.winnerSide === 'green') greenMatch++;
      else if (o.winnerSide === 'red') redMatch++;
      else halvedMatch++;
      if (o.perfect && o.winnerSide !== 'tie') perfect[o.winnerSide].push(o.winnerName);
    });

    // Stat cards
    let html = `<div class="section-header"><h2>Tournament Summary</h2></div>`;
    html += `<div class="recap-stats">
      <div class="recap-stat">
        <div class="recap-stat-label">Final Score</div>
        <div class="recap-stat-value"><span class="hsc-green-text">${ti.green.score}</span> <span class="rs-sep">–</span> <span class="hsc-red-text">${ti.red.score}</span></div>
        <div class="recap-stat-sub">Team ${esc(ti.green.name)} vs Team ${esc(ti.red.name)}</div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Match Record</div>
        <div class="recap-stat-value">${greenMatch} <span class="rs-sep">·</span> ${halvedMatch} <span class="rs-sep">·</span> ${redMatch}</div>
        <div class="recap-stat-sub">${esc(ti.green.name)} wins · halved · ${esc(ti.red.name)} wins</div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-label">Format</div>
        <div class="recap-stat-value">6 <span class="rs-sep">×</span> 1v1</div>
        <div class="recap-stat-sub">2 points each · front &amp; back nine</div>
      </div>
    </div>`;

    // Highlights (computed, factual)
    const bullets = [];
    const winnerTeam = ti.green.score > ti.red.score ? ti.green : ti.red;
    const winMatches = ti.green.score > ti.red.score ? greenMatch : redMatch;
    if (winMatches) bullets.push(`Team ${esc(winnerTeam.name)} took ${winMatches} of ${matches.length} matches.`);
    const allPerfect = perfect.green.concat(perfect.red);
    if (allPerfect.length) {
      const label = allPerfect.length === 1 ? 'A perfect 2–0 round' : `${allPerfect.length} perfect 2–0 rounds`;
      bullets.push(`${label}: ${allPerfect.map(esc).join(', ')}.`);
    }
    if (halvedMatch) {
      const halvedMatches = matches.filter(m => outcome(m).winnerSide === 'tie')
        .map(m => `${esc(m.player1)} & ${esc(m.player2)}`);
      bullets.push(`${halvedMatch === 1 ? 'One match was halved' : halvedMatch + ' matches were halved'}: ${halvedMatches.join('; ')}.`);
    }
    // Points that went against the run of play (the losing team's best results)
    const loseTeamKey = ti.green.score > ti.red.score ? 'red' : 'green';
    const bright = matches.map(outcome).filter(o => o.winnerSide === loseTeamKey).map(o => esc(o.winnerName));
    if (bright.length) {
      const loseName = loseTeamKey === 'green' ? ti.green.name : ti.red.name;
      bullets.push(`Team ${esc(loseName)}'s match win${bright.length > 1 ? 's' : ''} came from ${bright.join(', ')}.`);
    }

    if (bullets.length) {
      html += `<ul class="recap-highlights">` + bullets.map(b => `<li>${b}</li>`).join('') + `</ul>`;
    }

    // Compact results table
    html += `<div class="recap-results">`;
    matches.forEach(m => {
      const o = outcome(m);
      const p1cls = o.winnerSide === o.kA && o.winnerSide !== 'tie' ? 'rr-win' : '';
      const p2cls = o.winnerSide === o.kB && o.winnerSide !== 'tie' ? 'rr-win' : '';
      const fmt = n => (n % 1 === 0 ? String(n) : (Math.floor(n) ? Math.floor(n) + '½' : '½'));
      html += `<div class="recap-row">
        <span class="rr-p rr-left rr-${o.kA} ${p1cls}">${esc(m.player1)}</span>
        <span class="rr-score">${fmt(o.a)} <span class="rr-dash">–</span> ${fmt(o.b)}</span>
        <span class="rr-p rr-right rr-${o.kB} ${p2cls}">${esc(m.player2)}</span>
      </div>`;
    });
    html += `</div>`;

    if (t.notes) html += `<p class="recap-note">${esc(t.notes)}</p>`;
    return html;
  }

  function matchDetail(t) {
    let html = `<div class="section-header"><h2>Match Detail</h2></div>`;
    (t.matches || []).forEach(m => {
      const o = outcome(m);
      const p1win = o.winnerSide === o.kA && o.winnerSide !== 'tie';
      const p2win = o.winnerSide === o.kB && o.winnerSide !== 'tie';
      const p1Label = `<span class="h-name">${esc(m.player1)}${m.result ? ' <span class="h-score">(' + m.result.p1 + ')</span>' : ''}</span>`;
      const p2Label = `<span class="h-name">${esc(m.player2)}${m.result ? ' <span class="h-score">(' + m.result.p2 + ')</span>' : ''}</span>`;
      html += `<div class="history-match">`;
      html += `<div class="h-player ${p1win ? 'h-winner' : ''}">${p1Label}${avatar(m.player1)}</div>`;
      html += `<div class="h-vs">vs</div>`;
      html += `<div class="h-player ${p2win ? 'h-winner' : ''}">${avatar(m.player2)}${p2Label}</div>`;
      html += `</div>`;
      html += holeScorecard(m);
    });
    return html;
  }

  function holeScorecard(m) {
    if (!m || !m.holes) return '';
    const played = Object.keys(COURSE_PARS).some(h => {
      const v = m.holes[h];
      return v === 0 || v === 1 || v === 0.5;
    });
    if (!played) return '';

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
        <div class="hsc-nine-label">${label}<span class="hsc-nine-res">${esc(res)}</span></div>
        <div class="hsc-row">${cells}</div>
      </div>`;
    };

    const legend = `<div class="hsc-legend">
      <span class="hsc-chip ${sideClass(m.side1)}">${esc(m.player1)}</span>
      <span class="hsc-chip ${sideClass(m.side2)}">${esc(m.player2)}</span>
      <span class="hsc-chip hsc-tie">Tie</span>
    </div>`;

    return `<div class="h-scorecard">
      ${legend}
      ${nine(1, 9, 'Front 9', m.front9)}
      ${nine(10, 18, 'Back 9', m.back9)}
    </div>`;
  }
})();
