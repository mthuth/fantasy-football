export function assessYahooLiveDraftReadiness(status, options = {}) {
  const checks = [
    check("oauth_config", status?.configured === true, "Yahoo OAuth client configuration is present."),
    check("token_connected", status?.token?.connected === true, "A local Yahoo access token is available."),
    check("refresh_token", status?.token?.hasRefreshToken === true, "A Yahoo refresh token is available for draft-day sessions."),
    check("league_selected", Boolean(options.selectedLeague?.leagueKey), "A Yahoo league has been selected."),
    check("team_selected", Boolean(selectedTeamKey(options.selectedLeague)), "A Yahoo team has been selected."),
    check("draft_results_sync", options.draftResults?.syncStatus === "synced", "Yahoo draft results can be read and normalized."),
    check("player_mapping", mappingReady(options.playerAudit), "The active player pool has usable Yahoo player ID mappings."),
    check("read_only_guardrail", status?.readOnly === true, "Yahoo connector is still read-only."),
  ];
  const blockers = checks.filter((item) => !item.ready);

  return {
    readyForLiveDraft: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    checks,
    blockers: blockers.map((item) => item.id),
    nextActions: blockers.map((item) => item.nextAction),
  };
}

function selectedTeamKey(selectedLeague) {
  return selectedLeague?.teamKey
    ?? selectedLeague?.selectedTeamKey
    ?? selectedLeague?.primaryTeam?.teamKey
    ?? null;
}

function mappingReady(playerAudit) {
  if (!playerAudit) return false;
  if (playerAudit.playerCount === 0) return false;
  const mappedRatio = playerAudit.yahooMappedCount / playerAudit.playerCount;
  return mappedRatio >= 0.9 && playerAudit.missingRequiredPositions.length === 0;
}

function check(id, ready, readyMessage) {
  return {
    id,
    ready,
    message: ready ? readyMessage : BLOCKER_MESSAGES[id],
    nextAction: ready ? null : NEXT_ACTIONS[id],
  };
}

const BLOCKER_MESSAGES = {
  oauth_config: "Yahoo OAuth client configuration is missing.",
  token_connected: "Yahoo has not been connected locally.",
  refresh_token: "Yahoo token storage does not include a refresh token.",
  league_selected: "No Yahoo league is selected.",
  team_selected: "No Yahoo team is selected.",
  draft_results_sync: "Yahoo draft results have not been proven readable for this league.",
  player_mapping: "Yahoo player ID coverage is not ready for the active player pool.",
  read_only_guardrail: "Yahoo read-only guardrail is not confirmed.",
};

const NEXT_ACTIONS = {
  oauth_config: "Create a Yahoo developer app and set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, and YAHOO_REDIRECT_URI.",
  token_connected: "Run the dashboard and use Connect Yahoo.",
  refresh_token: "Reconnect Yahoo so the local token store has a refresh token.",
  league_selected: "Use league discovery and import the target Yahoo league.",
  team_selected: "Select the fantasy team that belongs to the user.",
  draft_results_sync: "Run draft-results polling against a real or controlled Yahoo draft.",
  player_mapping: "Run the player data quality audit and fill Yahoo external ID gaps.",
  read_only_guardrail: "Keep Yahoo write methods disabled before live use.",
};
