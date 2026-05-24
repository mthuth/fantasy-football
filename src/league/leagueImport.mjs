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

  return {
    ...baseLeague,
    leagueId: imported.leagueId ?? baseLeague.leagueId,
    leagueKey: imported.leagueKey ?? baseLeague.leagueKey,
    name: imported.name ?? baseLeague.name,
    selectedTeamKey: options.selectedTeamKey ?? null,
    selectedTeamName: options.selectedTeamName ?? null,
    yahooTeams: options.selectedLeague?.teams ?? options.yahooTeams ?? [],
    platform: "yahoo",
    season: imported.season ?? baseLeague.season,
    scoring: imported.scoring,
    rosterSlots,
    draft: {
      ...baseLeague.draft,
      ...Object.fromEntries(Object.entries(imported.draft).filter(([, value]) => value !== null && value !== undefined)),
      rounds: options.rounds ?? calculateDraftRounds(rosterSlots),
    },
    importSource: {
      type: "yahoo_settings_payload",
      warnings: imported.rawWarnings,
      selectedTeamKey: options.selectedTeamKey ?? null,
      selectedTeamName: options.selectedTeamName ?? null,
      selectedLeagueLabel: options.selectedLeagueLabel ?? null,
      selectedLeague: options.selectedLeague ?? null,
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
