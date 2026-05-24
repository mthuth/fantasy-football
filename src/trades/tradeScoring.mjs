import { getTeamRoster } from "../draft/draftEngine.mjs";
import { buildLeagueRosterSnapshot } from "../draft/leagueRosters.mjs";

export function scoreTradeProposal(state, proposal) {
  const fromTeamId = proposal.fromTeamId ?? state.league.userTeamId;
  const toTeamId = proposal.toTeamId;
  const giving = hydratePlayers(state, proposal.givePlayerIds ?? []);
  const receiving = hydratePlayers(state, proposal.receivePlayerIds ?? []);
  const fromRoster = getTeamRoster(state, fromTeamId);
  const toRoster = getTeamRoster(state, toTeamId);
  const userDelta = sumProjection(receiving) - sumProjection(giving);
  const partnerDelta = sumProjection(giving) - sumProjection(receiving);
  const userNeedFit = scoreNeedFit(state.league, fromRoster, receiving) - scoreNeedFit(state.league, fromRoster, giving);
  const partnerNeedFit = scoreNeedFit(state.league, toRoster, giving) - scoreNeedFit(state.league, toRoster, receiving);
  const fairness = 100 - Math.min(100, Math.abs(userDelta - partnerDelta));
  const totalScore = round(userDelta * 0.45 + userNeedFit * 0.30 + fairness * 0.15 + partnerNeedFit * 0.10, 1);

  return {
    fromTeamId,
    toTeamId,
    giving: giving.map(toTradePlayer),
    receiving: receiving.map(toTradePlayer),
    totalScore,
    userDelta: round(userDelta, 1),
    partnerDelta: round(partnerDelta, 1),
    userNeedFit: round(userNeedFit, 1),
    partnerNeedFit: round(partnerNeedFit, 1),
    fairness: round(fairness, 1),
    recommendation: totalScore >= 10 ? "favorable" : totalScore >= -5 ? "neutral" : "unfavorable",
  };
}

export function findTradePartners(state, teamId = state.league.userTeamId) {
  const snapshot = buildLeagueRosterSnapshot(state);
  const userTeam = snapshot.teams.find((team) => team.teamId === teamId);
  if (!userTeam) return [];
  const userSurplus = surplusPositions(userTeam.rosterCounts, state.league);

  return snapshot.teams
    .filter((team) => team.teamId !== teamId)
    .map((team) => {
      const matchingNeeds = Object.entries(team.openSlots)
        .filter(([position, count]) => count > 0 && userSurplus.includes(position))
        .map(([position]) => position);
      return {
        teamId: team.teamId,
        teamKey: team.teamKey,
        name: team.name,
        matchingNeeds,
        fitScore: matchingNeeds.length * 10 + team.pickCount,
      };
    })
    .filter((partner) => partner.matchingNeeds.length > 0)
    .sort((a, b) => b.fitScore - a.fitScore);
}

function hydratePlayers(state, playerIds) {
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  return playerIds.map((playerId) => playerById.get(playerId)).filter(Boolean);
}

function scoreNeedFit(league, roster, players) {
  const counts = countPositions(roster);
  return players.reduce((score, player) => {
    const required = league.rosterSlots[player.position] ?? 0;
    const fillsOpenStarter = required > (counts[player.position] ?? 0);
    return score + (fillsOpenStarter ? 12 : 4);
  }, 0);
}

function surplusPositions(counts, league) {
  return ["QB", "RB", "WR", "TE"].filter((position) => (counts[position] ?? 0) > (league.rosterSlots[position] ?? 0) + 1);
}

function countPositions(roster) {
  return roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function sumProjection(players) {
  return players.reduce((sum, player) => sum + (player.projectedPoints ?? 0), 0);
}

function toTradePlayer(player) {
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
