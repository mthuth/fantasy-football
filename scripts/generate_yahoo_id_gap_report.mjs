import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const generatedAt = new Date().toISOString();
const topRankLimit = Number.parseInt(process.env.TOP_RANK_LIMIT ?? "200", 10);

const playerPoolPath = path.join(projectRoot, "data", "mock", "current_player_pool.json");
const canonicalPlayersPath = path.join(projectRoot, "data", "normalized", "players.json");
const externalIdsPath = path.join(projectRoot, "data", "normalized", "player_external_ids.json");
const sleeperSummaryPath = path.join(projectRoot, "data", "normalized", "sleeper_import_summary.json");
const dynastySummaryPath = path.join(projectRoot, "data", "normalized", "dynastyprocess_import_summary.json");
const outputDir = path.join(projectRoot, "data", "reports");

const playerPoolPayload = JSON.parse(await readFile(playerPoolPath, "utf8"));
const playerPool = playerPoolPayload.players ?? [];
const canonicalPlayers = JSON.parse(await readFile(canonicalPlayersPath, "utf8"));
const externalIds = JSON.parse(await readFile(externalIdsPath, "utf8"));
const sleeperSummary = await readJsonIfExists(sleeperSummaryPath);
const dynastySummary = await readJsonIfExists(dynastySummaryPath);

const externalIdsByPlayer = groupExternalIdsByPlayer(externalIds);
const yahooMappedPlayerIds = new Set(
  externalIds
    .filter((row) => row.source === "yahoo" && row.source_player_id && row.player_id)
    .map((row) => row.player_id),
);
const canonicalById = new Map(canonicalPlayers.map((player) => [player.player_id, player]));
const canonicalDefenseByTeam = new Map(
  canonicalPlayers
    .filter((player) => (player.positions ?? []).includes("DST") && player.team)
    .map((player) => [normalizeTeam(player.team), player]),
);

const prioritizedRows = playerPool
  .filter((player) => isDraftRelevantMissingYahoo(player, yahooMappedPlayerIds))
  .map((player) => buildMissingRow(player))
  .sort(comparePriorityRows);

const summary = buildSummary(prioritizedRows);
const topMissingRows = prioritizedRows.filter((row) => row.rank_scope === `top_${topRankLimit}`);
const kickerDefenseRows = prioritizedRows.filter((row) => row.rank_scope === "k_dst");
const otherMissingRows = prioritizedRows.filter((row) => row.rank_scope === "other_pool");
const realKickerCandidates = buildRealKickerCandidates();

const report = {
  generated_at: generatedAt,
  source_files: {
    player_pool: "data/mock/current_player_pool.json",
    canonical_players: "data/normalized/players.json",
    external_ids: "data/normalized/player_external_ids.json",
    sleeper_summary: "data/normalized/sleeper_import_summary.json",
    dynastyprocess_summary: "data/normalized/dynastyprocess_import_summary.json",
  },
  assumptions: [
    `Primary scope is draft-pool players with sourceRank <= ${topRankLimit}, plus every K and DST in the generated pool.`,
    "Yahoo IDs are treated as external mappings; missing IDs are reported, not guessed.",
    "Generated K and DST rows should use canonical player IDs when available; remaining gaps need verified Yahoo external IDs before live drafts.",
  ],
  import_context: {
    sleeper_imported_at: sleeperSummary?.imported_at ?? null,
    dynastyprocess_imported_at: dynastySummary?.imported_at ?? null,
    player_pool_generated_at: playerPoolPayload.generated_at ?? null,
  },
  summary,
  missing_mappings: prioritizedRows,
  real_kicker_candidates_missing_yahoo: realKickerCandidates,
};

await mkdir(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, "yahoo_id_gap_report.json");
const csvPath = path.join(outputDir, "yahoo_id_gap_report.csv");
const mdPath = path.join(outputDir, "yahoo_id_gap_report.md");

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(csvPath, toCsv(prioritizedRows, [
  "priority",
  "reason",
  "rank_scope",
  "source_rank",
  "adp",
  "name",
  "position",
  "team",
  "player_id",
  "sleeper_id",
  "known_external_sources",
  "issue",
  "recommended_action",
]));
await writeFile(mdPath, buildMarkdownReport({
  report,
  topMissingRows,
  kickerDefenseRows,
  otherMissingRows,
  realKickerCandidates,
}));

console.log(JSON.stringify({
  generatedAt,
  topRankLimit,
  outputs: {
    json: path.relative(projectRoot, jsonPath),
    csv: path.relative(projectRoot, csvPath),
    markdown: path.relative(projectRoot, mdPath),
  },
  summary,
}, null, 2));

function isDraftRelevantMissingYahoo(player, mappedPlayerIds) {
  if (mappedPlayerIds.has(player.playerId)) return false;
  if (Number(player.sourceRank) <= topRankLimit) return true;
  return player.position === "K" || player.position === "DST";
}

function buildMissingRow(player) {
  const rankScope = Number(player.sourceRank) <= topRankLimit
    ? `top_${topRankLimit}`
    : player.position === "K" || player.position === "DST"
      ? "k_dst"
      : "other_pool";
  const canonicalPlayer = canonicalById.get(player.playerId);
  const mappedDefense = player.position === "DST"
    ? canonicalDefenseByTeam.get(normalizeTeam(player.team))
    : null;
  const externalRows = externalIdsByPlayer.get(player.playerId) ?? [];
  const sleeperId = externalRows.find((row) => row.source === "sleeper")?.source_player_id
    ?? canonicalPlayer?.source_player_id
    ?? mappedDefense?.source_player_id
    ?? null;
  const priority = inferPriority(player, rankScope);
  const isSynthetic = player.source?.startsWith("synthetic");

  return {
    priority,
    reason: priorityReason(priority),
    rank_scope: rankScope,
    source_rank: round(player.sourceRank, 1),
    adp: round(player.adp, 1),
    name: player.name,
    position: player.position,
    team: player.team,
    player_id: player.playerId,
    sleeper_id: sleeperId,
    known_external_sources: summarizeExternalSources(externalRows),
    synthetic: isSynthetic,
    issue: inferIssue(player, mappedDefense),
    recommended_action: inferRecommendedAction(player, mappedDefense),
  };
}

function inferPriority(player, rankScope) {
  if (Number(player.sourceRank) <= 100 && !player.source?.startsWith("synthetic")) return "P0";
  if (rankScope === `top_${topRankLimit}` && !player.source?.startsWith("synthetic")) return "P1";
  if (player.position === "DST") return "P1";
  if (player.position === "K") return "P2";
  return "P3";
}

function priorityReason(priority) {
  return {
    P0: "Top-100 live-draft player missing Yahoo ID.",
    P1: "Top-200 or DST gap likely to affect live draft sync.",
    P2: "Kicker mapping gap; relevant if league drafts kickers.",
    P3: "Lower-priority generated pool gap.",
  }[priority];
}

function inferIssue(player, mappedDefense) {
  if (player.position === "K") {
    return player.source?.startsWith("synthetic")
      ? "Generated pool uses a synthetic team kicker row that cannot be matched to Yahoo's player-level kicker IDs."
      : "Canonical kicker row has no active Yahoo external ID mapping.";
  }
  if (player.position === "DST" && mappedDefense) {
    return player.playerId === mappedDefense.player_id
      ? "Canonical Sleeper DST row has no active Yahoo external ID mapping."
      : "Generated pool uses a synthetic DST row while the canonical Sleeper DST row has no Yahoo external ID.";
  }
  if (player.source?.startsWith("synthetic")) {
    return "Generated synthetic row has no Yahoo external ID mapping.";
  }
  return "Canonical draft-pool player has no active Yahoo external ID mapping.";
}

function inferRecommendedAction(player, mappedDefense) {
  if (player.position === "K") {
    return player.source?.startsWith("synthetic")
      ? "Replace team-level synthetic K rows with canonical kicker players, then add/verify Yahoo IDs for likely team kickers."
      : "Look up the kicker in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database.";
  }
  if (player.position === "DST" && mappedDefense) {
    return player.playerId === mappedDefense.player_id
      ? `Add/verify Yahoo DST ID for canonical ${mappedDefense.player_id}.`
      : `Map synthetic ${player.team} DST to canonical ${mappedDefense.player_id}, then add/verify Yahoo DST ID for that canonical row.`;
  }
  if (player.source?.startsWith("synthetic")) {
    return "Create a canonical external-ID mapping strategy before allowing live Yahoo sync for this generated row.";
  }
  return "Look up the player in Yahoo player search or draft payload, add the Yahoo external ID to player_external_ids, then reload the database.";
}

function buildRealKickerCandidates() {
  return canonicalPlayers
    .filter((player) => {
      if (!(player.positions ?? []).includes("K")) return false;
      if (player.active === false) return false;
      if (!player.fantasy_relevant) return false;
      if (!player.team || player.team === "FA") return false;
      return !yahooMappedPlayerIds.has(player.player_id);
    })
    .map((player) => ({
      player_id: player.player_id,
      name: player.display_name,
      team: player.team,
      sleeper_id: (externalIdsByPlayer.get(player.player_id) ?? [])
        .find((row) => row.source === "sleeper")?.source_player_id ?? player.source_player_id ?? null,
      depth_chart_order: player.depth_chart_order ?? null,
      current_status: player.current_status ?? null,
      issue: "Canonical kicker candidate has no Yahoo external ID.",
    }))
    .sort((a, b) =>
      (a.depth_chart_order ?? 99) - (b.depth_chart_order ?? 99)
      || normalizeTeam(a.team).localeCompare(normalizeTeam(b.team))
      || a.name.localeCompare(b.name)
    );
}

function buildSummary(rows) {
  const scopedRows = rows.filter((row) => row.rank_scope === `top_${topRankLimit}` || row.rank_scope === "k_dst");
  return {
    draft_pool_players: playerPool.length,
    scoped_missing_count: scopedRows.length,
    top_rank_limit: topRankLimit,
    top_rank_missing_count: rows.filter((row) => row.rank_scope === `top_${topRankLimit}`).length,
    kicker_defense_missing_count: rows.filter((row) => row.position === "K" || row.position === "DST").length,
    synthetic_missing_count: rows.filter((row) => row.synthetic).length,
    by_priority: countBy(rows, "priority"),
    by_position: countBy(rows, "position"),
    top_rank_by_position: countBy(rows.filter((row) => row.rank_scope === `top_${topRankLimit}`), "position"),
    real_kicker_candidates_missing_yahoo_count: buildRealKickerCandidates().length,
  };
}

function buildMarkdownReport({
  report: markdownReport,
  topMissingRows: topRows,
  kickerDefenseRows: kdRows,
  otherMissingRows: otherRows,
  realKickerCandidates: kickerCandidates,
}) {
  const lines = [
    "# Yahoo ID Gap Report",
    "",
    `Generated: ${markdownReport.generated_at}`,
    "",
    "## Summary",
    "",
    `- Scope: draft-pool players with sourceRank <= ${topRankLimit}, plus every generated K and DST row.`,
    `- Scoped missing mappings: ${markdownReport.summary.scoped_missing_count}`,
    `- Top-${topRankLimit} missing mappings: ${markdownReport.summary.top_rank_missing_count}`,
    `- K/DST missing mappings: ${markdownReport.summary.kicker_defense_missing_count}`,
    `- Synthetic missing rows: ${markdownReport.summary.synthetic_missing_count}`,
    `- Real kicker candidates missing Yahoo IDs: ${markdownReport.summary.real_kicker_candidates_missing_yahoo_count}`,
    `- Player pool generated at: ${markdownReport.import_context.player_pool_generated_at ?? "unknown"}`,
    `- Sleeper import: ${markdownReport.import_context.sleeper_imported_at ?? "unknown"}`,
    `- DynastyProcess import: ${markdownReport.import_context.dynastyprocess_imported_at ?? "unknown"}`,
    "",
    "## Priority Key",
    "",
    "- P0: Top-100 live-draft player missing Yahoo ID.",
    "- P1: Top-200 or DST gap likely to affect live draft sync.",
    "- P2: Kicker mapping gap; relevant if league drafts kickers.",
    "- P3: Lower-priority generated pool gap.",
    "",
    "## Top Draft-Pool Gaps",
    "",
    ...tableForRows(topRows, 80),
    "",
    "## K/DST Gaps Outside Top Scope",
    "",
    ...tableForRows(kdRows, 80),
    "",
    "## Real Kicker Candidates Missing Yahoo IDs",
    "",
    ...tableForKickers(kickerCandidates, 80),
  ];

  if (otherRows.length > 0) {
    lines.push(
      "",
      "## Other Generated Pool Gaps",
      "",
      ...tableForRows(otherRows, 80),
    );
  }

  lines.push(
    "",
    "## Next Actions",
    "",
    "1. Resolve P0/P1 offensive players first from Yahoo player search or live draft payload IDs.",
    "2. Add/verify Yahoo IDs for canonical DST rows before relying on live Yahoo DST sync.",
    "3. Add/verify Yahoo IDs for canonical kicker rows that remain unmapped.",
    "4. After edits, rerun `node scripts/load_player_database.mjs` and regenerate this report.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function tableForRows(rows, limit) {
  const displayed = rows.slice(0, limit);
  if (displayed.length === 0) return ["No rows."];
  const lines = [
    "| Priority | Rank | Player | Pos | Team | Internal ID | Sleeper ID | Action |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of displayed) {
    lines.push([
      row.priority,
      row.source_rank,
      row.name,
      row.position,
      row.team,
      row.player_id,
      row.sleeper_id ?? "",
      row.recommended_action,
    ].map(markdownCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  if (rows.length > displayed.length) lines.push(`\nShowing ${displayed.length} of ${rows.length} rows. See CSV/JSON for the full list.`);
  return lines;
}

function tableForKickers(rows, limit) {
  const displayed = rows.slice(0, limit);
  if (displayed.length === 0) return ["No rows."];
  const lines = [
    "| Name | Team | Depth | Status | Internal ID | Sleeper ID |",
    "| --- | --- | ---: | --- | --- | --- |",
  ];
  for (const row of displayed) {
    lines.push([
      row.name,
      row.team,
      row.depth_chart_order ?? "",
      row.current_status ?? "",
      row.player_id,
      row.sleeper_id ?? "",
    ].map(markdownCell).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  if (rows.length > displayed.length) lines.push(`\nShowing ${displayed.length} of ${rows.length} rows. See JSON for the full list.`);
  return lines;
}

function groupExternalIdsByPlayer(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.player_id)) grouped.set(row.player_id, []);
    grouped.get(row.player_id).push(row);
  }
  return grouped;
}

function summarizeExternalSources(rows) {
  return rows
    .map((row) => row.source)
    .filter((source) => source !== "yahoo")
    .sort()
    .join("|");
}

function countBy(rows, field) {
  return rows.reduce((counts, row) => {
    const value = row[field] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function comparePriorityRows(a, b) {
  return priorityWeight(a.priority) - priorityWeight(b.priority)
    || Number(a.source_rank) - Number(b.source_rank)
    || a.position.localeCompare(b.position)
    || a.name.localeCompare(b.name);
}

function priorityWeight(priority) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 9;
}

function normalizeTeam(team) {
  if (team === "LVR") return "LV";
  if (team === "JAC") return "JAX";
  return String(team ?? "").toUpperCase();
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function round(value, places) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return `${[header, ...body].join("\n")}\n`;
}

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const stringValue = Array.isArray(value) ? value.join("|") : String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replaceAll('"', '""')}"`;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
