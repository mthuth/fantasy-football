import {
  createDraftState,
  draftPlayer,
  getAvailablePlayers,
  getMaxDraftPicks,
  getTeamForPick,
  isUserTurn,
  recommendPlayers,
} from "./draftEngine.mjs";
import { buildSimulationReport } from "./reporting.mjs";

const DEFAULT_STRATEGY_IDS = ["balanced", "safe", "upside", "scarcity"];

const STRATEGIES = {
  balanced: {
    label: "Balanced",
    pickRecommendation: (recommendations) => recommendations[0],
  },
  upside: {
    label: "Upside",
    pickRecommendation: (recommendations) => {
      const topTier = recommendations.filter((option) => option.finalScore >= recommendations[0].finalScore - 4);
      return topTier.slice().sort((a, b) =>
        b.ceilingAdjustment - a.ceilingAdjustment ||
        b.scarcityUrgency - a.scarcityUrgency ||
        b.finalScore - a.finalScore
      )[0];
    },
  },
  safe: {
    label: "Safe Floor",
    pickRecommendation: (recommendations) => {
      const topTier = recommendations.filter((option) => option.finalScore >= recommendations[0].finalScore - 4);
      return topTier.slice().sort((a, b) =>
        a.riskPenalty - b.riskPenalty ||
        b.sourceConfidence - a.sourceConfidence ||
        b.finalScore - a.finalScore
      )[0];
    },
  },
  scarcity: {
    label: "Scarcity",
    pickRecommendation: (recommendations) => {
      const topTier = recommendations.filter((option) => option.finalScore >= recommendations[0].finalScore - 5);
      return topTier.slice().sort((a, b) =>
        b.scarcityUrgency - a.scarcityUrgency ||
        b.valueOverReplacement - a.valueOverReplacement ||
        b.finalScore - a.finalScore
      )[0];
    },
  },
};

const OPPONENT_PROFILES = {
  agent: {
    label: "Agent-like",
    pickPlayer: (state, teamId) => recommendPlayers(state, teamId, 1)[0]?.player,
  },
  adp: {
    label: "ADP Room",
    pickPlayer: (state) => getAvailablePlayers(state).slice().sort((a, b) => a.adp - b.adp)[0],
  },
  rb_heavy: {
    label: "RB Heavy",
    pickPlayer: (state, teamId) => pickBiasedPlayer(state, teamId, ["RB", "RB", "WR", "TE", "QB"]),
  },
  wr_heavy: {
    label: "WR Heavy",
    pickPlayer: (state, teamId) => pickBiasedPlayer(state, teamId, ["WR", "WR", "RB", "TE", "QB"]),
  },
  qb_early: {
    label: "QB Early",
    pickPlayer: (state, teamId) => {
      const rosterSize = getRosterSize(state, teamId);
      return rosterSize < 4
        ? pickBiasedPlayer(state, teamId, ["QB", "RB", "WR", "TE"])
        : OPPONENT_PROFILES.adp.pickPlayer(state, teamId);
    },
  },
};

export function getSimulationStrategies() {
  return Object.entries(STRATEGIES).map(([id, strategy]) => ({ id, label: strategy.label }));
}

export function getOpponentProfiles() {
  return Object.entries(OPPONENT_PROFILES).map(([id, profile]) => ({ id, label: profile.label }));
}

export function buildSimulationScenario(baseLeague, options = {}) {
  const teamCount = clampInteger(options.teams, 4, 16, baseLeague.teams);
  const draftSlot = clampInteger(options.draftSlot, 1, teamCount, Math.min(baseLeague.draft.userDraftSlot ?? 1, teamCount));
  const rounds = clampInteger(options.rounds, 4, 22, baseLeague.draft.rounds);
  const ppr = normalizePpr(options.ppr, baseLeague.scoring.reception);

  return {
    ...baseLeague,
    leagueId: `${baseLeague.leagueId ?? "league"}-sim-${teamCount}-${draftSlot}-${ppr}`,
    name: options.name ?? baseLeague.name,
    teams: teamCount,
    userTeamId: `team_${draftSlot}`,
    draft: {
      ...baseLeague.draft,
      type: "snake",
      rounds,
      userDraftSlot: draftSlot,
    },
    scoring: {
      ...baseLeague.scoring,
      reception: ppr,
    },
    simulationScenario: {
      teams: teamCount,
      draftSlot,
      rounds,
      ppr,
      opponentProfileId: options.opponentProfileId ?? "agent",
    },
  };
}

export function buildTeamsForSimulation(league) {
  return Array.from({ length: league.teams }, (_, index) => ({
    teamId: `team_${index + 1}`,
    name: index + 1 === league.draft.userDraftSlot ? "My Team" : `Opponent ${index + 1}`,
    draftSlot: index + 1,
    picks: [],
  }));
}

export function runDraftSimulation({
  league,
  teams,
  players,
  strategyId = "balanced",
  opponentProfileId = league.simulationScenario?.opponentProfileId ?? "agent",
  mode = "mock_simulator",
}) {
  const strategy = STRATEGIES[strategyId];
  if (!strategy) {
    throw new Error(`Unknown simulation strategy: ${strategyId}`);
  }
  const opponentProfile = OPPONENT_PROFILES[opponentProfileId];
  if (!opponentProfile) {
    throw new Error(`Unknown opponent profile: ${opponentProfileId}`);
  }

  const state = createDraftState(league, teams, players);
  const userRecommendations = [];
  const userSelections = [];
  const replayTurns = [];

  while (state.currentPick <= getMaxDraftPicks(state)) {
    runUntilUserTurn(state, opponentProfileId);
    if (!isUserTurn(state)) break;

    const recommendations = recommendPlayers(state, league.userTeamId, 5);
    if (recommendations.length === 0) break;

    const selected = strategy.pickRecommendation(recommendations);
    userRecommendations.push({
      pickNumber: state.currentPick,
      strategy: strategyId,
      opponentProfile: opponentProfileId,
      selectedPlayerId: selected.player.playerId,
      selectedRank: recommendations.findIndex((option) => option.player.playerId === selected.player.playerId) + 1,
      options: recommendations.map(toRecommendationSnapshot),
    });
    userSelections.push({
      pickNumber: state.currentPick,
      selectedRank: recommendations.findIndex((option) => option.player.playerId === selected.player.playerId) + 1,
      playerId: selected.player.playerId,
      name: selected.player.name,
      position: selected.player.position,
      score: selected.finalScore,
    });
    replayTurns.push({
      pickNumber: state.currentPick,
      round: Math.ceil(state.currentPick / league.teams),
      beforeRoster: getUserRosterSnapshot(state),
      selected: toRecommendationSnapshot(selected),
      selectedRank: recommendations.findIndex((option) => option.player.playerId === selected.player.playerId) + 1,
      options: recommendations.map(toRecommendationSnapshot),
    });
    draftPlayer(state, selected.player.playerId, league.userTeamId, `sim_${strategyId}`);
    replayTurns[replayTurns.length - 1].afterRoster = getUserRosterSnapshot(state);
  }

  const report = buildSimulationReport(state, userRecommendations, {
    simulationRunId: `sim_${strategyId}_${new Date().toISOString().replaceAll(/[:.]/g, "-")}_${Math.random().toString(36).slice(2, 8)}`,
    mode,
    strategy: {
      id: strategyId,
      label: strategy.label,
    },
    opponentProfile: {
      id: opponentProfileId,
      label: opponentProfile.label,
    },
    scenario: league.simulationScenario ?? null,
    replayTurns,
  });

  return {
    strategy: {
      id: strategyId,
      label: strategy.label,
    },
    opponentProfile: {
      id: opponentProfileId,
      label: opponentProfile.label,
    },
    state,
    report,
    summary: buildSimulationSummary(report, userSelections),
  };
}

export function runSimulationBatch({
  league,
  teams,
  players,
  strategyIds = DEFAULT_STRATEGY_IDS,
  opponentProfileId = league.simulationScenario?.opponentProfileId ?? "agent",
  mode = "mock_simulator_batch",
}) {
  return strategyIds.map((strategyId) => runDraftSimulation({
    league,
    teams: cloneTeams(teams),
    players,
    strategyId,
    opponentProfileId,
    mode,
  }));
}

function buildSimulationSummary(report, userSelections) {
  return {
    simulationRunId: report.simulationRunId,
    mode: report.mode,
    strategy: report.strategy,
    opponentProfile: report.opponentProfile,
    scenario: report.scenario,
    picksMade: report.summary.picksMade,
    recommendationTurns: report.summary.recommendationTurns,
    projectedRosterPoints: report.summary.projectedRosterPoints,
    projectedStarterPoints: report.postDraftReview.summary.projectedStarterPoints,
    projectedBenchPoints: report.postDraftReview.summary.projectedBenchPoints,
    weaknessCount: report.postDraftReview.weaknesses.length,
    topWeaknesses: report.postDraftReview.weaknesses.slice(0, 3),
    bestPicks: userSelections.slice(0, 3),
    missedOpportunities: inferMissedOpportunities(report),
    userSelections,
  };
}

function toRecommendationSnapshot(option) {
  return {
    playerId: option.player.playerId,
    name: option.player.name,
    position: option.player.position,
    team: option.player.team,
    score: option.finalScore,
    projectedPoints: option.projectedPoints,
    valueOverReplacement: option.valueOverReplacement,
    scarcityUrgency: option.scarcityUrgency,
    survivalProbability: option.survivalProbability,
    riskPenalty: option.riskPenalty,
    sourceConfidence: option.sourceConfidence,
    pros: option.pros,
    cons: option.cons,
  };
}

function cloneTeams(teams) {
  return teams.map((team) => ({ ...team, picks: [] }));
}

function runUntilUserTurn(state, opponentProfileId) {
  const opponentProfile = OPPONENT_PROFILES[opponentProfileId];
  while (!isUserTurn(state) && state.currentPick <= getMaxDraftPicks(state)) {
    const teamId = getTeamForPick(state.league, state.currentPick);
    const player = opponentProfile.pickPlayer(state, teamId);
    if (!player) break;
    draftPlayer(state, player.playerId, teamId, `opponent_${opponentProfileId}`);
  }
  return state;
}

function pickBiasedPlayer(state, teamId, positionPriority) {
  const recommendations = recommendPlayers(state, teamId, 12);
  const rosterSize = getRosterSize(state, teamId);
  const preferredPosition = positionPriority[Math.min(rosterSize, positionPriority.length - 1)];
  const topTier = recommendations.filter((option) => option.finalScore >= recommendations[0].finalScore - 8);
  return topTier.find((option) => option.player.position === preferredPosition)?.player
    ?? recommendations[0]?.player
    ?? getAvailablePlayers(state).slice().sort((a, b) => a.adp - b.adp)[0];
}

function getRosterSize(state, teamId) {
  return state.teams.find((team) => team.teamId === teamId)?.picks.length ?? 0;
}

function getUserRosterSnapshot(state) {
  const draftedIds = new Set(state.teams.find((team) => team.teamId === state.league.userTeamId)?.picks.map((pick) => pick.playerId) ?? []);
  return state.players
    .filter((player) => draftedIds.has(player.playerId))
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      team: player.team,
      projectedPoints: player.projectedPoints,
    }));
}

function inferMissedOpportunities(report) {
  return (report.userRecommendations ?? [])
    .filter((turn) => turn.selectedRank > 1)
    .slice(0, 3)
    .map((turn) => {
      const selected = turn.options.find((option) => option.playerId === turn.selectedPlayerId);
      const top = turn.options[0];
      return {
        pickNumber: turn.pickNumber,
        selected: selected?.name ?? turn.selectedPlayerId,
        topAvailable: top?.name ?? null,
        scoreGap: selected && top ? round(top.score - selected.score, 1) : 0,
      };
    });
}

function normalizePpr(value, fallback) {
  const normalized = Number(value);
  if ([0, 0.5, 1].includes(normalized)) return normalized;
  return [0, 0.5, 1].includes(Number(fallback)) ? Number(fallback) : 0.5;
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
