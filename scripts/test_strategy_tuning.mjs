import assert from "node:assert/strict";
import { mockLeague, mockPlayers } from "../src/draft/mockData.mjs";
import {
  STRATEGY_WEIGHT_CANDIDATES,
  buildStrategyTuningScenarios,
  buildTuningMarkdown,
  evaluateStrategyWeightCandidates,
  scoreTuningOutcome,
} from "../src/draft/strategyTuning.mjs";

const scenarios = buildStrategyTuningScenarios(mockLeague, {
  teamCounts: [8],
  draftSlots: [4],
  pprValues: [0.5],
  rounds: [10],
  opponentProfileIds: ["adp"],
});

assert.equal(scenarios.length, 1);
assert.ok(STRATEGY_WEIGHT_CANDIDATES.length >= 3, "tuning should compare multiple candidate weight sets");

const result = evaluateStrategyWeightCandidates({
  baseLeague: mockLeague,
  players: mockPlayers,
  scenarios,
  candidates: STRATEGY_WEIGHT_CANDIDATES.slice(0, 2),
  strategyIds: ["balanced", "hero_rb"],
});

assert.equal(result.simulationCount, 4);
assert.equal(result.scenarioCount, 1);
assert.equal(result.candidateCount, 2);
assert.ok(result.winner);
assert.ok(result.recommendedDefaultStrategy);
assert.equal(result.rankings.length, 2);
assert.ok(result.rankings.every((ranking) => ranking.runs === 2));
assert.equal(typeof scoreTuningOutcome(result.runs[0]), "number");

const markdown = buildTuningMarkdown(result);
assert.match(markdown, /Strategy Weight Tuning/);
assert.match(markdown, /Candidate Rankings/);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "tuning scenario grid generation",
    "candidate weight evaluation",
    "ranking and winner selection",
    "recommended default strategy selection",
    "markdown tuning report generation",
  ],
}, null, 2));
