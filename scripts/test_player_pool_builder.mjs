import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPlayerPoolFromCanonical } from "../src/draft/playerPoolBuilder.mjs";

const canonicalPlayers = JSON.parse(await readFile("data/normalized/players.json", "utf8"));
const externalIds = JSON.parse(await readFile("data/normalized/player_external_ids.json", "utf8"));
const yahooMappedIds = new Set(externalIds
  .filter((row) => row.source === "yahoo" && row.source_player_id)
  .map((row) => row.player_id));

const playerPool = buildPlayerPoolFromCanonical(canonicalPlayers);
const kickers = playerPool.filter((player) => player.position === "K");
const defenses = playerPool.filter((player) => player.position === "DST");

assert.equal(kickers.length, 32);
assert.equal(defenses.length, 32);
assert.equal(kickers.filter((player) => player.source === "synthetic_kicker").length, 0);
assert.equal(defenses.filter((player) => player.source === "synthetic_dst").length, 0);
assert.ok(kickers.filter((player) => yahooMappedIds.has(player.playerId)).length >= 20);
assert.ok(defenses.every((player) => player.playerId.startsWith("ply_sleeper_")));

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "canonical kicker generation",
    "canonical DST generation",
    "generated kicker Yahoo ID coverage",
  ],
}, null, 2));
