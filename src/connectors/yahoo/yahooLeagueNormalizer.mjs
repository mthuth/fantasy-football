import { DEFAULT_SCORING } from "../../valuation/scoring.mjs";

const STAT_NAME_MAP = new Map([
  ["passing yards", "passingYards"],
  ["passing touchdowns", "passingTd"],
  ["passing touchdown", "passingTd"],
  ["interceptions", "interception"],
  ["interception", "interception"],
  ["rushing yards", "rushingYards"],
  ["rushing touchdowns", "rushingTd"],
  ["rushing touchdown", "rushingTd"],
  ["receptions", "reception"],
  ["reception", "reception"],
  ["receiving yards", "receivingYards"],
  ["receiving touchdowns", "receivingTd"],
  ["receiving touchdown", "receivingTd"],
  ["fumbles lost", "fumbleLost"],
  ["fumble lost", "fumbleLost"],
  ["field goals", "fieldGoal"],
  ["field goal", "fieldGoal"],
  ["extra points", "extraPoint"],
  ["extra point", "extraPoint"],
  ["sacks", "dstSack"],
  ["sack", "dstSack"],
  ["interceptions made", "dstTakeaway"],
  ["fumbles recovered", "dstTakeaway"],
  ["defensive touchdowns", "dstTd"],
  ["defensive touchdown", "dstTd"],
]);

const ROSTER_POSITION_MAP = new Map([
  ["W/R/T", "FLEX"],
  ["WR/RB/TE", "FLEX"],
  ["W/T", "WR_TE_FLEX"],
  ["Q/W/R/T", "SUPERFLEX"],
  ["BN", "BENCH"],
  ["DEF", "DST"],
  ["D/ST", "DST"],
]);

export function normalizeYahooLeagueSettings(payload, options = {}) {
  const settings = extractSettings(payload);
  const leagueMeta = extractLeagueMeta(payload);
  const rosterSlots = normalizeRosterSlots(settings);
  const scoring = normalizeScoring(settings);
  const warnings = [];

  if (Object.keys(rosterSlots).length === 0) {
    warnings.push("No roster positions found in Yahoo settings payload.");
  }

  if (Object.keys(scoring._sourceOverrides).length === 0) {
    warnings.push("No stat modifiers found in Yahoo settings payload; default half-PPR scoring was used.");
  }

  delete scoring._sourceOverrides;

  return {
    platform: "yahoo",
    leagueId: options.leagueId ?? leagueMeta.leagueId ?? leagueMeta.league_id ?? null,
    leagueKey: options.leagueKey ?? leagueMeta.leagueKey ?? leagueMeta.league_key ?? null,
    name: options.name ?? leagueMeta.name ?? null,
    season: options.season ?? leagueMeta.season ?? null,
    scoring,
    rosterSlots,
    draft: {
      type: normalizeDraftType(settings.draft_type ?? settings.draftType),
      time: settings.draft_time ?? settings.draftTime ?? null,
      status: settings.draft_status ?? settings.draftStatus ?? null,
    },
    rawWarnings: warnings,
  };
}

function extractSettings(payload) {
  if (payload?.settings) return payload.settings;
  if (payload?.league?.settings) return payload.league.settings;

  const league = payload?.fantasy_content?.league;
  if (Array.isArray(league)) {
    for (const item of league) {
      const settings = item?.settings?.[0] ?? item?.settings;
      if (settings) return settings;
    }
  }

  return {};
}

function extractLeagueMeta(payload) {
  if (payload?.league) return payload.league;

  const league = payload?.fantasy_content?.league;
  if (Array.isArray(league)) {
    const meta = league.find((item) => item && !item.settings);
    if (Array.isArray(meta)) {
      return Object.assign({}, ...meta.filter((item) => item && typeof item === "object"));
    }
    if (meta && typeof meta === "object") return meta;
  }

  return {};
}

function normalizeRosterSlots(settings) {
  const positions = settings.roster_positions?.roster_position
    ?? settings.roster_positions?.[0]?.roster_position
    ?? settings.rosterPositions
    ?? [];
  const rows = Array.isArray(positions) ? positions : [positions];
  const slots = {};

  for (const row of rows) {
    const position = normalizeRosterPosition(row.position ?? row.display_position ?? row.name);
    const count = Number(row.count ?? row.num ?? row.value ?? 0);
    if (!position || !Number.isFinite(count) || count <= 0) continue;
    slots[position] = (slots[position] ?? 0) + count;
  }

  return slots;
}

function normalizeScoring(settings) {
  const scoring = { ...DEFAULT_SCORING, _sourceOverrides: {} };
  const modifiers = settings.stat_modifiers?.stats?.stat
    ?? settings.stat_modifiers?.[0]?.stats?.[0]?.stat
    ?? settings.statModifiers
    ?? [];
  const rows = Array.isArray(modifiers) ? modifiers : [modifiers];

  for (const row of rows) {
    const name = normalizeStatName(row.name ?? row.display_name ?? row.stat_display_name ?? row.stat);
    const scoringKey = STAT_NAME_MAP.get(name);
    const value = Number(row.value ?? row.points ?? row.modifier);
    if (!scoringKey || !Number.isFinite(value)) continue;
    scoring[scoringKey] = value;
    scoring._sourceOverrides[scoringKey] = value;
  }

  return scoring;
}

function normalizeRosterPosition(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toUpperCase();
  return ROSTER_POSITION_MAP.get(cleaned) ?? cleaned;
}

function normalizeStatName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDraftType(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase();
  if (cleaned.includes("auction") || cleaned.includes("salary")) return "salary_cap";
  if (cleaned.includes("auto")) return "autopick";
  if (cleaned.includes("offline")) return "offline";
  return "snake";
}
