const STRATEGY_PROFILES = new Set(["balanced", "hero_rb", "zero_rb", "robust_rb", "elite_qb", "best_player_available"]);
const RISK_PROFILES = new Set(["safe_floor", "balanced", "upside_heavy"]);

export const DEFAULT_STRATEGY_PREFERENCES = Object.freeze({
  strategyProfile: "balanced",
  riskProfile: "balanced",
  preferStacking: false,
  avoidTeams: [],
  avoidPlayers: [],
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
  };
}

export function scoreStrategyPreference({ preferences, roster, player, currentPick }) {
  const normalized = normalizeStrategyPreferences(preferences);
  const rosterCounts = countPositions(roster);
  const rosterSize = roster.length;
  let adjustment = 0;
  const reasons = [];

  adjustment += scoreProfile(normalized.strategyProfile, player, rosterCounts, rosterSize, currentPick, reasons);
  adjustment += scoreRisk(normalized.riskProfile, player, reasons);
  adjustment += scoreStacking(normalized, roster, player, reasons);
  adjustment += scoreAvoidList(normalized, player, reasons);

  return {
    adjustment: round(adjustment, 1),
    profile: normalized.strategyProfile,
    riskProfile: normalized.riskProfile,
    reasons,
  };
}

function scoreProfile(profile, player, rosterCounts, rosterSize, currentPick, reasons) {
  if (profile === "hero_rb") {
    if (player.position === "RB" && (rosterCounts.RB ?? 0) < 1 && currentPick <= 36) {
      reasons.push("hero RB profile wants one early anchor back");
      return 4;
    }
    if (player.position === "RB" && (rosterCounts.RB ?? 0) >= 1 && rosterSize < 5) return -2;
  }

  if (profile === "zero_rb") {
    if (player.position === "RB" && rosterSize < 5) {
      reasons.push("zero RB profile fades early running backs");
      return -5;
    }
    if ((player.position === "WR" || player.position === "TE") && rosterSize < 5) return 3;
  }

  if (profile === "robust_rb") {
    if (player.position === "RB" && (rosterCounts.RB ?? 0) < 3 && rosterSize < 7) {
      reasons.push("robust RB profile builds early running back depth");
      return 4;
    }
  }

  if (profile === "elite_qb") {
    if (player.position === "QB" && (rosterCounts.QB ?? 0) === 0 && player.sourceRank <= 45) {
      reasons.push("elite QB profile prioritizes a top quarterback tier");
      return 5;
    }
    if (player.position === "QB" && (rosterCounts.QB ?? 0) === 0 && player.sourceRank > 85) return -3;
  }

  if (profile === "best_player_available") {
    const marketEdge = Math.max(-2, Math.min(4, (player.adp - currentPick) / 8));
    if (marketEdge > 1) reasons.push("best-player-available profile rewards market value");
    return marketEdge;
  }

  return 0;
}

function scoreRisk(riskProfile, player, reasons) {
  if (riskProfile === "safe_floor") {
    const adjustment = -Math.max(0, player.risk - 2) * 1.2;
    if (adjustment < -1) reasons.push("safe-floor profile discounts elevated risk");
    return adjustment;
  }

  if (riskProfile === "upside_heavy") {
    const adjustment = Math.max(0, player.ceiling - 7) * 0.5;
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
  return 2.5;
}

function scoreAvoidList(preferences, player, reasons) {
  if (preferences.avoidPlayers.includes(normalizeName(player.name))) {
    reasons.push("player is on the avoid list");
    return -100;
  }
  if (preferences.avoidTeams.includes(String(player.team ?? "").toUpperCase())) {
    reasons.push("team is on the avoid list");
    return -20;
  }
  return 0;
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
