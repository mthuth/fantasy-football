export const DEFAULT_SCORING = {
  passingYards: 0.04,
  passingTd: 4,
  interception: -2,
  rushingYards: 0.1,
  rushingTd: 6,
  receivingYards: 0.1,
  receivingTd: 6,
  reception: 0.5,
  fumbleLost: -2,
  fieldGoal: 3,
  extraPoint: 1,
  dstSack: 1,
  dstTakeaway: 2,
  dstTd: 6,
  dstPointsAllowed: 0,
};

export function scoreProjection(stats = {}, scoring = DEFAULT_SCORING) {
  return (
    (stats.passingYards ?? 0) * scoring.passingYards +
    (stats.passingTd ?? 0) * scoring.passingTd +
    (stats.interception ?? 0) * scoring.interception +
    (stats.rushingYards ?? 0) * scoring.rushingYards +
    (stats.rushingTd ?? 0) * scoring.rushingTd +
    (stats.receivingYards ?? 0) * scoring.receivingYards +
    (stats.receivingTd ?? 0) * scoring.receivingTd +
    (stats.reception ?? 0) * scoring.reception +
    (stats.fumbleLost ?? 0) * scoring.fumbleLost +
    (stats.fieldGoal ?? 0) * scoring.fieldGoal +
    (stats.extraPoint ?? 0) * scoring.extraPoint +
    (stats.dstSack ?? 0) * scoring.dstSack +
    (stats.dstTakeaway ?? 0) * scoring.dstTakeaway +
    (stats.dstTd ?? 0) * scoring.dstTd +
    (stats.dstPointsAllowed ?? 0) * scoring.dstPointsAllowed
  );
}

export function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

