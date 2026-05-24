import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadLocalEnv } from "../src/config/loadLocalEnv.mjs";
import { loadYahooLeagueSettingsProfile } from "../src/league/leagueProfileStore.mjs";
import { loadYahooTokens } from "../src/connectors/yahoo/YahooTokenStore.mjs";
import { assessYahooLiveDraftReadiness } from "../src/connectors/yahoo/yahooReadiness.mjs";
import { auditPlayerPoolQuality } from "../src/data/playerDataQuality.mjs";
import { mockPlayers } from "../src/draft/mockData.mjs";

await loadLocalEnv();

const status = await getLocalYahooStatus();
const profile = await loadYahooLeagueSettingsProfile();
const externalIds = await loadExternalPlayerIds();
const playerAudit = auditPlayerPoolQuality(mockPlayers, { externalIds });
const readiness = assessYahooLiveDraftReadiness(status, {
  selectedLeague: profile.selectedLeague,
  draftResults: null,
  playerAudit,
});

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  readiness,
  yahoo: status,
  selectedLeague: profile.selectedLeague ?? null,
  playerAudit: {
    playerCount: playerAudit.playerCount,
    yahooMappedCount: playerAudit.yahooMappedCount,
    missingYahooIdCount: playerAudit.missingYahooIdCount,
    missingRequiredPositions: playerAudit.missingRequiredPositions,
    status: playerAudit.status,
  },
}, null, 2));

async function getLocalYahooStatus() {
  const saved = await loadYahooTokens();
  const config = {
    hasClientId: Boolean(process.env.YAHOO_CLIENT_ID),
    hasClientSecret: Boolean(process.env.YAHOO_CLIENT_SECRET),
    redirectUri: process.env.YAHOO_REDIRECT_URI ?? null,
  };

  return {
    configured: config.hasClientId && config.hasClientSecret && Boolean(config.redirectUri),
    config,
    token: saved.summary ?? { connected: false, hasRefreshToken: false, expiresAt: null, scope: null },
    readOnly: true,
  };
}

async function loadExternalPlayerIds() {
  try {
    const payload = JSON.parse(await readFile(path.resolve("data/normalized/player_external_ids.json"), "utf8"));
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}
