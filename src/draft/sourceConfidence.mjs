const SOURCE_PROFILES = {
  static_fixture: {
    confidence: 0.72,
    label: "Static mock fixture",
    warning: "Fixture projection only; use for workflow testing, not draft-day decisions.",
  },
  canonical_with_mock_projection: {
    confidence: 0.66,
    label: "Canonical player table plus mock projection",
    warning: "Projection is deterministic mock data until a real projection source is imported.",
  },
  synthetic_dst: {
    confidence: 0.52,
    label: "Synthetic defense projection",
    warning: "DST projection is synthetic and should be replaced with a current ranking source.",
  },
  synthetic_kicker: {
    confidence: 0.48,
    label: "Synthetic kicker projection",
    warning: "Kicker projection is synthetic and should be replaced with a current ranking source.",
  },
};

export function sourceTraceForPlayer(player) {
  const source = player.source ?? "static_fixture";
  const profile = SOURCE_PROFILES[source] ?? {
    confidence: 0.5,
    label: source,
    warning: "Unrecognized player source; verify before using in production.",
  };

  return {
    source,
    label: profile.label,
    confidence: round(profile.confidence, 2),
    warning: profile.warning,
    generatedAt: player.sourceGeneratedAt ?? null,
  };
}

export function sourceConfidenceForPlayer(player) {
  return sourceTraceForPlayer(player).confidence;
}

export function sourceWarningForRecommendation(player, valueOverReplacement) {
  const trace = sourceTraceForPlayer(player);
  if (trace.confidence >= 0.7) return null;
  if (valueOverReplacement < 0 && player.position !== "K" && player.position !== "DST") return null;
  return trace.warning;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
