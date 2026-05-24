import assert from "node:assert/strict";
import { mockLeague, mockPlayers, mockTeams } from "../src/draft/mockData.mjs";
import {
  createDraftState,
  draftPlayer,
  getAvailablePlayers,
  getTeamForPick,
  getTeamRoster,
  undoLastPick,
} from "../src/draft/draftEngine.mjs";

const state = createDraftState(mockLeague, mockTeams, mockPlayers);
const firstPlayer = getAvailablePlayers(state)[0];
const currentTeam = getTeamForPick(mockLeague, state.currentPick);

draftPlayer(state, firstPlayer.playerId, currentTeam, "manual_current_team");
assert.equal(state.currentPick, 2);
assert.equal(state.drafted.length, 1);
assert.equal(getTeamRoster(state, currentTeam).length, 1);
assert.equal(getAvailablePlayers(state).some((player) => player.playerId === firstPlayer.playerId), false);

const undone = undoLastPick(state);
assert.equal(undone.playerId, firstPlayer.playerId);
assert.equal(state.currentPick, 1);
assert.equal(state.drafted.length, 0);
assert.equal(getTeamRoster(state, currentTeam).length, 0);
assert.equal(getAvailablePlayers(state).some((player) => player.playerId === firstPlayer.playerId), true);

const userPlayer = getAvailablePlayers(state)[1];
draftPlayer(state, userPlayer.playerId, mockLeague.userTeamId, "manual_user");
assert.equal(state.currentPick, 2);
assert.equal(getTeamRoster(state, mockLeague.userTeamId).length, 1);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "manual draft for current team",
    "undo last pick",
    "manual user draft",
  ],
}, null, 2));
