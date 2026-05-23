import { draftPlayer } from "./draftEngine.mjs";

export function applyYahooDraftEventsToState(state, events) {
  const summary = {
    applied: 0,
    skippedAlreadyDrafted: 0,
    stoppedAt: null,
    manualRequired: [],
  };

  const sortedEvents = [...(events ?? [])].sort((a, b) => a.pickNumber - b.pickNumber);

  for (const event of sortedEvents) {
    const existingPick = state.drafted.find((pick) => pick.pickNumber === event.pickNumber);
    if (existingPick && existingPick.playerId === event.playerId && existingPick.teamId === normalizeTeamId(event.teamId)) {
      summary.skippedAlreadyDrafted += 1;
      continue;
    }
    if (existingPick) {
      const manualEvent = { ...event, manualReason: "manual_pick_conflict", existingPick };
      summary.manualRequired.push(manualEvent);
      summary.stoppedAt = manualEvent;
      break;
    }

    const manualReason = getManualReason(state, event);
    if (manualReason) {
      const manualEvent = { ...event, manualReason };
      summary.manualRequired.push(manualEvent);
      summary.stoppedAt = manualEvent;
      break;
    }

    draftPlayer(state, event.playerId, normalizeTeamId(event.teamId), "yahoo_draftresults");
    summary.applied += 1;
  }

  return summary;
}

function getManualReason(state, event) {
  if (!event?.pickNumber) return "missing_pick_number";
  if (event.pickNumber !== state.currentPick) return "non_sequential_pick";
  if (!event.playerId) return "unmatched_yahoo_player";
  if (!event.teamId) return "unmatched_yahoo_team";
  if (!state.players.some((player) => player.playerId === event.playerId)) return "player_not_in_active_pool";
  if (!state.teams.some((team) => team.teamId === normalizeTeamId(event.teamId))) return "team_not_in_active_league";
  return null;
}

function normalizeTeamId(teamId) {
  const value = String(teamId ?? "");
  return value.startsWith("team_") ? value : `team_${value}`;
}
