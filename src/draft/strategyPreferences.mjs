const STRATEGY_PROFILES = new Set(["balanced", "hero_rb", "zero_rb", "robust_rb", "elite_qb", "best_player_available"]);
const RISK_PROFILES = new Set(["safe_floor", "balanced", "upside_heavy"]);

export const DEFAULT_STRATEGY_WEIGHTS = Object.freeze({
  version: "simulation_tuned_2026_05_24",
  heroRbEarlyAnchorBonus: 7,
  heroRbAnchorBonus: 5,
  heroRbSecondEarlyPenalty: -3,
  zeroRbEarlyRbPenalty: -8,
  zeroRbEarlyPassCatcherBonus: 4,
  zeroRbRecoveryRbBonus: 5,
  robustRbEarlyRbBonus: 8,
  robustRbEarlyPassCatcherPenalty: -3,
  eliteQbTopTierBonus: 5,
  eliteQbLatePenalty: -3,
  bestPlayerAvailableMinMarketEdge: -2,
  bestPlayerAvailableMaxMarketEdge: 5,
  bestPlayerAvailableAdpDivisor: 8,
  safeFloorRiskMultiplier: 1.2,
  upsideCeilingMultiplier: 0.5,
  stackingBonus: 2.5,
  avoidPlayerPenalty: -100,
  avoidTeamPenalty: -20,
});

export const DEFAULT_STRATEGY_PREFERENCES = Object.freeze({
  strategyProfile: "balanced",
  riskProfile: "balanced",
  preferStacking: false,
  avoidTeams: [],
  avoidPlayers: [],
  strategyWeights: DEFAULT_STRATEGY_WEIGHTS,
});

export function normalizeStrategyPreferences(preferences = {}) {
  const strategyProfile = STRATEGY_PROFILES.has(preferences.strategyProfile)
    ? preferences.strategyProfile
    : DEFAULT_STRATEGY_PREFERENCES.strategyProfile;
  const riskProfile = RISK_PROFILES.has(preferences.riskProfile)
    ? preferences.riskProfile
    : DEFAULT_STRATEGY_PREFERENCES.riskProfile;

  return {
    strategyProfile,
    riskProfile,
    preferStacking: Boolean(preferences.preferStacking),
    avoidTeams: normalizeStringList(preferences.avoidTeams).map((team) => team.toUpperCase()),
    avoidPlayers: normalizeStringList(preferences.avoidPlayers).map(normalizeName),
    strategyWeights: normalizeStrategyWeights(preferences.strategyWeights),
  };
}

export function scoreStrategyPreference({ preferences, roster, player, currentPick }) {
  const normalized = normalizeStrategyPreferences(preferences);
  const rosterCounts = countPositions(roster);
  const rosterSize = roster.length;
  let adjustment = 0;
  const reasons = [];

  adjustment += scoreProfile(normalized.strategyProfile, normalized.strategyWeights, player, rosterCounts, rosterSize, currentPick, reasons);
  adjustment += scoreRisk(normalized.riskProfile, normalized.strategyWeights, player, reasons);
  adjustment += scoreStacking(normalized, roster, player, reasons);
  adjustment += scoreAvoidList(normalized, player, reasons);

  return {
    adjustment: round(adjustment, 1),
    profile: normalized.strategyProfile,
    riskProfile: normalized.riskProfile,
    reasons,
  };
}

function scoreProfile(profile, weights, player, rosterCounts, rosterSize, currentPick, reasons) {
  if (profile === "hero_rb") {
    if (player.position === "RB" && (rosterCounts.RB ?? 0) < 1 && currentPick <= 36) {
      reasons.push("hero RB profile wants one early anchor back");
      return rosterSize < 3 ? weights.heroRbEarlyAnchorBonus : weights.heroRbAnchorBonus;
    }
    if (player.position === "RB" && (rosterCounts.RB ?? 0) >= 1 && rosterSize < 5) return weights.heroRbSecondEarlyPenalty;
  }

  if (profile === "zero_rb") {
    if (player.position === "RB" && rosterSize < 5) {
      reasons.push("zero RB profile fades early running backs");
      return weights.zeroRbEarlyRbPenalty;
    }
    if ((player.position === "WR" || player.position === "TE") && rosterSize < 5) return weights.zeroRbEarlyPassCatcherBonus;
    if (player.position === "RB" && rosterSize >= 5 && (rosterCounts.RB ?? 0) < 2) return weights.zeroRbRecoveryRbBonus;
  }

  if (profile === "robust_rb") {
    if (player.position === "RB" && (rosterCounts.RB ?? 0) < 3 && rosterSize < 7) {
      reasons.push("robust RB profile builds early running back depth");
      return weights.robustRbEarlyRbBonus;
    }
    if ((player.position === "WR" || player.position === "TE") && (rosterCounts.RB ?? 0) < 2 && rosterSize < 5) {
      return weights.robustRbEarlyPassCatcherPenalty;
    }
  }

  if (profile === "elite_qb") {
    if (player.position === "QB" && (rosterCounts.QB ?? 0) === 0 && player.sourceRank <= 45) {
      reasons.push("elite QB profile prioritizes a top quarterback tier");
      return weights.eliteQbTopTierBonus;
    }
    if (player.position === "QB" && (rosterCounts.QB ?? 0) === 0 && player.sourceRank > 85) return weights.eliteQbLatePenalty;
  }

  if (profile === "best_player_available") {
    const marketEdge = Math.max(
      weights.bestPlayerAvailableMinMarketEdge,
      Math.min(weights.bestPlayerAvailableMaxMarketEdge, (currentPick - player.adp) / weights.bestPlayerAvailableAdpDivisor)
    );
    if (marketEdge > 1) reasons.push("best-player-available profile rewards market value");
    return marketEdge;
  }

  return 0;
}

function scoreRisk(riskProfile, weights, player, reasons) {
  if (riskProfile === "safe_floor") {
    const adjustment = -Math.max(0, player.risk - 2) * weights.safeFloorRiskMultiplier;
    if (adjustment < -1) reasons.push("safe-floor profile discounts elevated risk");
    return adjustment;
  }

  if (riskProfile === "upside_heavy") {
    const adjustment = Math.max(0, player.ceiling - 7) * weights.upsideCeilingMultiplier;
    if (adjustment > 1) reasons.push("upside-heavy profile rewards ceiling");
    return adjustment;
  }

  return 0;
}

function scoreStacking(preferences, roster, player, reasons) {
  if (!preferences.preferStacking || !["QB", "WR", "TE"].includes(player.position)) return 0;

  const hasStackPartner = roster.some((rostered) =>
    rostered.team === player.team &&
    ((player.position === "QB" && ["WR", "TE"].includes(rostered.position)) ||
      (["WR", "TE"].includes(player.position) && rostered.position === "QB"))
  );

  if (!hasStackPartner) return 0;
  reasons.push("stacking preference rewards same-team QB/pass-catcher pairings");
  return preferences.strategyWeights.stackingBonus;
}

function scoreAvoidList(preferences, player, reasons) {
  if (preferences.avoidPlayers.includes(normalizeName(player.name))) {
    reasons.push("player is on the avoid list");
    return preferences.strategyWeights.avoidPlayerPenalty;
  }
  if (preferences.avoidTeams.includes(String(player.team ?? "").toUpperCase())) {
    reasons.push("team is on the avoid list");
    return preferences.strategyWeights.avoidTeamPenalty;
  }
  return 0;
}

function normalizeStrategyWeights(weights = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_STRATEGY_WEIGHTS).map(([key, fallback]) => {
    if (key === "version") return [key, typeof weights[key] === "string" && weights[key].trim() ? weights[key] : fallback];
    return [key, Number.isFinite(weights[key]) ? weights[key] : fallback];
  }));
}

function countPositions(roster) {
  return roster.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizeStringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
