import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const normalizedDir = path.join(projectRoot, "data", "normalized");
const dbDir = path.join(projectRoot, "data", "db");
const schemaPath = path.join(projectRoot, "db", "schema.sql");
const dbPath = path.join(dbDir, "fantasy_football_agent.sqlite");
const tempSqlPath = path.join(dbDir, "load_player_database.sql");
const summaryPath = path.join(dbDir, "load_player_database_summary.json");

function sqlValue(value) {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonValue(value) {
  return sqlValue(JSON.stringify(value ?? null));
}

function insertStatement(table, columns, row) {
  const values = columns.map((column) => sqlValue(row[column])).join(", ");
  return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values});`;
}

function readJson(relativePath) {
  return readFile(path.join(normalizedDir, relativePath), "utf8").then(JSON.parse);
}

function playerRow(player) {
  return {
    player_id: player.player_id,
    display_name: player.display_name,
    first_name: player.first_name,
    last_name: player.last_name,
    suffix: player.suffix,
    team: player.team,
    positions_json: JSON.stringify(player.positions ?? []),
    eligible_positions_json: JSON.stringify(player.eligible_positions ?? []),
    fantasy_relevant: player.fantasy_relevant ? 1 : 0,
    nfl_gsis_id: player.nfl_gsis_id,
    external_ids_json: JSON.stringify(player.external_ids ?? {}),
    birth_date: player.birth_date,
    height: player.height,
    weight: player.weight,
    college: player.college,
    years_exp: player.years_exp,
    rookie_year: player.rookie_year,
    jersey_number: player.jersey_number,
    depth_chart_position: player.depth_chart_position,
    depth_chart_order: player.depth_chart_order,
    active: player.active === null || player.active === undefined ? null : player.active ? 1 : 0,
    current_status: player.current_status,
    injury_status: player.injury_status,
    source: player.source,
    source_player_id: player.source_player_id,
    last_verified_at: player.last_verified_at,
    last_identity_crosswalk_at: player.last_identity_crosswalk_at,
  };
}

function buildSql({
  schema,
  players,
  externalIds,
  sleeperSummary,
  dynastySummary,
  sleeperConflicts,
  dynastyUnmatched,
  dynastyConflicts,
}) {
  const sql = [schema, "BEGIN TRANSACTION;"];

  const importColumns = [
    "import_id",
    "source",
    "source_url",
    "imported_at",
    "raw_count",
    "normalized_count",
    "summary_json",
  ];

  sql.push(insertStatement("import_runs", importColumns, {
    import_id: `sleeper:${sleeperSummary.imported_at}`,
    source: sleeperSummary.source,
    source_url: sleeperSummary.source_url,
    imported_at: sleeperSummary.imported_at,
    raw_count: sleeperSummary.raw_player_count,
    normalized_count: sleeperSummary.normalized_player_count,
    summary_json: JSON.stringify(sleeperSummary),
  }));

  sql.push(insertStatement("import_runs", importColumns, {
    import_id: `dynastyprocess:${dynastySummary.imported_at}`,
    source: dynastySummary.source,
    source_url: dynastySummary.source_url,
    imported_at: dynastySummary.imported_at,
    raw_count: dynastySummary.crosswalk_row_count,
    normalized_count: dynastySummary.matched_crosswalk_rows,
    summary_json: JSON.stringify(dynastySummary),
  }));

  const playerColumns = [
    "player_id",
    "display_name",
    "first_name",
    "last_name",
    "suffix",
    "team",
    "positions_json",
    "eligible_positions_json",
    "fantasy_relevant",
    "nfl_gsis_id",
    "external_ids_json",
    "birth_date",
    "height",
    "weight",
    "college",
    "years_exp",
    "rookie_year",
    "jersey_number",
    "depth_chart_position",
    "depth_chart_order",
    "active",
    "current_status",
    "injury_status",
    "source",
    "source_player_id",
    "last_verified_at",
    "last_identity_crosswalk_at",
  ];

  for (const player of players) {
    sql.push(insertStatement("players", playerColumns, playerRow(player)));
  }

  const externalIdColumns = [
    "player_id",
    "source",
    "source_player_id",
    "source_player_name",
    "matched_by",
    "match_confidence",
    "first_seen_at",
    "last_seen_at",
  ];

  for (const externalId of externalIds) {
    sql.push(insertStatement("player_external_ids", externalIdColumns, externalId));
  }

  for (const conflict of sleeperConflicts) {
    sql.push(
      `INSERT INTO sleeper_external_id_conflicts (source_id, rows_json) VALUES (${sqlValue(conflict.source_id)}, ${jsonValue(conflict.rows)});`,
    );
  }

  for (const unmatched of dynastyUnmatched) {
    sql.push(insertStatement("dynastyprocess_unmatched_playerids", [
      "name",
      "position",
      "team",
      "sleeper_id",
      "gsis_id",
      "espn_id",
      "yahoo_id",
      "mfl_id",
      "fantasypros_id",
      "row_json",
    ], {
      ...unmatched,
      row_json: JSON.stringify(unmatched),
    }));
  }

  const matchConflicts = Array.isArray(dynastyConflicts)
    ? dynastyConflicts
    : dynastyConflicts.match_conflicts ?? [];
  const skippedExternalIdConflicts = Array.isArray(dynastyConflicts)
    ? []
    : dynastyConflicts.skipped_external_id_conflicts ?? [];

  for (const conflict of matchConflicts) {
    sql.push(
      `INSERT INTO dynastyprocess_match_conflicts (name, position, team, conflicts_json) VALUES (${sqlValue(conflict.name)}, ${sqlValue(conflict.position)}, ${sqlValue(conflict.team)}, ${jsonValue(conflict.conflicts)});`,
    );
  }

  for (const conflict of skippedExternalIdConflicts) {
    sql.push(insertStatement("skipped_external_id_conflicts", [
      "name",
      "position",
      "team",
      "matched_by_json",
      "source",
      "source_player_id",
      "existing_player_id",
      "proposed_player_id",
    ], {
      name: conflict.name,
      position: conflict.position,
      team: conflict.team,
      matched_by_json: JSON.stringify(conflict.matched_by ?? null),
      source: conflict.source,
      source_player_id: conflict.source_player_id,
      existing_player_id: conflict.existing_player_id,
      proposed_player_id: conflict.proposed_player_id,
    }));
  }

  sql.push("COMMIT;");
  return sql.join("\n") + "\n";
}

async function queryScalar(sql) {
  const { stdout } = await execFileAsync("sqlite3", [dbPath, sql], { maxBuffer: 1024 * 1024 });
  return Number(stdout.trim());
}

function runSqlFile(sqlPath) {
  return new Promise((resolve, reject) => {
    const sqlite = spawn("sqlite3", [dbPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    sqlite.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    sqlite.on("error", reject);
    sqlite.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`sqlite3 exited with code ${code}: ${stderr}`));
      }
    });

    createReadStream(sqlPath).pipe(sqlite.stdin);
  });
}

async function main() {
  await mkdir(dbDir, { recursive: true });

  const [
    schema,
    players,
    externalIds,
    sleeperSummary,
    dynastySummary,
    sleeperConflicts,
    dynastyUnmatched,
    dynastyConflicts,
  ] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readJson("players.json"),
    readJson("player_external_ids.json"),
    readJson("sleeper_import_summary.json"),
    readJson("dynastyprocess_import_summary.json"),
    readJson("sleeper_external_id_conflicts.json"),
    readJson("dynastyprocess_unmatched_playerids.json"),
    readJson("dynastyprocess_match_conflicts.json"),
  ]);

  const sql = buildSql({
    schema,
    players,
    externalIds,
    sleeperSummary,
    dynastySummary,
    sleeperConflicts,
    dynastyUnmatched,
    dynastyConflicts,
  });

  await writeFile(tempSqlPath, sql);
  await rm(dbPath, { force: true });
  await runSqlFile(tempSqlPath);

  const summary = {
    loaded_at: new Date().toISOString(),
    database: path.relative(projectRoot, dbPath),
    player_count: await queryScalar("SELECT COUNT(*) FROM players;"),
    fantasy_relevant_player_count: await queryScalar("SELECT COUNT(*) FROM players WHERE fantasy_relevant = 1;"),
    active_fantasy_relevant_player_count: await queryScalar("SELECT COUNT(*) FROM players WHERE fantasy_relevant = 1 AND active = 1;"),
    external_id_count: await queryScalar("SELECT COUNT(*) FROM player_external_ids;"),
    sleeper_external_id_conflict_count: await queryScalar("SELECT COUNT(*) FROM sleeper_external_id_conflicts;"),
    dynastyprocess_unmatched_count: await queryScalar("SELECT COUNT(*) FROM dynastyprocess_unmatched_playerids;"),
    dynastyprocess_match_conflict_count: await queryScalar("SELECT COUNT(*) FROM dynastyprocess_match_conflicts;"),
    skipped_external_id_conflict_count: await queryScalar("SELECT COUNT(*) FROM skipped_external_id_conflicts;"),
  };

  await writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");
  await rm(tempSqlPath, { force: true });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
