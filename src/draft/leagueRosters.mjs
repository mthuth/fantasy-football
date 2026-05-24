const TRACKED_POSITIONS = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST", "BENCH"];
const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);

export function buildLeagueRosterSnapshot(state) {
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  return {
    leagueKey: state.league.leagueKey ?? state.league.leagueId,
    leagueId: state.league.leagueId,
    leagueName: state.league.name,
    currentPick: state.currentPick,
    teams: state.teams.map((team) => {
      const roster = (team.picks ?? [])
        .map((pick) => {
          const player = playerById.get(pick.playerId);
          return player ? { ...player, pickNumber: pick.pickNumber, source: pick.source } : null;
        })
        .filter(Boolean);
      const counts = countPositions(roster);
      return {
        teamId: team.teamId,
        teamKey: team.teamKey ?? team.yahooTeamKey ?? null,
        name: team.name,
        draftSlot: team.draftSlot,
        isUserTeam: team.teamId === state.league.userTeamId,
        pickCount: roster.length,
        rosterCounts: counts,
        openSlots: calculateOpenSlots(state.league, counts),
        roster: roster.map(toRosterPlayer),
        starters: roster.filter((player) => isLikelyStarter(state.league, counts, player)).map(toRosterPlayer),
      };
    }),
  };
}

function calculateOpenSlots(league, counts) {
  const open = {};
  for (const position of TRACKED_POSITIONS) {
    const required = league.rosterSlots?.[position] ?? 0;
    if (!required) continue;

    if (position === "FLEX") {
      const extraFlexEligible = Math.max(0, (counts.RB ?? 0) - (league.rosterSlots.RB ?? 0)) +
        Math.max(0, (counts.WR ?? 0) - (league.rosterSlots.WR ?? 0)) +
        Math.max(0, (counts.TE ?? 0) - (league.rosterSlots.TE ?? 0));
      open[position] = Math.max(0, required - extraFlexEligible);
    } else {
      open[position] = Math.max(0, required - (counts[position] ?? 0));
    }
  }
  return open;
}

function isLikelyStarter(league, counts, player) {
  if ((league.rosterSlots[player.position] ?? 0) > 0) {
    return (counts[player.position] ?? 0) <= league.rosterSlots[player.position];
  }
  return FLEX_POSITIONS.has(player.position) && (league.rosterSlots.FLEX ?? 0) > 0;
}

function countPositions(roster) {
  return roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function toRosterPlayer(player) {
  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    team: player.team,
    bye: player.bye,
    projectedPoints: player.projectedPoints,
    pickNumber: player.pickNumber,
    source: player.source,
  };
}
