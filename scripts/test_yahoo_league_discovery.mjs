import assert from "node:assert/strict";
import { discoverYahooLeagueOptions } from "../src/connectors/yahoo/yahooLeagueDiscovery.mjs";

const yahooLikePayload = {
  fantasy_content: {
    users: {
      0: {
        user: [
          { guid: "abc" },
          {
            games: {
              0: {
                game: [
                  { game_key: "461" },
                  {
                    teams: {
                      0: {
                        team: [
                          { team_key: "461.l.12345.t.4" },
                          { team_id: "4" },
                          { num_teams: "10" },
                          { draft_slot: "7" },
                          { name: "Matt's Team" },
                          { url: "https://football.fantasysports.yahoo.com/f1/12345/4" },
                          { is_owned_by_current_login: 1 },
                        ],
                      },
                      1: {
                        team: [
                          { team_key: "461.l.99999.t.1" },
                          { name: "Second League Team" },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  },
};

const leagues = discoverYahooLeagueOptions(yahooLikePayload);

assert.equal(leagues.length, 2);
assert.equal(leagues[0].leagueKey, "461.l.12345");
assert.equal(leagues[0].leagueId, "12345");
assert.equal(leagues[0].season, "461");
assert.equal(leagues[0].teamCount, 10);
assert.equal(leagues[0].primaryTeam.teamKey, "461.l.12345.t.4");
assert.equal(leagues[0].primaryTeam.draftSlot, 7);
assert.equal(leagues[0].teams[0].teamKey, "461.l.12345.t.4");
assert.equal(leagues[0].teams[0].teamId, "4");
assert.equal(leagues[0].teams[0].name, "Matt's Team");
assert.equal(leagues[1].leagueKey, "461.l.99999");

console.log(JSON.stringify({
  status: "passed",
  tested: ["Yahoo team payload league discovery", "league key extraction", "team metadata extraction", "primary team selection"],
}, null, 2));
