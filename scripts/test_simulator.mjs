import assert from "node:assert/strict";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import {
  buildSimulationScenario,
  buildTeamsForSimulation,
  getOpponentProfiles,
  getSimulationStrategies,
  runDraftSimulation,
  runSimulationBatch,
} from "../src/draft/simulator.mjs";

const strategies = getSimulationStrategies();
assert.deepEqual(strategies.map((strategy) => strategy.id), ["balanced", "upside", "safe", "scarcity"]);
assert.deepEqual(getOpponentProfiles().map((profile) => profile.id), ["agent", "adp", "rb_heavy", "wr_heavy", "qb_early"]);

const balanced = runDraftSimulation({
  league: mockLeague,
  teams: mockTeams,
  players: mockPlayers,
  strategyId: "balanced",
  opponentProfileId: "agent",
});

assert.equal(balanced.strategy.id, "balanced");
assert.equal(balanced.report.strategy.id, "balanced");
assert.equal(balanced.report.opponentProfile.id, "agent");
assert.equal(balanced.report.summary.picksMade, mockLeague.teams * mockLeague.draft.rounds);
assert.equal(balanced.report.summary.recommendationTurns, mockLeague.draft.rounds);
assert.ok(balanced.summary.projectedStarterPoints > 0, "simulator should produce starter projections");
assert.ok(balanced.summary.userSelections.every((selection) => selection.selectedRank >= 1), "selections should preserve recommendation rank");
assert.equal(balanced.report.replayTurns.length, mockLeague.draft.rounds, "replay turns should preserve every user decision");

const batch = runSimulationBatch({
  league: mockLeague,
  teams: mockTeams,
  players: mockPlayers,
  strategyIds: ["balanced", "safe", "upside"],
});

assert.equal(batch.length, 3);
assert.deepEqual(batch.map((simulation) => simulation.strategy.id), ["balanced", "safe", "upside"]);
assert.equal(new Set(batch.map((simulation) => simulation.report.simulationRunId)).size, 3, "batch reports should have distinct run ids");
assert.ok(batch.every((simulation) => simulation.summary.picksMade === mockLeague.teams * mockLeague.draft.rounds));

const scenario = buildSimulationScenario(mockLeague, {
  teams: 10,
  draftSlot: 7,
  rounds: 9,
  ppr: 1,
  opponentProfileId: "rb_heavy",
});
assert.equal(scenario.teams, 10);
assert.equal(scenario.userTeamId, "team_7");
assert.equal(scenario.scoring.reception, 1);
assert.equal(scenario.simulationScenario.opponentProfileId, "rb_heavy");

const scenarioBatch = runSimulationBatch({
  league: scenario,
  teams: buildTeamsForSimulation(scenario),
  players: mockPlayers,
  strategyIds: ["balanced"],
  opponentProfileId: "rb_heavy",
});
assert.equal(scenarioBatch[0].report.opponentProfile.id, "rb_heavy");
assert.equal(scenarioBatch[0].report.scenario.draftSlot, 7);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "strategy registry",
    "opponent profile registry",
    "single simulation summary",
    "replay turn capture",
    "batch strategy execution",
    "distinct batch report ids",
    "scenario overrides",
    "opponent profile simulation",
  ],
}, null, 2));
