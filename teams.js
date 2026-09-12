/* ======================================================
   SHARED TEAM MODEL — The Classic
   ------------------------------------------------------
   Team identity is data-driven so captains can change each
   year without touching code. There are two permanent
   slots — "green" and "red" — and whichever players carry
   captain:true name those teams.

   RYDER CUP PAINT: the slot keys are legacy names, but the
   "green" slot flies RED (Team Red) and the "red" slot flies
   BLUE (Team Blue). Only the paint/labels changed; the data
   keys stay green/red so nothing had to be migrated.

   A player's `team` is "green" | "red" | null (undrafted).
   Captains carry team + captain:true and are NOT counted
   as draft picks.

   Usage:  var T = ClassicTeams(data);
           T.green.label   -> "Team Red"
           T.green.short   -> "RED"
           T.green.captain -> "Gavin"
           T.color("green")-> "#cc1f2d"
           T.sideOf(player)-> "green" | "red" | null
   ====================================================== */
(function () {
  // slot key -> Ryder Cup color
  var COLORS = { green: "#cc1f2d", red: "#2a5fce" };   // green slot = RED, red slot = BLUE
  var LABELS = { green: "Team Red", red: "Team Blue" };
  var SHORT  = { green: "RED", red: "BLUE" };

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

    function captain(team) {
      return (caps[team] && caps[team].name) || "";
    }

    function side(team) {
      return {
        team: team,
        color: COLORS[team],
        label: LABELS[team],           // "Team Red" / "Team Blue"
        short: SHORT[team],            // "RED" / "BLUE"
        captain: captain(team),        // "Gavin" / "Bel"
        name: captain(team),           // back-compat: captain name
        key: caps[team] && caps[team].key
      };
    }

    return {
      colors: COLORS,
      green: side("green"),
      red: side("red"),
      label: function (team) { return LABELS[team] || "Team"; },
      short: function (team) { return SHORT[team] || ""; },
      captain: captain,
      name: captain,
      color: function (team) { return COLORS[team] || COLORS.green; },
      // Which slot a player counts for (green/red), or null if undrafted.
      sideOf: function (p) { return (p && (p.team === "green" || p.team === "red")) ? p.team : null; },
      isCaptain: function (p) { return !!(p && p.captain); }
    };
  }

  window.ClassicTeams = ClassicTeams;
})();
