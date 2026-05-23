import assert from "node:assert/strict";
import { YahooReadOnlyConnector } from "../src/connectors/yahoo/YahooReadOnlyConnector.mjs";

const connector = new YahooReadOnlyConnector({
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://127.0.0.1:3001/oauth/yahoo/callback",
  accessToken: "token",
  fetchImpl: async (url, options) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ url, options }),
  }),
});

assert.equal(connector.capabilities.readLeagueSettings, true);
assert.equal(connector.capabilities.readDraftResults, true);
assert.equal(connector.capabilities.setLineup, false);
assert.equal(connector.capabilities.draftPick, false);

const authUrl = new URL(connector.buildAuthorizationUrl({ state: "state-token" }));
assert.equal(authUrl.searchParams.get("client_id"), "client-id");
assert.equal(authUrl.searchParams.get("redirect_uri"), "http://127.0.0.1:3001/oauth/yahoo/callback");
assert.equal(authUrl.searchParams.get("scope"), "fspt-r");
assert.equal(authUrl.searchParams.get("state"), "state-token");

const settings = await connector.readLeagueSettings("461.l.12345");
assert.ok(settings.url.includes("/league/461.l.12345/settings"));
assert.equal(settings.options.headers.authorization, "Bearer token");

const teams = await connector.readUserTeams();
assert.ok(teams.url.includes("/users;use_login=1/games;game_keys=nfl/teams"));

const refreshed = await connector.refreshAccessToken("refresh-token");
assert.equal(refreshed.options.method, "POST");
assert.equal(refreshed.options.body.get("grant_type"), "refresh_token");
assert.equal(refreshed.options.body.get("refresh_token"), "refresh-token");

await assert.rejects(() => connector.setLineup(), /blocks write action: setLineup/);
await assert.rejects(() => connector.draftPick(), /blocks write action: draftPick/);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "read-only capabilities",
    "oauth authorization url",
    "refresh token request",
    "read endpoint construction",
    "write action blocking",
  ],
}, null, 2));
