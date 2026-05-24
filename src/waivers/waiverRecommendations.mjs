import { getAvailablePlayers, getTeamRoster, scoreRosterFit } from "../draft/draftEngine.mjs";

export function recommendWaiverPickups(state, teamId = state.league.userTeamId, options = {}) {
  const limit = options.limit ?? 10;
  const roster = getTeamRoster(state, teamId);
  const available = getAvailablePlayers(state);
  const rosterFloor = getReplacementFloor(roster);

  return available
    .map((player) => {
      const rosterFit = scoreRosterFit(state.league, roster, player);
      const replacement = rosterFloor[player.position] ?? 0;
      const upgradeValue = Math.max(0, (player.projectedPoints ?? 0) - replacement);
      const upside = player.ceiling ?? 0;
      const riskPenalty = player.risk ?? 0;
      const score = round(upgradeValue * 0.55 + rosterFit * 0.25 + upside * 0.15 - riskPenalty * 0.05, 1);
      return {
        player: toWaiverPlayer(player),
        score,
        upgradeValue: round(upgradeValue, 1),
        rosterFit: round(rosterFit, 1),
        upside: round(upside, 1),
        riskPenalty: round(riskPenalty, 1),
        reasoning: buildWaiverReason(player, upgradeValue, rosterFit),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreDropCandidates(state, teamId = state.league.userTeamId, options = {}) {
  const limit = options.limit ?? 5;
  const roster = getTeamRoster(state, teamId);
  return roster
    .map((player) => ({
      player: toWaiverPlayer(player),
      dropScore: round((player.projectedPoints ?? 0) - (player.risk ?? 0) + (player.ceiling ?? 0) * 0.25, 1),
      reason: `${player.position} depth with ${round(player.projectedPoints ?? 0, 1)} projected points.`,
    }))
    .sort((a, b) => a.dropScore - b.dropScore)
    .slice(0, limit);
}

function getReplacementFloor(roster) {
  const grouped = {};
  for (const player of roster) {
    if (!grouped[player.position]) grouped[player.position] = [];
    grouped[player.position].push(player);
  }

  return Object.fromEntries(Object.entries(grouped).map(([position, players]) => {
    const lowest = players.slice().sort((a, b) => (a.projectedPoints ?? 0) - (b.projectedPoints ?? 0))[0];
    return [position, lowest?.projectedPoints ?? 0];
  }));
}

function buildWaiverReason(player, upgradeValue, rosterFit) {
  if (rosterFit >= 10) return `${player.position} fills an open starting need.`;
  if (upgradeValue > 20) return `${player.position} projects as a clear upgrade over current depth.`;
  return `${player.position} adds depth or upside without requiring a production action.`;
}

function toWaiverPlayer(player) {
  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    team: player.team,
    projectedPoints: round(player.projectedPoints ?? 0, 1),
  };
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
