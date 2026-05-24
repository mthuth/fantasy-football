import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mockLeague } from "../src/draft/mockData.mjs";
import {
  buildLeagueFromYahooSettings,
  parseYahooLeagueSettingsJson,
  summarizeLeagueRules,
} from "../src/league/leagueImport.mjs";

const payload = JSON.parse(await readFile("data/fixtures/yahoo_league_settings_sample.json", "utf8"));
const parsedPayload = parseYahooLeagueSettingsJson(JSON.stringify(payload));
assert.deepEqual(parsedPayload, payload);
assert.throws(
  () => parseYahooLeagueSettingsJson("{bad json"),
  /Invalid Yahoo settings JSON/,
);

const league = buildLeagueFromYahooSettings(mockLeague, payload);
const summary = summarizeLeagueRules(league);

assert.equal(league.name, "Sample Yahoo Half PPR");
assert.equal(league.leagueKey, "461.l.12345");
assert.equal(league.rosterSlots.BENCH, 6);
assert.equal(league.rosterSlots.FLEX, 1);
assert.equal(league.draft.rounds, 15);
assert.equal(league.scoring.reception, 0.5);
assert.equal(summary.scoring.passingTd, 4);
assert.deepEqual(summary.warnings, []);

const yahooSnakeCaseLeague = buildLeagueFromYahooSettings(mockLeague, {
  fantasy_content: {
    league: [
      [
        { league_key: "461.l.77777" },
        { league_id: "77777" },
        { name: "Snake Case League" },
        { season: "2026" },
      ],
      {
        settings: [payload.league.settings],
      },
    ],
  },
}, {
  selectedTeamKey: "461.l.77777.t.4",
  selectedTeamName: "Matt's Team",
  selectedLeagueLabel: "Snake Case League (Matt's Team)",
});

assert.equal(yahooSnakeCaseLeague.leagueKey, "461.l.77777");
assert.equal(yahooSnakeCaseLeague.leagueId, "77777");
assert.equal(yahooSnakeCaseLeague.name, "Snake Case League");
assert.equal(yahooSnakeCaseLeague.importSource.selectedTeamName, "Matt's Team");

const yahooDraftOrderLeague = buildLeagueFromYahooSettings(mockLeague, {
  league: {
    leagueKey: "461.l.88888",
    leagueId: "88888",
    name: "Draft Order League",
    num_teams: 4,
    settings: payload.league.settings,
  },
}, {
  selectedTeamKey: "461.l.88888.t.7",
  selectedTeamName: "Matt's Team",
  selectedLeague: {
    leagueKey: "461.l.88888",
    teamCount: 4,
    teams: [
      { teamKey: "461.l.88888.t.9", teamId: "9", name: "First Slot", draftSlot: 1 },
      { teamKey: "461.l.88888.t.7", teamId: "7", name: "Matt's Team", draftSlot: 2 },
      { teamKey: "461.l.88888.t.1", teamId: "1", name: "Third Slot", draftSlot: 3 },
      { teamKey: "461.l.88888.t.4", teamId: "4", name: "Fourth Slot", draftSlot: 4 },
    ],
  },
});

assert.equal(yahooDraftOrderLeague.teams, 4);
assert.equal(yahooDraftOrderLeague.draft.userDraftSlot, 2);
assert.equal(yahooDraftOrderLeague.userTeamId, "team_2");
assert.equal(yahooDraftOrderLeague.teamKeyToTeamId["461.l.88888.t.7"], "team_2");
assert.equal(yahooDraftOrderLeague.teamKeyToTeamId["461.l.88888.t.1"], "team_3");
assert.equal(yahooDraftOrderLeague.yahooDraftOrderTeams[1].name, "Matt's Team");

console.log(JSON.stringify({
  status: "passed",
  importedLeague: summary,
}, null, 2));
