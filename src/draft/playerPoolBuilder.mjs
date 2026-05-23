const CANONICAL_POOL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const TEAM_CODES = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

const STAR_RANK_OVERRIDES = new Map([
  ["Christian McCaffrey|RB", 1],
  ["CeeDee Lamb|WR", 2],
  ["Ja'Marr Chase|WR", 3],
  ["Bijan Robinson|RB", 4],
  ["Breece Hall|RB", 5],
  ["Amon-Ra St. Brown|WR", 6],
  ["Justin Jefferson|WR", 7],
  ["Saquon Barkley|RB", 8],
  ["Jahmyr Gibbs|RB", 9],
  ["A.J. Brown|WR", 10],
  ["Puka Nacua|WR", 11],
  ["Garrett Wilson|WR", 12],
  ["Josh Allen|QB", 18],
  ["Jalen Hurts|QB", 19],
  ["Lamar Jackson|QB", 20],
  ["Patrick Mahomes|QB", 30],
  ["Sam LaPorta|TE", 24],
  ["Travis Kelce|TE", 27],
  ["Mark Andrews|TE", 38],
]);

export function buildPlayerPoolFromCanonical(canonicalPlayers, options = {}) {
  const positionLimits = {
    QB: options.qbLimit ?? 36,
    RB: options.rbLimit ?? 70,
    WR: options.wrLimit ?? 80,
    TE: options.teLimit ?? 42,
    K: 32,
    DST: 32,
  };
  const offensivePlayers = canonicalPlayers
    .map(normalizeCanonicalPlayer)
    .filter(Boolean)
    .filter((player) => player.team && player.team !== "FA")
    .sort(compareDraftPriority);

  const selectedCounts = {};
  const ranked = [];
  for (const player of offensivePlayers) {
    const selected = selectedCounts[player.position] ?? 0;
    if (selected >= positionLimits[player.position]) continue;
    selectedCounts[player.position] = selected + 1;
    ranked.push({ ...player, positionRank: selected + 1 });
  }
  const players = ranked.map((player, index) => buildMockPlayer(player, index + 1));
  const dstPlayers = TEAM_CODES.map((team, index) => buildDefense(team, players.length + index + 1));
  const kickerPlayers = TEAM_CODES.map((team, index) => buildKicker(team, players.length + dstPlayers.length + index + 1));

  return [...players, ...dstPlayers, ...kickerPlayers]
    .sort((a, b) => a.sourceRank - b.sourceRank)
    .map((player, index) => ({
      ...player,
      sourceRank: index + 1,
      adp: Number((index + 1 + deterministicJitter(player.playerId, 0, 4)).toFixed(1)),
    }));
}

function normalizeCanonicalPlayer(player) {
  const position = (player.positions ?? []).find((candidate) => CANONICAL_POOL_POSITIONS.has(candidate));
  if (!position) return null;
  if (player.active === false) return null;
  if (!player.fantasy_relevant) return null;

  return {
    playerId: player.player_id,
    name: player.display_name,
    position,
    team: player.team,
    bye: deterministicBye(player.team),
    depth: Number.isFinite(player.depth_chart_order) ? player.depth_chart_order : 9,
    yearsExp: Number.isFinite(player.years_exp) ? player.years_exp : 1,
    injuryStatus: player.injury_status,
  };
}

function compareDraftPriority(a, b) {
  const aOverride = STAR_RANK_OVERRIDES.get(`${a.name}|${a.position}`);
  const bOverride = STAR_RANK_OVERRIDES.get(`${b.name}|${b.position}`);
  if (aOverride && bOverride) return aOverride - bOverride;
  if (aOverride) return -1;
  if (bOverride) return 1;

  const positionWeight = { RB: 0, WR: 0.15, QB: 1.8, TE: 2.2, K: 9 };
  const aScore = a.depth * 8 + (positionWeight[a.position] ?? 4) + ageCurvePenalty(a);
  const bScore = b.depth * 8 + (positionWeight[b.position] ?? 4) + ageCurvePenalty(b);
  return aScore - bScore || a.name.localeCompare(b.name);
}

function ageCurvePenalty(player) {
  if (player.position === "RB") return Math.max(0, player.yearsExp - 6) * 2;
  if (player.position === "WR") return Math.max(0, player.yearsExp - 8);
  if (player.position === "TE") return Math.max(0, player.yearsExp - 9);
  return Math.max(0, player.yearsExp - 12);
}

function buildMockPlayer(player, rank) {
  const overrideRank = STAR_RANK_OVERRIDES.get(`${player.name}|${player.position}`);
  const sourceRank = overrideRank ?? estimateSourceRank(player.position, player.positionRank ?? rank);
  const stats = projectionFor(player.position, player.positionRank ?? rank, player.depth);

  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    team: player.team,
    bye: player.bye,
    sourceRank,
    adp: sourceRank,
    stats,
    risk: riskFor(player),
    ceiling: Math.max(4, 16 - sourceRank / 10 + deterministicJitter(player.playerId, -1, 1)),
    source: "canonical_with_mock_projection",
  };
}

function estimateSourceRank(position, positionRank) {
  const rank = Math.max(1, positionRank);
  const formulas = {
    RB: () => 6 + rank * 2.6,
    WR: () => 7 + rank * 2.4,
    QB: () => 18 + rank * 6.5,
    TE: () => 24 + rank * 5.5,
  };
  return Number((formulas[position]?.() ?? 180 + rank).toFixed(1));
}

function buildDefense(team, rank) {
  return {
    playerId: `dst_${team.toLowerCase()}`,
    name: `${team} DST`,
    position: "DST",
    team,
    bye: deterministicBye(team),
    sourceRank: 140 + deterministicJitter(team, 0, 30),
    adp: 140 + deterministicJitter(team, 0, 30),
    stats: {
      dstSack: 35 + deterministicJitter(team, 0, 18),
      dstTakeaway: 16 + deterministicJitter(`${team}_to`, 0, 10),
      dstTd: 1 + deterministicJitter(`${team}_td`, 0, 3),
    },
    risk: 3,
    ceiling: 5,
    source: "synthetic_dst",
  };
}

function buildKicker(team, rank) {
  return {
    playerId: `k_${team.toLowerCase()}`,
    name: `${team} K`,
    position: "K",
    team,
    bye: deterministicBye(team),
    sourceRank: 155 + deterministicJitter(`${team}_k`, 0, 36),
    adp: 155 + deterministicJitter(`${team}_k`, 0, 36),
    stats: {
      fieldGoal: 24 + deterministicJitter(team, 0, 10),
      extraPoint: 32 + deterministicJitter(`${team}_xp`, 0, 15),
    },
    risk: 3,
    ceiling: 4,
    source: "synthetic_kicker",
  };
}

function projectionFor(position, rank, depth) {
  const depthPenalty = Math.max(0, depth - 1);
  const rankPenalty = Math.max(0, rank - 1);

  if (position === "QB") {
    return {
      passingYards: Math.max(2500, 4500 - rankPenalty * 22 - depthPenalty * 180),
      passingTd: Math.max(15, 34 - rankPenalty * 0.15 - depthPenalty * 1.5),
      interception: 9 + depthPenalty,
      rushingYards: Math.max(80, 650 - rankPenalty * 7),
      rushingTd: Math.max(1, 7 - depthPenalty),
    };
  }

  if (position === "RB") {
    return {
      rushingYards: Math.max(240, 1240 - rankPenalty * 12 - depthPenalty * 115),
      rushingTd: Math.max(2, 11 - rankPenalty * 0.08 - depthPenalty),
      reception: Math.max(12, 64 - rankPenalty * 0.45 - depthPenalty * 8),
      receivingYards: Math.max(80, 500 - rankPenalty * 4 - depthPenalty * 55),
      receivingTd: Math.max(0, 4 - depthPenalty * 0.6),
    };
  }

  if (position === "WR") {
    return {
      reception: Math.max(24, 112 - rankPenalty * 0.55 - depthPenalty * 10),
      receivingYards: Math.max(300, 1450 - rankPenalty * 7 - depthPenalty * 120),
      receivingTd: Math.max(2, 10 - rankPenalty * 0.05 - depthPenalty),
      rushingYards: Math.max(0, 55 - rankPenalty),
    };
  }

  if (position === "TE") {
    return {
      reception: Math.max(22, 90 - rankPenalty * 0.36 - depthPenalty * 9),
      receivingYards: Math.max(240, 900 - rankPenalty * 5 - depthPenalty * 80),
      receivingTd: Math.max(2, 8 - rankPenalty * 0.04 - depthPenalty * 0.7),
    };
  }

  return {
    fieldGoal: Math.max(18, 34 - rankPenalty * 0.08),
    extraPoint: Math.max(25, 45 - rankPenalty * 0.04),
  };
}

function riskFor(player) {
  const injuryRisk = player.injuryStatus ? 2 : 0;
  const depthRisk = player.depth > 2 ? 1.5 : 0;
  const positionRisk = player.position === "RB" ? 3 : player.position === "QB" ? 1.5 : 2.5;
  return Math.min(8, positionRisk + injuryRisk + depthRisk);
}

function deterministicBye(team) {
  if (!team) return 10;
  return 5 + (hashCode(team) % 10);
}

function deterministicJitter(seed, min, max) {
  const normalized = hashCode(seed) / 2147483647;
  return min + normalized * (max - min);
}

function hashCode(value) {
  const stringValue = String(value ?? "");
  let hash = 0;
  for (let index = 0; index < stringValue.length; index += 1) {
    hash = (hash * 31 + stringValue.charCodeAt(index)) & 0x7fffffff;
  }
  return hash || 1;
}
