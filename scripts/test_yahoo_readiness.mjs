import assert from "node:assert/strict";
import { assessYahooLiveDraftReadiness } from "../src/connectors/yahoo/yahooReadiness.mjs";

const blocked = assessYahooLiveDraftReadiness({
  configured: false,
  token: { connected: false, hasRefreshToken: false },
  readOnly: true,
});

assert.equal(blocked.readyForLiveDraft, false);
assert.ok(blocked.blockers.includes("oauth_config"));
assert.ok(blocked.blockers.includes("draft_results_sync"));

const ready = assessYahooLiveDraftReadiness({
  configured: true,
  token: { connected: true, hasRefreshToken: true },
  readOnly: true,
}, {
  selectedLeague: { leagueKey: "461.l.123", teamKey: "461.l.123.t.1" },
  draftResults: { syncStatus: "synced" },
  playerAudit: {
    playerCount: 100,
    yahooMappedCount: 95,
    missingRequiredPositions: [],
  },
});

assert.equal(ready.readyForLiveDraft, true);
assert.deepEqual(ready.blockers, []);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "Yahoo readiness blockers",
    "Yahoo readiness ready state",
  ],
}, null, 2));
