import { evaluateActionGuardrails } from "../guardrails/actionGuardrails.mjs";

export function createApprovalCard(action, context = {}) {
  const guardrails = evaluateActionGuardrails(action, context);
  return {
    approvalId: action.approvalId ?? `approval_${Date.now()}`,
    channel: context.channel ?? "dashboard",
    status: guardrails.allowed ? "ready_for_approval" : "blocked",
    action,
    guardrails,
    title: buildTitle(action),
    summary: action.summary ?? "Review recommended fantasy football action.",
    approveLabel: guardrails.paidLeague ? "Approve With Paid-League Confirmation" : "Approve",
    rejectLabel: "Reject",
    createdAt: context.now ?? new Date().toISOString(),
  };
}

export function recordApprovalDecision(card, decision, reviewer, now = new Date().toISOString()) {
  const normalizedDecision = decision === "approved" ? "approved" : "rejected";
  return {
    approvalId: card.approvalId,
    actionType: card.action.type,
    decision: normalizedDecision,
    reviewer,
    decidedAt: now,
    executable: normalizedDecision === "approved" && card.guardrails.blocks.length === 0,
    guardrailBlocks: card.guardrails.blocks,
  };
}

export function buildApprovalAuditEntry(card, decisionRecord = null) {
  return {
    approvalId: card.approvalId,
    actionType: card.action.type,
    title: card.title,
    createdAt: card.createdAt,
    channel: card.channel,
    status: decisionRecord?.decision ?? card.status,
    guardrailBlocks: card.guardrails.blocks,
    decision: decisionRecord,
  };
}

function buildTitle(action) {
  return {
    draft_pick: "Draft Pick Recommendation",
    waiver_claim: "Waiver Claim Recommendation",
    trade_proposal: "Trade Proposal Recommendation",
    lineup_change: "Lineup Change Recommendation",
  }[action.type] ?? "Fantasy Football Recommendation";
}
