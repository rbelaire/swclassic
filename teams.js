/* ======================================================
   SHARED TEAM MODEL — The Classic
   ------------------------------------------------------
   Team identity is data-driven so captains can change each
   year without touching code. There are two permanent
   color slots — "green" and "red" — and whichever players
   carry captain:true name those teams.

   A player's `team` is "green" | "red" | null (undrafted).
   Captains carry team + captain:true and are NOT counted
   as draft picks.

   Usage:  var T = ClassicTeams(data);
           T.green.name  -> "Gavin"
           T.color("red") -> "#c22e2e"
           T.sideOf(player) -> "green" | "red" | null
   ====================================================== */
(function () {
  var COLORS = { green: "#0b6b3a", red: "#c22e2e" };

  function ClassicTeams(data) {
    var players = (data && data.players) || {};
    var caps = { green: null, red: null };

    Object.keys(players).forEach(function (id) {
      var p = players[id];
      if (!p) return;
      if (p.captain && (p.team === "green" || p.team === "red") && !caps[p.team]) {
        caps[p.team] = { key: id, name: p.name };
      }
    });

    function name(team) {
      if (caps[team] && caps[team].name) return caps[team].name;
      return team === "red" ? "Red" : "Green";
    }

    return {
      colors: COLORS,
      green: { team: "green", color: COLORS.green, name: name("green"), key: caps.green && caps.green.key },
      red:   { team: "red",   color: COLORS.red,   name: name("red"),   key: caps.red && caps.red.key },
      name: name,
      color: function (team) { return team === "red" ? COLORS.red : COLORS.green; },
      // Which color side a player counts for (green/red), or null if undrafted.
      sideOf: function (p) { return (p && (p.team === "green" || p.team === "red")) ? p.team : null; },
      isCaptain: function (p) { return !!(p && p.captain); }
    };
  }

  window.ClassicTeams = ClassicTeams;
})();
