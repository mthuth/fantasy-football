const WRITE_ACTIONS = new Set([
  "draft_pick",
  "waiver_claim",
  "free_agent_add",
  "drop_player",
  "trade_proposal",
  "trade_accept",
  "lineup_change",
  "payment",
]);

export function evaluateActionGuardrails(action, context = {}) {
  const actionType = action.type;
  const isWrite = WRITE_ACTIONS.has(actionType);
  const approvalRequired = isWrite || action.requiresApproval === true;
  const capability = context.capabilities?.[actionType] ?? "disabled";
  const paidLeague = Boolean(context.league?.paidEntry || context.league?.entryFee);
  const blocks = [];

  if (actionType === "payment") blocks.push("Payments and league entry fees must stay outside agent execution.");
  if (isWrite && capability !== "enabled") blocks.push(`${actionType} capability is disabled.`);
  if (isWrite && !context.approval?.approved) blocks.push(`${actionType} requires explicit user approval.`);
  if (paidLeague && isWrite && !context.approval?.paidLeagueConfirmed) {
    blocks.push("Paid-league action requires separate paid-league confirmation.");
  }

  return {
    actionType,
    allowed: blocks.length === 0,
    mode: blocks.length === 0 ? "approved_execution" : "recommendation_only",
    approvalRequired,
    paidLeague,
    blocks,
  };
}

export function assertActionAllowed(action, context = {}) {
  const evaluation = evaluateActionGuardrails(action, context);
  if (!evaluation.allowed) {
    throw new Error(`Action blocked: ${evaluation.blocks.join(" ")}`);
  }
  return evaluation;
}
