import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeYahooLeagueSettings } from "../src/connectors/yahoo/yahooLeagueNormalizer.mjs";

const sample = JSON.parse(await readFile("data/fixtures/yahoo_league_settings_sample.json", "utf8"));
const league = normalizeYahooLeagueSettings(sample);

assert.equal(league.platform, "yahoo");
assert.equal(league.leagueId, "12345");
assert.equal(league.leagueKey, "461.l.12345");
assert.equal(league.name, "Sample Yahoo Half PPR");
assert.equal(league.draft.type, "snake");
assert.deepEqual(league.rosterSlots, {
  QB: 1,
  WR: 2,
  RB: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 6,
});
assert.equal(league.scoring.reception, 0.5);
assert.equal(league.scoring.passingTd, 4);
assert.equal(league.scoring.interception, -2);
assert.deepEqual(league.rawWarnings, []);

console.log(JSON.stringify({
  status: "passed",
  league: league.name,
  rosterSlots: league.rosterSlots,
}, null, 2));
