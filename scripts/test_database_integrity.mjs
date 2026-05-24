import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dbPath = "data/db/fantasy_football_agent.sqlite";
const requiredTables = [
  "players",
  "player_external_ids",
  "import_runs",
  "sleeper_external_id_conflicts",
  "dynastyprocess_unmatched_playerids",
  "dynastyprocess_match_conflicts",
  "skipped_external_id_conflicts",
];

assert.ok(existsSync(dbPath), "SQLite player identity database should exist");

const integrity = execFileSync("sqlite3", [dbPath, "PRAGMA integrity_check;"], { encoding: "utf8" }).trim();
assert.equal(integrity, "ok");

const tables = execFileSync("sqlite3", [dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"], {
  encoding: "utf8",
}).trim().split("\n");

for (const table of requiredTables) {
  assert.ok(tables.includes(table), `SQLite database should include ${table}`);
}

const playerCount = Number(execFileSync("sqlite3", [dbPath, "SELECT COUNT(*) FROM players;"], { encoding: "utf8" }));
const externalIdCount = Number(execFileSync("sqlite3", [dbPath, "SELECT COUNT(*) FROM player_external_ids;"], { encoding: "utf8" }));
const importRunCount = Number(execFileSync("sqlite3", [dbPath, "SELECT COUNT(*) FROM import_runs;"], { encoding: "utf8" }));

assert.ok(playerCount > 0, "players table should be loaded");
assert.ok(externalIdCount > 0, "player_external_ids table should be loaded");
assert.ok(importRunCount > 0, "import_runs table should record source loads");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "SQLite database exists",
    "SQLite integrity check",
    "required player identity tables",
    "loaded player and external ID rows",
  ],
}, null, 2));
