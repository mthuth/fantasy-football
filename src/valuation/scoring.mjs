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
  return explainProjection(stats, scoring).total;
}

export function explainProjection(stats = {}, scoring = DEFAULT_SCORING) {
  const components = SCORING_COMPONENTS
    .map((component) => {
      const stat = stats[component.key] ?? 0;
      const rate = scoring[component.key] ?? 0;
      return {
        key: component.key,
        label: component.label,
        stat: round(stat, 2),
        rate: round(rate, 3),
        points: round(stat * rate, 2),
      };
    })
    .filter((component) => component.stat !== 0 || component.points !== 0);

  return {
    total: round(components.reduce((sum, component) => sum + component.points, 0), 2),
    components,
  };
}

export function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const SCORING_COMPONENTS = [
  { key: "passingYards", label: "Pass yards" },
  { key: "passingTd", label: "Pass TD" },
  { key: "interception", label: "Interceptions" },
  { key: "rushingYards", label: "Rush yards" },
  { key: "rushingTd", label: "Rush TD" },
  { key: "receivingYards", label: "Receiving yards" },
  { key: "receivingTd", label: "Receiving TD" },
  { key: "reception", label: "Receptions" },
  { key: "fumbleLost", label: "Fumbles lost" },
  { key: "fieldGoal", label: "Field goals" },
  { key: "extraPoint", label: "Extra points" },
  { key: "dstSack", label: "DST sacks" },
  { key: "dstTakeaway", label: "DST takeaways" },
  { key: "dstTd", label: "DST TD" },
  { key: "dstPointsAllowed", label: "DST points allowed" },
];
