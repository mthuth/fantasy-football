import { normalizeYahooLeagueSettings } from "../connectors/yahoo/yahooLeagueNormalizer.mjs";

export function parseYahooLeagueSettingsJson(jsonText) {
  if (!jsonText || !jsonText.trim()) {
    throw new Error("Paste a Yahoo league settings JSON payload before importing.");
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid Yahoo settings JSON: ${error.message}`);
  }
}

export function buildLeagueFromYahooSettings(baseLeague, yahooPayload, options = {}) {
  const imported = normalizeYahooLeagueSettings(yahooPayload, options);
  const rosterSlots = {
    ...baseLeague.rosterSlots,
    ...imported.rosterSlots,
  };
  const yahooTeams = options.selectedLeague?.teams ?? options.yahooTeams ?? [];
  const selectedTeamKey = options.selectedTeamKey ?? options.selectedLeague?.selectedTeamKey ?? options.selectedLeague?.primaryTeam?.teamKey ?? null;
  const selectedTeamName = options.selectedTeamName ?? options.selectedLeague?.selectedTeamName ?? options.selectedLeague?.primaryTeam?.name ?? null;
  const draftOrder = buildYahooDraftOrder({
    teams: yahooTeams,
    selectedTeamKey,
    draftOrder: options.selectedLeague?.draftOrder ?? options.draftOrder,
  });
  const teamCount = firstFiniteNumber(
    options.teamCount,
    options.selectedLeague?.teamCount,
    options.selectedLeague?.numTeams,
    imported.teamCount,
    yahooTeams.length > 1 ? yahooTeams.length : null,
    baseLeague.teams,
  );
  const userDraftSlot = firstFiniteNumber(
    options.draftSlot,
    options.selectedDraftSlot,
    options.selectedLeague?.draftSlot,
    options.selectedLeague?.primaryTeam?.draftSlot,
    draftOrder.selectedDraftSlot,
    baseLeague.draft.userDraftSlot,
  );

  return {
    ...baseLeague,
    teams: teamCount,
    userTeamId: `team_${userDraftSlot}`,
    leagueId: imported.leagueId ?? baseLeague.leagueId,
    leagueKey: imported.leagueKey ?? baseLeague.leagueKey,
    name: imported.name ?? baseLeague.name,
    selectedTeamKey,
    selectedTeamName,
    yahooTeams,
    yahooDraftOrderTeams: draftOrder.teams,
    teamKeyToTeamId: draftOrder.teamKeyToTeamId,
    platform: "yahoo",
    season: imported.season ?? baseLeague.season,
    scoring: imported.scoring,
    rosterSlots,
    draft: {
      ...baseLeague.draft,
      ...Object.fromEntries(Object.entries(imported.draft).filter(([, value]) => value !== null && value !== undefined)),
      userDraftSlot,
      rounds: options.rounds ?? calculateDraftRounds(rosterSlots),
    },
    importSource: {
      type: "yahoo_settings_payload",
      warnings: imported.rawWarnings,
      selectedTeamKey,
      selectedTeamName,
      selectedLeagueLabel: options.selectedLeagueLabel ?? null,
      selectedLeague: options.selectedLeague ?? null,
      teamKeyToTeamId: draftOrder.teamKeyToTeamId,
    },
  };
}

export function calculateDraftRounds(rosterSlots) {
  return Object.values(rosterSlots).reduce((sum, count) => sum + Number(count || 0), 0);
}

export function summarizeLeagueRules(league) {
  return {
    name: league.name,
    platform: league.platform,
    season: league.season ?? null,
    draftType: league.draft?.type ?? null,
    rounds: league.draft?.rounds ?? null,
    rosterSlots: league.rosterSlots,
    scoring: {
      reception: league.scoring?.reception,
      passingTd: league.scoring?.passingTd,
      interception: league.scoring?.interception,
      rushingTd: league.scoring?.rushingTd,
      receivingTd: league.scoring?.receivingTd,
    },
    warnings: league.importSource?.warnings ?? [],
    selectedTeam: league.importSource?.selectedTeamName ?? null,
  };
}

export function buildYahooDraftOrder({ teams = [], selectedTeamKey = null, draftOrder = [] } = {}) {
  const orderedTeamKeys = Array.isArray(draftOrder) ? draftOrder.map((team) => teamKeyFromDraftOrderItem(team)).filter(Boolean) : [];
  const explicitDraftOrder = new Map(orderedTeamKeys.map((teamKey, index) => [teamKey, index + 1]));
  const teamKeyToTeamId = {};
  const normalizedTeams = [];
  let selectedDraftSlot = null;

  for (const team of teams) {
    const teamKey = cleanString(team.teamKey ?? team.team_key);
    if (!teamKey) continue;
    const draftSlot = firstFiniteNumber(
      team.draftSlot,
      team.draft_slot,
      team.draftPosition,
      team.draft_position,
      team.slot,
      explicitDraftOrder.get(teamKey),
    );
    if (!draftSlot) continue;

    const teamId = `team_${draftSlot}`;
    teamKeyToTeamId[teamKey] = teamId;
    normalizedTeams.push({
      teamId,
      teamKey,
      yahooTeamId: cleanString(team.teamId ?? team.team_id) ?? yahooTeamIdFromKey(teamKey),
      name: cleanString(team.name ?? team.teamName ?? team.team_name) ?? `Team ${draftSlot}`,
      draftSlot,
    });
    if (selectedTeamKey && teamKey === selectedTeamKey) {
      selectedDraftSlot = draftSlot;
    }
  }

  return {
    teamKeyToTeamId,
    selectedDraftSlot,
    teams: normalizedTeams.sort((a, b) => a.draftSlot - b.draftSlot),
  };
}

function teamKeyFromDraftOrderItem(item) {
  if (typeof item === "string") return cleanString(item);
  return cleanString(item?.teamKey ?? item?.team_key);
}

function yahooTeamIdFromKey(teamKey) {
  const match = String(teamKey ?? "").match(/\.t\.(\d+)$/);
  return match?.[1] ?? null;
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function cleanString(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}
