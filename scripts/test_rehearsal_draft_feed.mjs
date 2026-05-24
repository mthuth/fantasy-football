import assert from "node:assert/strict";
import { createDraftState } from "../src/draft/draftEngine.mjs";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import { buildRehearsalDraftEvents } from "../src/draft/rehearsalDraftFeed.mjs";
import { applyYahooDraftEventsToState } from "../src/draft/yahooDraftSync.mjs";

const league = { ...mockLeague, userTeamId: "team_4" };
const state = createDraftState(league, mockTeams, mockPlayers);
const payload = buildRehearsalDraftEvents(state, { maxEvents: 3 });

assert.equal(payload.syncStatus, "synced");
assert.equal(payload.picks.length, 3);
assert.deepEqual(payload.picks.map((pick) => pick.pickNumber), [1, 2, 3]);

const summary = applyYahooDraftEventsToState(state, payload.picks);
assert.equal(summary.applied, 3);
assert.equal(state.currentPick, 4);

const unmapped = buildRehearsalDraftEvents(state, { mode: "unmapped", maxEvents: 1, stopBeforeUserPick: false });
const unmappedSummary = applyYahooDraftEventsToState(state, unmapped.picks);
assert.equal(unmappedSummary.manualRequired[0].manualReason, "unmatched_yahoo_player");

const conflictState = createDraftState(league, mockTeams, mockPlayers);
const conflict = buildRehearsalDraftEvents(conflictState, { mode: "conflict", maxEvents: 1 });
const conflictSummary = applyYahooDraftEventsToState(conflictState, conflict.picks);
assert.equal(conflictSummary.manualRequired[0].manualReason, "non_sequential_pick");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "rehearsal synced draftresults feed",
    "rehearsal unmapped player fallback",
    "rehearsal non-sequential conflict fallback",
  ],
}, null, 2));
