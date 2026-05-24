import { explainProjection, scoreProjection, round } from "../valuation/scoring.mjs";
import {
  sourceConfidenceForPlayer,
  sourceTraceForPlayer,
  sourceWarningForRecommendation,
} from "./sourceConfidence.mjs";
import { scoreStrategyPreference } from "./strategyPreferences.mjs";

const FLEX_POSITIONS = new Set(["RB", "WR", "TE"]);
const REPLACEMENT_DEPTH = { QB: 10, RB: 28, WR: 34, TE: 10, K: 8, DST: 8 };

export function createDraftState(league, teams, players) {
  return {
    league,
    teams: teams.map((team) => ({ ...team, picks: [] })),
    players: players.map((player) => ({
      ...player,
      projectedPoints: round(Number.isFinite(player.projectedPoints) ? player.projectedPoints : scoreProjection(player.stats, league.scoring), 2),
    })),
    drafted: [],
    currentPick: 1,
    log: [],
  };
}

export function getTeamForPick(league, pickNumber) {
  const round = Math.ceil(pickNumber / league.teams);
  const indexInRound = (pickNumber - 1) % league.teams;
  const slot = round % 2 === 1 ? indexInRound + 1 : league.teams - indexInRound;
  return `team_${slot}`;
}

export function isUserTurn(state) {
  return getTeamForPick(state.league, state.currentPick) === state.league.userTeamId;
}

export function getAvailablePlayers(state) {
  const draftedIds = new Set(state.drafted.map((pick) => pick.playerId));
  return state.players.filter((player) => !draftedIds.has(player.playerId));
}

export function getTeamRoster(state, teamId) {
  const playerById = new Map(state.players.map((player) => [player.playerId, player]));
  const team = state.teams.find((candidate) => candidate.teamId === teamId);
  return (team?.picks ?? []).map((pick) => playerById.get(pick.playerId)).filter(Boolean);
}

export function draftPlayer(state, playerId, teamId = getTeamForPick(state.league, state.currentPick), source = "mock") {
  const player = state.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  if (state.drafted.some((pick) => pick.playerId === playerId)) throw new Error(`${player.name} is already drafted`);

  const pick = {
    pickNumber: state.currentPick,
    round: Math.ceil(state.currentPick / state.league.teams),
    teamId,
    playerId,
    source,
  };

  const team = state.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) throw new Error(`Unknown team: ${teamId}`);
  team.picks.push(pick);
  state.drafted.push(pick);
  state.log.push({ type: "player_drafted", pick, playerName: player.name });
  state.currentPick += 1;
  return pick;
}

export function undoLastPick(state) {
  const pick = state.drafted.pop();
  if (!pick) return null;

  const team = state.teams.find((candidate) => candidate.teamId === pick.teamId);
  if (team) {
    const pickIndex = team.picks.findIndex((candidate) => candidate.pickNumber === pick.pickNumber);
    if (pickIndex >= 0) team.picks.splice(pickIndex, 1);
  }

  state.currentPick = pick.pickNumber;
  state.log.push({ type: "pick_undone", pick });
  return pick;
}

export function getReplacementValues(state) {
  const available = getAvailablePlayers(state);
  const values = {};

  for (const position of ["QB", "RB", "WR", "TE", "K", "DST"]) {
    const ranked = available
      .filter((player) => player.position === position)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    const replacement = ranked[Math.min(REPLACEMENT_DEPTH[position] - 1, ranked.length - 1)];
    values[position] = replacement?.projectedPoints ?? 0;
  }

  return values;
}

export function scoreRosterFit(league, roster, candidate) {
  const positionCounts = countPositions(roster);
  const startersNeeded = {
    QB: Math.max(0, league.rosterSlots.QB - (positionCounts.QB ?? 0)),
    RB: Math.max(0, league.rosterSlots.RB - (positionCounts.RB ?? 0)),
    WR: Math.max(0, league.rosterSlots.WR - (positionCounts.WR ?? 0)),
    TE: Math.max(0, league.rosterSlots.TE - (positionCounts.TE ?? 0)),
    K: Math.max(0, league.rosterSlots.K - (positionCounts.K ?? 0)),
    DST: Math.max(0, league.rosterSlots.DST - (positionCounts.DST ?? 0)),
  };

  const directNeed = startersNeeded[candidate.position] > 0 ? 10 : 0;
  const flexNeed = FLEX_POSITIONS.has(candidate.position) && openFlexSlots(league, positionCounts) > 0 ? 5 : 0;
  const earlyKickerDefensePenalty = ["K", "DST"].includes(candidate.position) && roster.length < 6 ? -16 : 0;
  const depthPenalty = (positionCounts[candidate.position] ?? 0) >= 4 ? -4 : 0;

  return directNeed + flexNeed + earlyKickerDefensePenalty + depthPenalty;
}

export function recommendPlayers(state, teamId = state.league.userTeamId, limit = 5, options = {}) {
  const available = getAvailablePlayers(state);
  const roster = getTeamRoster(state, teamId);
  const replacement = getReplacementValues(state);
  const picksUntilNext = estimatePicksUntilNextTurn(state);
  const strategyPreferences = options.strategyPreferences ?? state.league.strategyPreferences ?? {};

  const scored = available.map((player) => {
    const valueOverReplacement = player.projectedPoints - (replacement[player.position] ?? 0);
    const rosterPressure = scoreRosterCompletionPressure(state.league, roster, player);
    const marginalTeamValue = Math.max(0, valueOverReplacement) + scoreRosterFit(state.league, roster, player) + rosterPressure;
    const scarcityUrgency = getScarcityUrgency(available, player, picksUntilNext);
    const marketValueEdge = Math.max(-8, Math.min(12, player.adp - state.currentPick));
    const ceilingAdjustment = player.ceiling;
    const rosterConstructionFit = scoreRosterFit(state.league, roster, player) / 2;
    const opponentBlockingValue = estimateOpponentNeed(state, player, picksUntilNext);
    const riskPenalty = player.risk;
    const sourceConfidence = sourceConfidenceForPlayer(player);
    const strategyPreference = scoreStrategyPreference({
      preferences: strategyPreferences,
      roster,
      player,
      currentPick: state.currentPick,
    });
    const finalScore =
      0.35 * marginalTeamValue +
      0.20 * valueOverReplacement +
      0.15 * scarcityUrgency +
      0.10 * marketValueEdge +
      0.10 * ceilingAdjustment +
      0.05 * rosterConstructionFit +
      0.05 * opponentBlockingValue -
      riskPenalty +
      (sourceConfidence - 0.7) * 2 +
      strategyPreference.adjustment;

    return {
      player,
      finalScore: round(finalScore, 1),
      projectedPoints: round(player.projectedPoints, 1),
      projectionExplanation: summarizeProjectionExplanation(player.stats, state.league.scoring),
      valueOverReplacement: round(valueOverReplacement, 1),
      marginalTeamValue: round(marginalTeamValue, 1),
      scarcityUrgency: round(scarcityUrgency, 1),
      marketValueEdge: round(marketValueEdge, 1),
      ceilingAdjustment: round(ceilingAdjustment, 1),
      rosterConstructionFit: round(rosterConstructionFit, 1),
      rosterPressure: round(rosterPressure, 1),
      opponentBlockingValue: round(opponentBlockingValue, 1),
      riskPenalty: round(riskPenalty, 1),
      strategyPreference,
      sourceConfidence: round(sourceConfidence, 2),
      sourceTrace: sourceTraceForPlayer(player),
      sourceWarning: sourceWarningForRecommendation(player, valueOverReplacement),
      survivalProbability: round(estimateSurvivalProbability(state, player, picksUntilNext), 2),
      pros: buildPros(state, roster, player, valueOverReplacement, scarcityUrgency),
      cons: buildCons(state, roster, player),
      whyNow: buildWhyNow(state, player, scarcityUrgency, picksUntilNext),
    };
  });

  return scored.sort((a, b) => b.finalScore - a.finalScore).slice(0, limit);
}

export function scoreRosterCompletionPressure(league, roster, candidate) {
  const positionCounts = countPositions(roster);
  const requiredSlots = {
    QB: league.rosterSlots.QB ?? 0,
    RB: league.rosterSlots.RB ?? 0,
    WR: league.rosterSlots.WR ?? 0,
    TE: league.rosterSlots.TE ?? 0,
    K: league.rosterSlots.K ?? 0,
    DST: league.rosterSlots.DST ?? 0,
  };
  const missingByPosition = Object.fromEntries(Object.entries(requiredSlots).map(([position, required]) => [
    position,
    Math.max(0, required - (positionCounts[position] ?? 0)),
  ]));
  const missingRequired = Object.values(missingByPosition).reduce((sum, value) => sum + value, 0);
  const remainingPicks = league.draft.rounds - roster.length;
  const fillsRequiredSlot = (missingByPosition[candidate.position] ?? 0) > 0;

  if (missingRequired === 0) return 0;
  if (remainingPicks <= missingRequired && !fillsRequiredSlot) return -250;
  if (remainingPicks <= missingRequired && fillsRequiredSlot) return 160;
  if (remainingPicks <= missingRequired + 1 && fillsRequiredSlot) return 90;
  if (remainingPicks <= missingRequired + 2 && fillsRequiredSlot) return 45;
  if (roster.length >= Math.max(5, league.draft.rounds - 4) && fillsRequiredSlot) return 25;
  return 0;
}

export function autoPickForCurrentTeam(state) {
  const teamId = getTeamForPick(state.league, state.currentPick);
  const recommendations = recommendPlayers(state, teamId, 1);
  const pick = recommendations[0];
  if (!pick) return null;
  draftPlayer(state, pick.player.playerId, teamId, "mock_auto");
  return pick;
}

export function runMockUntilUserTurn(state) {
  while (!isUserTurn(state) && state.currentPick <= getMaxDraftPicks(state)) {
    const pick = autoPickForCurrentTeam(state);
    if (!pick) break;
  }
  return state;
}

export function getMaxDraftPicks(state) {
  return Math.min(state.league.teams * state.league.draft.rounds, state.players.length);
}

function countPositions(roster) {
  return roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function openFlexSlots(league, positionCounts) {
  const extraRb = Math.max(0, (positionCounts.RB ?? 0) - league.rosterSlots.RB);
  const extraWr = Math.max(0, (positionCounts.WR ?? 0) - league.rosterSlots.WR);
  const extraTe = Math.max(0, (positionCounts.TE ?? 0) - league.rosterSlots.TE);
  return Math.max(0, league.rosterSlots.FLEX - extraRb - extraWr - extraTe);
}

function estimatePicksUntilNextTurn(state) {
  const current = state.currentPick;
  for (let pick = current + 1; pick <= state.league.teams * state.league.draft.rounds; pick += 1) {
    if (getTeamForPick(state.league, pick) === state.league.userTeamId) {
      return pick - current;
    }
  }
  return state.league.teams;
}

function getScarcityUrgency(available, player, picksUntilNext) {
  const samePosition = available
    .filter((candidate) => candidate.position === player.position)
    .sort((a, b) => b.projectedPoints - a.projectedPoints);
  const rank = samePosition.findIndex((candidate) => candidate.playerId === player.playerId);
  const nextTierPlayer = samePosition[Math.min(rank + Math.max(1, Math.floor(picksUntilNext / 3)), samePosition.length - 1)];
  const drop = player.projectedPoints - (nextTierPlayer?.projectedPoints ?? player.projectedPoints);
  return Math.max(0, drop);
}

function estimateOpponentNeed(state, player, picksUntilNext) {
  let need = 0;
  for (let offset = 0; offset < picksUntilNext; offset += 1) {
    const pickNumber = state.currentPick + offset;
    const teamId = getTeamForPick(state.league, pickNumber);
    if (teamId === state.league.userTeamId) continue;
    const roster = getTeamRoster(state, teamId);
    need += Math.max(0, scoreRosterFit(state.league, roster, player));
  }
  return need / Math.max(1, picksUntilNext);
}

function estimateSurvivalProbability(state, player, picksUntilNext) {
  const marketPressure = Math.max(0.05, Math.min(0.75, (state.currentPick + picksUntilNext - player.adp) / 18 + 0.25));
  const needPressure = Math.max(0, Math.min(0.2, estimateOpponentNeed(state, player, picksUntilNext) / 60));
  const perPickSelection = Math.min(0.85, marketPressure + needPressure);
  return Math.max(0.01, Math.min(0.99, (1 - perPickSelection / Math.max(1, picksUntilNext)) ** picksUntilNext));
}

function summarizeProjectionExplanation(stats, scoring) {
  const explanation = explainProjection(stats, scoring);
  return {
    total: round(explanation.total, 1),
    components: explanation.components
      .slice()
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
      .slice(0, 4)
      .map((component) => ({
        ...component,
        points: round(component.points, 1),
      })),
  };
}

function buildPros(state, roster, player, valueOverReplacement, scarcityUrgency) {
  const pros = [];
  if (valueOverReplacement > 15) pros.push("Strong value over league-specific replacement level.");
  if (scoreRosterFit(state.league, roster, player) > 8) pros.push(`Directly fills a ${player.position} starter need.`);
  if (scarcityUrgency > 10) pros.push(`Meaningful ${player.position} tier drop after this range.`);
  if (player.adp > state.currentPick + 5) pros.push("Market value edge versus ADP.");
  if (pros.length === 0) pros.push("Good blended value without forcing roster construction.");
  return pros;
}

function buildCons(state, roster, player) {
  const cons = [];
  if (player.risk >= 4) cons.push("Higher role or injury volatility than nearby alternatives.");
  if (["K", "DST"].includes(player.position) && roster.length < 6) cons.push("Kicker/defense is usually replaceable this early.");
  if (scoreRosterFit(state.league, roster, player) <= 0) cons.push("Does not solve an immediate roster need.");
  if (cons.length === 0) cons.push("Main risk is opportunity cost if another position dries up.");
  return cons;
}

function buildWhyNow(state, player, scarcityUrgency, picksUntilNext) {
  if (scarcityUrgency > 10) return `${player.position} scarcity is rising and ${picksUntilNext} picks pass before your next turn.`;
  if (player.adp <= state.currentPick + 3) return "This player is in the expected draft window now.";
  return "The score balances player value, roster fit, and availability risk.";
}
