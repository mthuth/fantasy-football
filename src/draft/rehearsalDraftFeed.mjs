import { getAvailablePlayers, getTeamForPick, isUserTurn } from "./draftEngine.mjs";

export function buildRehearsalDraftEvents(state, options = {}) {
  const maxEvents = Math.max(1, Number(options.maxEvents ?? 3));
  const mode = options.mode ?? "synced";
  const events = [];
  const draftedIds = new Set(state.drafted.map((pick) => pick.playerId));
  let pickNumber = state.currentPick;

  while (events.length < maxEvents && pickNumber <= state.league.teams * state.league.draft.rounds) {
    const teamId = getTeamForPick(state.league, pickNumber);
    if (teamId === state.league.userTeamId && options.stopBeforeUserPick !== false) break;

    const player = nextRehearsalPlayer(state, draftedIds, teamId);
    if (!player) break;
    draftedIds.add(player.playerId);

    events.push({
      pickNumber,
      teamId,
      playerId: mode === "unmapped" && events.length === 0 ? null : player.playerId,
      yahooPlayerId: mode === "unmapped" && events.length === 0 ? `rehearsal_unmapped_${pickNumber}` : `rehearsal_${player.playerId}`,
      yahooPlayerName: player.name,
      source: "rehearsal_draftresults",
    });

    if (mode === "conflict") break;
    pickNumber += 1;
  }

  return {
    syncStatus: mode === "stale" ? "stale" : "synced",
    mode,
    generatedAt: new Date().toISOString(),
    summary: {
      pickCount: events.length,
      highestPick: events.at(-1)?.pickNumber ?? state.currentPick - 1,
      unmappedPlayerCount: events.filter((event) => !event.playerId).length,
    },
    picks: mode === "conflict" && events[0]
      ? [{ ...events[0], pickNumber: events[0].pickNumber + 1 }]
      : events,
  };
}

function nextRehearsalPlayer(state, draftedIds, teamId) {
  const roster = state.teams.find((team) => team.teamId === teamId)?.picks ?? [];
  const rosterPositions = new Set(roster.map((pick) => {
    const player = state.players.find((candidate) => candidate.playerId === pick.playerId);
    return player?.position;
  }));
  const available = getAvailablePlayers({
    ...state,
    drafted: state.drafted.concat([...draftedIds]
      .filter((playerId) => !state.drafted.some((pick) => pick.playerId === playerId))
      .map((playerId) => ({ playerId }))),
  }).slice().sort((a, b) => {
    const aNeed = rosterPositions.has(a.position) ? 1 : 0;
    const bNeed = rosterPositions.has(b.position) ? 1 : 0;
    return aNeed - bNeed || a.adp - b.adp;
  });

  return available.find((player) => !["K", "DST"].includes(player.position) || roster.length >= 7) ?? available[0] ?? null;
}
