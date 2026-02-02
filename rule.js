document.addEventListener('DOMContentLoaded', () => {
  const triggers = Array.from(document.querySelectorAll('[data-matchup-id]'));
  if (!triggers.length) return;

  fetch(`./data.json?t=${Date.now()}`, { cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      const matchesById = new Map(data.matches.map(match => [String(match.id), match]));

      triggers.forEach(button => {
        button.addEventListener('click', () => {
          const match = matchesById.get(button.dataset.matchupId);
          if (!match) return;
          showMatchupModal(match, data);
        });
      });
    })
    .catch(error => {
      console.error('Error loading matchup data:', error);
      triggers.forEach(button => {
        button.disabled = true;
        button.textContent = 'Matchup data unavailable';
      });
    });
});
