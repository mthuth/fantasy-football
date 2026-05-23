import { draftPlayer } from "./draftEngine.mjs";

export function compareSyncedPicksToDraftState(state, syncedPicks) {
  const localByPick = new Map(state.drafted.map((pick) => [pick.pickNumber, pick]));
  const conflicts = [];

  for (const synced of syncedPicks) {
    if (!synced.playerId) continue;
    const local = localByPick.get(synced.pickNumber);
    if (!local) continue;
    if (local.playerId !== synced.playerId || local.teamId !== synced.teamId) {
      conflicts.push({
        type: "manual_pick_conflict",
        pickNumber: synced.pickNumber,
        local,
        synced,
      });
    }
  }

  return conflicts;
}

export function applySyncedDraftPicks(state, syncedPicks, options = {}) {
  const conflicts = options.skipConflictCheck
    ? []
    : compareSyncedPicksToDraftState(state, syncedPicks);
  if (conflicts.length > 0) {
    return {
      appliedCount: 0,
      skippedCount: syncedPicks.length,
      conflicts,
    };
  }

  resetStateDraft(state);

  let appliedCount = 0;
  const skipped = [];
  for (const synced of syncedPicks.slice().sort((a, b) => a.pickNumber - b.pickNumber)) {
    if (!synced.playerId || !synced.teamId) {
      skipped.push({ pickNumber: synced.pickNumber, reason: "missing_player_or_team_mapping", synced });
      continue;
    }
    if (synced.pickNumber !== state.currentPick) {
      skipped.push({ pickNumber: synced.pickNumber, reason: "non_contiguous_pick", expectedPick: state.currentPick, synced });
      continue;
    }

    try {
      draftPlayer(state, synced.playerId, synced.teamId, synced.source ?? "yahoo_draft_results");
      appliedCount += 1;
    } catch (error) {
      skipped.push({ pickNumber: synced.pickNumber, reason: error.message, synced });
    }
  }

  return {
    appliedCount,
    skippedCount: skipped.length,
    skipped,
    conflicts,
  };
}

function resetStateDraft(state) {
  for (const team of state.teams) {
    team.picks = [];
  }
  state.drafted = [];
  state.currentPick = 1;
  state.log.push({ type: "draft_sync_reset", source: "yahoo_draft_results" });
}
