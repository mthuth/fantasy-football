import assert from "node:assert/strict";
import { normalizeYahooDraftResults } from "../src/connectors/yahoo/yahooDraftResultsNormalizer.mjs";

const yahooLikePayload = {
  fantasy_content: {
    league: [
      { league_key: "461.l.12345" },
      {
        draft_results: {
          0: {
            draft_result: [
              { pick: "1" },
              { round: "1" },
              { team_key: "461.l.12345.t.1" },
              { player_key: "461.p.7200" },
            ],
          },
          1: {
            draft_result: {
              pick: 2,
              round: 1,
              team_key: "461.l.12345.t.2",
              player_key: "461.p.999999",
            },
          },
        },
      },
    ],
  },
};

const normalized = normalizeYahooDraftResults(yahooLikePayload, {
  externalIds: [
    {
      player_id: "ply_sleeper_abc",
      source: "yahoo",
      source_player_id: "7200",
    },
  ],
});

assert.equal(normalized.summary.pickCount, 2);
assert.equal(normalized.summary.mappedPickCount, 1);
assert.equal(normalized.summary.unmappedPlayerCount, 1);
assert.equal(normalized.leagueKey, "461.l.12345");
assert.equal(normalized.eventCount, 2);
assert.equal(normalized.unmatchedCount, 1);
assert.equal(normalized.picks[0].pickNumber, 1);
assert.equal(normalized.picks[0].round, 1);
assert.equal(normalized.picks[0].teamId, "team_1");
assert.equal(normalized.picks[0].yahooPlayerId, "7200");
assert.equal(normalized.picks[0].canonicalPlayerId, "ply_sleeper_abc");
assert.equal(normalized.picks[0].playerId, "ply_sleeper_abc");
assert.equal(normalized.events[0].matchStatus, "matched");
assert.equal(normalized.events[1].matchStatus, "manual_required");
assert.equal(normalized.unmappedPlayers[0].reason, "yahoo_player_not_mapped");

const mappedDraftOrder = normalizeYahooDraftResults({
  fantasy_content: {
    league: [
      { league_key: "461.l.77777" },
      {
        draft_results: {
          0: {
            draft_result: [
              { pick: "1" },
              { team_key: "461.l.77777.t.7" },
              { player_key: "461.p.7200" },
            ],
          },
        },
      },
    ],
  },
}, {
  externalIds: [
    {
      player_id: "ply_sleeper_abc",
      source: "yahoo",
      source_player_id: "7200",
    },
  ],
  teamKeyToTeamId: {
    "461.l.77777.t.7": "team_2",
  },
  teamCount: 4,
});

assert.equal(mappedDraftOrder.picks[0].teamId, "team_2");
assert.equal(mappedDraftOrder.events[0].teamId, "2");
assert.equal(mappedDraftOrder.picks[0].round, 1);

console.log(JSON.stringify({
  status: "passed",
  tested: ["Yahoo draftresults normalization", "Yahoo player ID mapping", "unmatched manual fallback", "explicit Yahoo team key draft-slot mapping"],
}, null, 2));
