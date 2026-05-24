import {
  buildSimulationScenario,
  buildTeamsForSimulation,
  getOpponentProfiles,
  getSimulationStrategies,
  runDraftSimulation,
} from "./simulator.mjs";
import { DEFAULT_STRATEGY_WEIGHTS } from "./strategyPreferences.mjs";

export const STRATEGY_WEIGHT_CANDIDATES = Object.freeze([
  candidate("current_tuned", "Current tuned weights", {}),
  candidate("tempered_profiles", "Less aggressive profile nudges", {
    heroRbEarlyAnchorBonus: 5,
    heroRbAnchorBonus: 4,
    heroRbSecondEarlyPenalty: -2,
    zeroRbEarlyRbPenalty: -6,
    zeroRbEarlyPassCatcherBonus: 3,
    zeroRbRecoveryRbBonus: 4,
    robustRbEarlyRbBonus: 6,
    robustRbEarlyPassCatcherPenalty: -2,
    eliteQbTopTierBonus: 4,
    eliteQbLatePenalty: -2,
    bestPlayerAvailableMaxMarketEdge: 4,
    safeFloorRiskMultiplier: 1,
    upsideCeilingMultiplier: 0.4,
    stackingBonus: 2,
  }),
  candidate("aggressive_roster_builds", "Stronger RB and zero-RB identity", {
    heroRbEarlyAnchorBonus: 8,
    heroRbAnchorBonus: 6,
    heroRbSecondEarlyPenalty: -4,
    zeroRbEarlyRbPenalty: -9,
    zeroRbEarlyPassCatcherBonus: 5,
    zeroRbRecoveryRbBonus: 6,
    robustRbEarlyRbBonus: 10,
    robustRbEarlyPassCatcherPenalty: -4,
  }),
  candidate("market_value_heavy", "More ADP value discipline", {
    heroRbEarlyAnchorBonus: 6,
    heroRbAnchorBonus: 4,
    zeroRbEarlyRbPenalty: -7,
    zeroRbEarlyPassCatcherBonus: 3,
    robustRbEarlyRbBonus: 6,
    bestPlayerAvailableMinMarketEdge: -3,
    bestPlayerAvailableMaxMarketEdge: 7,
    bestPlayerAvailableAdpDivisor: 6,
  }),
  candidate("pass_catcher_lean", "WR/TE early construction lean", {
    heroRbEarlyAnchorBonus: 5,
    heroRbAnchorBonus: 4,
    zeroRbEarlyRbPenalty: -10,
    zeroRbEarlyPassCatcherBonus: 6,
    zeroRbRecoveryRbBonus: 5,
    robustRbEarlyRbBonus: 5,
    robustRbEarlyPassCatcherPenalty: -1,
    eliteQbTopTierBonus: 3,
  }),
  candidate("upside_stack", "Ceiling and stack friendly", {
    safeFloorRiskMultiplier: 1.1,
    upsideCeilingMultiplier: 0.75,
    stackingBonus: 4,
    eliteQbTopTierBonus: 6,
    bestPlayerAvailableMaxMarketEdge: 4,
  }),
]);

export function buildStrategyTuningScenarios(baseLeague, options = {}) {
  const teamCounts = options.teamCounts ?? [8, 10, 12];
  const pprValues = options.pprValues ?? [0, 0.5, 1];
  const rounds = options.rounds ?? [baseLeague.draft.rounds, Math.max(baseLeague.draft.rounds, 14)];
  const opponentProfileIds = options.opponentProfileIds ?? getOpponentProfiles().map((profile) => profile.id);
  const scenarios = [];

  for (const teams of teamCounts) {
    const draftSlots = options.draftSlots ?? unique([1, Math.ceil(teams / 2), teams]);
    for (const draftSlot of draftSlots.filter((slot) => slot <= teams)) {
      for (const ppr of pprValues) {
        for (const roundCount of rounds) {
          for (const opponentProfileId of opponentProfileIds) {
            const league = buildSimulationScenario(baseLeague, {
              teams,
              draftSlot,
              rounds: roundCount,
              ppr,
              opponentProfileId,
              name: `${baseLeague.name} tuning ${teams}t slot ${draftSlot}`,
            });
            scenarios.push({
              id: `${teams}t_slot${draftSlot}_${ppr}ppr_${roundCount}r_${opponentProfileId}`,
              league,
            });
          }
        }
      }
    }
  }

  return scenarios.slice(0, options.limit ?? scenarios.length);
}

export function evaluateStrategyWeightCandidates({
  baseLeague,
  players,
  candidates = STRATEGY_WEIGHT_CANDIDATES,
  scenarios = buildStrategyTuningScenarios(baseLeague),
  strategyIds = getSimulationStrategies().map((strategy) => strategy.id),
} = {}) {
  const runs = [];
  const bestByScenarioStrategy = new Map();

  for (const weightSet of candidates) {
    for (const scenario of scenarios) {
      const teams = buildTeamsForSimulation(scenario.league);

      for (const strategyId of strategyIds) {
        const league = {
          ...scenario.league,
          strategyPreferences: {
            ...(scenario.league.strategyPreferences ?? {}),
            strategyProfile: strategyId,
            strategyWeights: weightSet.weights,
          },
        };
        const simulation = runDraftSimulation({
          league,
          teams,
          players,
          strategyId,
          opponentProfileId: scenario.league.simulationScenario.opponentProfileId,
          mode: "strategy_weight_tuning",
        });
        const score = scoreTuningOutcome(simulation.summary);
        const run = {
          candidateId: weightSet.id,
          candidateLabel: weightSet.label,
          strategyId,
          scenarioId: scenario.id,
          score,
          projectedStarterPoints: simulation.summary.projectedStarterPoints,
          projectedRosterPoints: simulation.summary.projectedRosterPoints,
          projectedBenchPoints: simulation.summary.projectedBenchPoints,
          weaknessCount: simulation.summary.weaknessCount,
        };
        runs.push(run);

        const key = `${scenario.id}:${strategyId}`;
        const currentBest = bestByScenarioStrategy.get(key);
        if (!currentBest || run.score > currentBest.score) bestByScenarioStrategy.set(key, run);
      }
    }
  }

  const rankings = rankTuningCandidates(candidates, runs, bestByScenarioStrategy);
  const winner = rankings[0] ?? null;

  return {
    createdAt: new Date().toISOString(),
    simulationCount: runs.length,
    scenarioCount: scenarios.length,
    strategyIds,
    candidateCount: candidates.length,
    winner,
    recommendedDefaultStrategy: winner ? chooseRecommendedDefaultStrategy(runs, winner.candidateId) : null,
    rankings,
    runs,
  };
}

export function rankTuningCandidates(candidates, runs, bestByScenarioStrategy = new Map()) {
  return candidates.map((candidateWeights) => {
    const candidateRuns = runs.filter((run) => run.candidateId === candidateWeights.id);
    const wins = [...bestByScenarioStrategy.values()].filter((run) => run.candidateId === candidateWeights.id).length;
    const averageScore = average(candidateRuns, "score");
    const strategyBreakdown = Object.values(groupBy(candidateRuns, "strategyId"))
      .map((strategyRuns) => ({
        strategyId: strategyRuns[0].strategyId,
        runs: strategyRuns.length,
        averageScore: round(average(strategyRuns, "score"), 2),
        averageStarterPoints: round(average(strategyRuns, "projectedStarterPoints"), 1),
      }))
      .sort((a, b) => b.averageScore - a.averageScore);

    return {
      candidateId: candidateWeights.id,
      label: candidateWeights.label,
      weights: candidateWeights.weights,
      runs: candidateRuns.length,
      wins,
      averageScore: round(averageScore, 2),
      averageStarterPoints: round(average(candidateRuns, "projectedStarterPoints"), 1),
      averageRosterPoints: round(average(candidateRuns, "projectedRosterPoints"), 1),
      averageWeaknessCount: round(average(candidateRuns, "weaknessCount"), 2),
      strategyBreakdown,
    };
  }).sort((a, b) =>
    b.averageScore - a.averageScore ||
    b.wins - a.wins ||
    b.averageStarterPoints - a.averageStarterPoints
  );
}

export function chooseRecommendedDefaultStrategy(runs, candidateId) {
  const candidateRuns = runs.filter((run) => run.candidateId === candidateId);
  const [best] = Object.values(groupBy(candidateRuns, "strategyId"))
    .map((strategyRuns) => ({
      strategyId: strategyRuns[0].strategyId,
      runs: strategyRuns.length,
      averageScore: round(average(strategyRuns, "score"), 2),
      averageStarterPoints: round(average(strategyRuns, "projectedStarterPoints"), 1),
      averageWeaknessCount: round(average(strategyRuns, "weaknessCount"), 2),
    }))
    .sort((a, b) =>
      b.averageScore - a.averageScore ||
      b.averageStarterPoints - a.averageStarterPoints ||
      a.averageWeaknessCount - b.averageWeaknessCount
    );

  return best ?? null;
}

export function buildTuningMarkdown(result) {
  const winner = result.winner;
  const defaultStrategy = result.recommendedDefaultStrategy;
  const rows = result.rankings.map((ranking, index) =>
    `| ${index + 1} | ${ranking.candidateId} | ${ranking.averageScore} | ${ranking.averageStarterPoints} | ${ranking.averageRosterPoints} | ${ranking.averageWeaknessCount} | ${ranking.wins} |`
  ).join("\n");
  const bestStrategies = winner?.strategyBreakdown.slice(0, 6).map((strategy) =>
    `| ${strategy.strategyId} | ${strategy.averageScore} | ${strategy.averageStarterPoints} | ${strategy.runs} |`
  ).join("\n") ?? "";

  return `# Strategy Weight Tuning

Generated: ${result.createdAt}

## Summary

- Simulations run: ${result.simulationCount}
- Scenario count: ${result.scenarioCount}
- Strategy profiles per scenario: ${result.strategyIds.join(", ")}
- Candidate weight sets: ${result.candidateCount}
- Winning weight set: ${winner?.candidateId ?? "n/a"}
- Recommended default strategy under winner: ${defaultStrategy?.strategyId ?? "n/a"}

## Candidate Rankings

| Rank | Candidate | Avg score | Avg starter pts | Avg roster pts | Avg weaknesses | Wins |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## Winning Strategy Breakdown

| Strategy | Avg score | Avg starter pts | Runs |
| --- | ---: | ---: | ---: |
${bestStrategies}

## Objective

Score = projected starter points + 15% of bench points - 6 points per roster weakness.

The objective intentionally values starting-lineup strength first while still penalizing brittle roster construction. Simulation reports are not saved for every tuning run; this report keeps the aggregate tuning evidence compact.
`;
}

export function scoreTuningOutcome(summary) {
  return round(
    summary.projectedStarterPoints +
      summary.projectedBenchPoints * 0.15 -
      summary.weaknessCount * 6,
    2
  );
}

function candidate(id, label, weights) {
  return {
    id,
    label,
    weights: {
      ...DEFAULT_STRATEGY_WEIGHTS,
      ...weights,
      version: id,
    },
  };
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
    return groups;
  }, {});
}

function average(rows, key) {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

function unique(values) {
  return [...new Set(values)];
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
