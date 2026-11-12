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

  // ---- 2v2 match helpers --------------------------------------------
  // A match is one pair per side. `playerIds[i]` is the lead player for side i
  // (side 0 = "green" slot / Team Red, side 1 = "red" slot / Team Blue) and
  // `partnerIds[i]` is that side's partner. Keeping the lead in `playerIds`
  // means every team/side lookup written for 1v1 still works.
  // Field size is a setting (meta.format.playersPerTeam = players per team INCLUDING
  // the captain), so the same code runs 6v6 or 8v8. A pair is two players, so
  // matches = teamSize / 2 and the draft has 2 * (teamSize - 1) picks.
  ClassicTeams.teamSize = function (data) {
    var f = data && data.meta && data.meta.format;
    var n = f && +f.playersPerTeam;
    if (n >= 4 && n % 2 === 0) return n;
    var m = data && data.matches ? data.matches.length : 0;
    return m ? m * 2 : 6;
  };
  ClassicTeams.pickLimit = function (data) { return ClassicTeams.teamSize(data) - 1; };   // picks per team
  ClassicTeams.pickCount = function (data) { return ClassicTeams.pickLimit(data) * 2; };  // picks in the draft

  // Every match is worth three points: front nine, back nine, and the overall
  // 18 holes. Older archived matches have no `total`, so readers skip nulls.
  ClassicTeams.POINT_KEYS = ["front9", "back9", "total"];

  ClassicTeams.FORMAT = {
    front9: { key: "scramble", label: "Scramble", short: "SCR" },
    back9: { key: "altshot", label: "Alternate Shot", short: "ALT" }
  };

  // Ids on one side of a match, lead first. Empty slots are dropped.
  ClassicTeams.pairIds = function (match, side) {
    var lead = match && match.playerIds ? match.playerIds[side] : null;
    var mate = match && match.partnerIds ? match.partnerIds[side] : null;
    return [lead, mate].filter(Boolean);
  };

  // Display names for one side, e.g. "Gavin & Austin". Unknown ids are skipped;
  // returns "" when nobody is set so callers can substitute their own "TBD".
  ClassicTeams.pairName = function (match, side, players, sep) {
    players = players || {};
    return ClassicTeams.pairIds(match, side)
      .map(function (id) { return players[id] ? players[id].name : ""; })
      .filter(Boolean)
      .join(sep || " & ");
  };

  window.ClassicTeams = ClassicTeams;
})();
