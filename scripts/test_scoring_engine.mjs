import assert from "node:assert/strict";
import { DEFAULT_SCORING, explainProjection, scoreProjection } from "../src/valuation/scoring.mjs";

const fullStatLine = {
  passingYards: 250,
  passingTd: 2,
  interception: 1,
  rushingYards: 40,
  rushingTd: 1,
  receivingYards: 25,
  receivingTd: 1,
  reception: 4,
  fumbleLost: 1,
  fieldGoal: 2,
  extraPoint: 3,
  dstSack: 3,
  dstTakeaway: 2,
  dstTd: 1,
  dstPointsAllowed: 14,
};

const explanation = explainProjection(fullStatLine, DEFAULT_SCORING);

assert.equal(scoreProjection(fullStatLine, DEFAULT_SCORING), 56.5);
assert.equal(explanation.total, 56.5);
assert.deepEqual(
  explanation.components.map((component) => component.key),
  Object.keys(fullStatLine),
  "projection explanation should include every supported scoring component with non-zero stats"
);

const halfPpr = explanation.components.find((component) => component.key === "reception");
assert.equal(halfPpr.rate, 0.5);
assert.equal(halfPpr.points, 2);

const interception = explanation.components.find((component) => component.key === "interception");
assert.equal(interception.points, -2);

const customScoring = explainProjection({ reception: 6, passingTd: 3 }, {
  ...DEFAULT_SCORING,
  reception: 1,
  passingTd: 6,
});
assert.equal(customScoring.total, 24);

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "redraft half-PPR scoring components",
    "passing, rushing, receiving, kicker, and DST scoring",
    "negative turnover scoring",
    "custom scoring override explanation",
  ],
}, null, 2));
