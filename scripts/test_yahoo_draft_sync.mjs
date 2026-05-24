import assert from "node:assert/strict";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { createDraftState } from "../src/draft/draftEngine.mjs";
import { applyYahooDraftEventsToState } from "../src/draft/yahooDraftSync.mjs";

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
const result = applyYahooDraftEventsToState(state, [
  {
    pickNumber: 1,
    teamId: "team_1",
    playerId: "p_001",
  },
  {
    pickNumber: 2,
    teamId: "team_2",
    playerId: null,
    yahooPlayerId: "999999",
  },
  {
    pickNumber: 3,
    teamId: "team_3",
    playerId: "p_003",
  },
]);

assert.equal(result.applied, 1);
assert.equal(result.manualRequired.length, 1);
assert.equal(result.manualRequired[0].manualReason, "unmatched_yahoo_player");
assert.equal(result.events.length, 2);
assert.equal(result.events[0].status, "applied");
assert.equal(result.events[1].status, "manual_required");
assert.equal(result.events[1].reason, "unmatched_yahoo_player");
assert.equal(state.currentPick, 2);
assert.equal(state.drafted.length, 1);
assert.equal(state.drafted[0].source, "yahoo_draftresults");

const replay = applyYahooDraftEventsToState(state, [
  {
    pickNumber: 1,
    teamId: "team_1",
    playerId: "p_001",
  },
]);

assert.equal(replay.applied, 0);
assert.equal(replay.skippedAlreadyDrafted, 1);
assert.equal(replay.events[0].status, "skipped");
assert.equal(replay.events[0].reason, "already_applied");

const conflict = applyYahooDraftEventsToState(state, [
  {
    pickNumber: 1,
    teamId: "1",
    playerId: "p_003",
  },
]);

assert.equal(conflict.manualRequired.length, 1);
assert.equal(conflict.manualRequired[0].manualReason, "manual_pick_conflict");
assert.equal(conflict.events[0].status, "manual_required");
assert.equal(conflict.events[0].reason, "manual_pick_conflict");

console.log(JSON.stringify({
  status: "passed",
  tested: ["apply matched Yahoo draft events", "stop on manual correction", "skip already applied picks", "manual pick conflict detection", "per-event sync outcomes"],
}, null, 2));
