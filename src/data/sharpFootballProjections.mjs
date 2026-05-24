import { DEFAULT_SCORING, scoreProjection } from "../valuation/scoring.mjs";

const SOURCE = "sharp_football_projections";
const SOURCE_URL = "https://www.sharpfootballanalysis.com/fantasy/fantasy-football-projections/";
const SCORING_POINT_FIELDS = {
  standard: ["standard", "std", "non-ppr", "non ppr"],
  half_ppr: ["half ppr", "half-ppr", "half_ppr", "0.5 ppr", "half point ppr", "half-point ppr"],
  ppr: ["ppr", "full ppr", "full-ppr", "1 ppr"],
  te_premium: ["te premium", "tep", "te_premium"],
};

export function normalizeSharpFootballProjectionRows(rawRows, players, options = {}) {
  if (!Array.isArray(rawRows)) throw new Error("Sharp Football rows must be an array.");
  const scoring = options.scoring ?? DEFAULT_SCORING;
  const scoringFormat = options.scoringFormat ?? "half_ppr";
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const playerIndex = buildPlayerIndex(players);
  const rows = [];
  const unmatched = [];
  const ambiguous = [];

  rawRows.forEach((row, index) => {
    const playerName = stringValue(pickField(row, ["player", "name", "player name", "player_name"]));
    const position = normalizePosition(stringValue(pickField(row, ["pos", "position"])));
    const team = normalizeTeam(stringValue(pickField(row, ["team", "tm"])));
    const match = matchPlayer({ playerName, position, team, playerIndex });

    if (!match.player) {
      const auditRow = { rowNumber: index + 1, playerName, position, team, reason: match.reason };
      if (match.reason === "ambiguous_match") ambiguous.push({ ...auditRow, candidates: match.candidates });
      else unmatched.push(auditRow);
      return;
    }

    const stats = buildStats(row);
    const projectedPoints = numberOrNull(pickPointField(row, scoringFormat)) ?? scoreProjection(stats, scoring);
    if (!Number.isFinite(projectedPoints)) {
      unmatched.push({ rowNumber: index + 1, playerName, position, team, reason: "missing_projected_points" });
      return;
    }

    rows.push({
      playerId: match.player.playerId,
      source: SOURCE,
      projectedPoints,
      sourceRank: numberOrNull(pickField(row, ["rank", "rk", "overall rank", "source rank"])),
      adp: numberOrNull(pickField(row, ["adp", "avg pick", "average draft position"])),
      risk: numberOrNull(pickField(row, ["risk"])),
      ceiling: numberOrNull(pickField(row, ["ceiling", "upside"])),
      stats,
      confidence: numberOrNull(pickField(row, ["confidence"])) ?? 0.76,
      updatedAt,
    });
  });

  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    rows,
    matchedCount: rows.length,
    unmatched,
    ambiguous,
  };
}

function buildStats(row) {
  return stripNullValues({
    passingYards: numberOrNull(pickField(row, ["pass yds", "pass yards", "passing yds", "passing yards"])),
    passingTd: numberOrNull(pickField(row, ["pass td", "pass tds", "passing td", "passing tds"])),
    interception: numberOrNull(pickField(row, ["int", "ints", "interception", "interceptions"])),
    rushingYards: numberOrNull(pickField(row, ["rush yds", "rush yards", "rushing yds", "rushing yards"])),
    rushingTd: numberOrNull(pickField(row, ["rush td", "rush tds", "rushing td", "rushing tds"])),
    receivingYards: numberOrNull(pickField(row, ["rec yds", "receiving yds", "receiving yards"])),
    receivingTd: numberOrNull(pickField(row, ["rec td", "rec tds", "receiving td", "receiving tds"])),
    reception: numberOrNull(pickField(row, ["rec", "receptions", "reception"])),
  });
}

function buildPlayerIndex(players) {
  const byName = new Map();
  for (const player of players) {
    const nameKey = normalizeName(player.name);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(player);
  }
  return { byName };
}

function matchPlayer({ playerName, position, team, playerIndex }) {
  const candidates = playerIndex.byName.get(normalizeName(playerName)) ?? [];
  if (candidates.length === 0) return { player: null, reason: "no_name_match", candidates: [] };

  const positionMatches = position
    ? candidates.filter((player) => normalizePosition(player.position) === position)
    : candidates;
  const narrowed = positionMatches.length > 0 ? positionMatches : candidates;
  const teamMatches = team
    ? narrowed.filter((player) => normalizeTeam(player.team) === team)
    : narrowed;
  const finalCandidates = teamMatches.length > 0 ? teamMatches : narrowed;

  if (finalCandidates.length === 1) return { player: finalCandidates[0], reason: "matched" };
  return {
    player: null,
    reason: "ambiguous_match",
    candidates: finalCandidates.map((player) => ({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      team: player.team,
    })),
  };
}

function pickPointField(row, scoringFormat) {
  const fields = SCORING_POINT_FIELDS[scoringFormat] ?? SCORING_POINT_FIELDS.half_ppr;
  return pickField(row, fields);
}

function pickField(row, candidates) {
  const normalized = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]);
  for (const candidate of candidates) {
    const key = normalizeHeader(candidate);
    const found = normalized.find(([header]) => header === key);
    if (found) return found[1];
  }
  return null;
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[_/-]+/g, " ")
    .replaceAll(/\s+/g, " ");
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll(/[''.]/g, "")
    .replaceAll(/[^a-z0-9\s-]/g, " ")
    .replaceAll(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function normalizePosition(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeTeam(value) {
  return String(value ?? "").trim().toUpperCase();
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replaceAll(",", "").replaceAll("%", ""));
  return Number.isFinite(number) ? number : null;
}

function stripNullValues(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null));
}
