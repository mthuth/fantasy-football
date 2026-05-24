import assert from "node:assert/strict";
import { createApprovalCard, recordApprovalDecision, buildApprovalAuditEntry } from "../src/approvals/approvalWorkflow.mjs";
import { evaluateActionGuardrails } from "../src/guardrails/actionGuardrails.mjs";

const blockedDraft = evaluateActionGuardrails(
  { type: "draft_pick", summary: "Draft top recommendation." },
  { capabilities: { draft_pick: "disabled" }, league: { paidEntry: true } }
);

assert.equal(blockedDraft.allowed, false);
assert.equal(blockedDraft.approvalRequired, true);
assert.ok(blockedDraft.blocks.some((block) => block.includes("disabled")));
assert.ok(blockedDraft.blocks.some((block) => block.includes("approval")));
assert.ok(blockedDraft.blocks.some((block) => block.includes("Paid-league")));

const card = createApprovalCard(
  { type: "trade_proposal", summary: "Offer RB depth for WR upgrade." },
  {
    channel: "slack",
    capabilities: { trade_proposal: "enabled" },
    approval: { approved: true },
    now: "2026-05-24T12:00:00.000Z",
  }
);
const decision = recordApprovalDecision(card, "approved", "Matt", "2026-05-24T12:01:00.000Z");
const audit = buildApprovalAuditEntry(card, decision);

assert.equal(card.status, "ready_for_approval");
assert.equal(card.channel, "slack");
assert.equal(decision.executable, true);
assert.equal(audit.status, "approved");
assert.equal(audit.actionType, "trade_proposal");

console.log(JSON.stringify({
  status: "passed",
  tested: [
    "write action guardrails",
    "paid-league confirmation block",
    "approval card formatting",
    "approval audit record",
  ],
}, null, 2));
