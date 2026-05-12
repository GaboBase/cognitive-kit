import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const DEFAULT_STAKEHOLDERS = ['Architect', 'Guardian', 'Executor', 'Strategist', 'Operator'];
const CONSENSUS_MODELS = ['unanimous', 'majority', 'supermajority', 'weighted', 'lazy'];

export const consensusEngineTool: ToolDefinition = {
  id: 'consensus_engine',
  name: 'Consensus Engine',
  description: 'Multi-stakeholder consensus building engine. Simulates deliberation across diverse perspectives (Architect, Guardian, Executor, Strategist, Operator). Supports unanimous, majority, supermajority, weighted, and lazy consensus models.',
  inputSchema: {
    proposal: { type: 'string', description: 'The proposal or decision requiring consensus' },
    stakeholders: { type: 'string', description: 'Comma-separated stakeholder roles (default: Architect,Guardian,Executor,Strategist,Operator)' },
    model: { type: 'string', enum: ['unanimous', 'majority', 'supermajority', 'weighted', 'lazy'], description: 'Consensus model' },
    context: { type: 'string', description: 'Background context for the decision' },
    options: { type: 'string', description: 'JSON array of alternative options' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const proposal = String(params.proposal || '');
    const stakeholders = String(params.stakeholders || DEFAULT_STAKEHOLDERS.join(','));
    const model = String(params.model || 'weighted');
    const context = String(params.context || '');
    const optionsRaw = String(params.options || '[]');

    if (!proposal) {
      return { success: false, data: null, error: 'Proposal is required for consensus building' };
    }

    const stakeholderList = stakeholders.split(',').map(s => s.trim());
    let options: string[] = [proposal];
    try {
      const parsed = JSON.parse(optionsRaw);
      if (Array.isArray(parsed) && parsed.length > 0) options = parsed;
    } catch {}

    const deliberations = stakeholderList.map(role => {
      const perspective = getPerspective(role);
      const { vote, confidence, concerns, conditions } = generateVote(role, proposal, context, model);
      return {
        stakeholder: role,
        perspective,
        vote,
        confidence,
        concerns: concerns.slice(0, 3),
        conditions: conditions.slice(0, 2),
        rationale: `${role} perspective: ${vote === 'approve' ? 'Supports' : vote === 'abstain' ? 'Neutral on' : 'Opposes'} proposal. ${concerns[0] ?? 'No major concerns.'}`,
      };
    });

    const votes = deliberations.map(d => d.vote);
    const approveCount = votes.filter(v => v === 'approve').length;
    const rejectCount = votes.filter(v => v === 'reject').length;
    const abstainCount = votes.filter(v => v === 'abstain').length;
    const total = stakeholderList.length;

    const weights: Record<string, number> = {
      Architect: 1.0, Guardian: 0.9, Executor: 0.8, Strategist: 0.85, Operator: 0.75,
    };
    const weightedApprove = deliberations
      .filter(d => d.vote === 'approve')
      .reduce((sum, d) => sum + (weights[d.stakeholder] ?? 0.5), 0);
    const weightedTotal = stakeholderList.reduce((sum, r) => sum + (weights[r] ?? 0.5), 0);

    let consensus: { reached: boolean; model: string; result: string; threshold: string };
    switch (model) {
      case 'unanimous':
        consensus = {
          reached: rejectCount === 0,
          model: 'unanimous',
          result: rejectCount === 0 ? 'CONSENSUS_REACHED' : 'UNANIMOUS_FAILED',
          threshold: '100% approval',
        };
        break;
      case 'majority':
        consensus = {
          reached: approveCount > total / 2,
          model: 'majority',
          result: approveCount > total / 2 ? 'CONSENSUS_REACHED' : 'MAJORITY_FAILED',
          threshold: '>50% approval',
        };
        break;
      case 'supermajority':
        consensus = {
          reached: approveCount >= Math.ceil(total * 0.66),
          model: 'supermajority',
          result: approveCount >= Math.ceil(total * 0.66) ? 'CONSENSUS_REACHED' : 'SUPERMAJORITY_FAILED',
          threshold: '≥66% approval',
        };
        break;
      case 'weighted':
        consensus = {
          reached: weightedApprove / weightedTotal > 0.5,
          model: 'weighted',
          result: weightedApprove / weightedTotal > 0.5 ? 'CONSENSUS_REACHED' : 'WEIGHTED_FAILED',
          threshold: 'weighted >50% approval',
        };
        break;
      default:
        consensus = { reached: true, model: 'lazy', result: 'LAZY_APPROVED', threshold: 'no threshold' };
    }

    const allConditions = deliberations.flatMap(d => d.conditions);
    const conditionsReached = allConditions.length === 0 || Math.random() > 0.3;

    await ctx.memory.store('analysis', `consensus-${Date.now()}`, {
      proposal: proposal.slice(0, 200),
      model,
      reached: consensus.reached,
      approveCount,
      rejectCount,
    });

    return {
      success: true,
      data: {
        proposal,
        model: consensus.model,
        consensusReached: consensus.reached,
        status: consensus.result,
        threshold: consensus.threshold,
        voteDistribution: { approve: approveCount, reject: rejectCount, abstain: abstainCount, total },
        weightedSupport: parseFloat((weightedApprove / weightedTotal).toFixed(3)),
        deliberations,
        conditions: { total: allConditions.length, met: conditionsReached },
        confidenceScore: parseFloat((deliberations.reduce((s, d) => s + d.confidence, 0) / total).toFixed(3)),
        summary: consensus.reached
          ? `Consensus reached via ${model} model (${approveCount}/${total} approve)`
          : `Consensus blocked via ${model} model (${rejectCount}/${total} reject). Concerns: ${deliberations.filter(d => d.vote === 'reject').map(d => d.concerns[0]).join('; ')}`,
      },
      metadata: {
        stakeholderCount: total,
        model,
        reached: consensus.reached,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function getPerspective(role: string): string {
  const perspectives: Record<string, string> = {
    Architect: 'Structural integrity and systemic coherence',
    Guardian: 'Ethical alignment and safety compliance',
    Executor: 'Operational feasibility and resource optimization',
    Strategist: 'Long-term strategic positioning and adaptability',
    Operator: 'Day-to-day operability and user impact',
  };
  return perspectives[role] ?? 'General stakeholder perspective';
}

function generateVote(role: string, _proposal: string, _context: string, model: string): {
  vote: string; confidence: number; concerns: string[]; conditions: string[];
} {
  const baseApproveProb = role === 'Architect' ? 0.7 : role === 'Guardian' ? 0.5 : role === 'Executor' ? 0.75 : role === 'Strategist' ? 0.65 : 0.7;
  const adjustedProb = model === 'unanimous' ? baseApproveProb * 1.2 : baseApproveProb;
  const rand = Math.random();

  const concernPools: Record<string, string[]> = {
    Architect: ['Structural coupling risk', 'Scalability constraints', 'Integration complexity'],
    Guardian: ['Ethical boundary ambiguity', 'Safety verification gaps', 'Accountability gaps'],
    Executor: ['Resource allocation insufficient', 'Timeline too aggressive', 'Implementation unclear'],
    Strategist: ['Market positioning unclear', 'Long-term viability uncertain', 'Competitive response risk'],
    Operator: ['User experience impact', 'Operational overhead', 'Training requirements'],
  };

  const conditionPools: Record<string, string[]> = {
    Architect: ['Requires architecture review', 'Needs modular decomposition'],
    Guardian: ['Requires ethics review', 'Needs safety certification'],
    Executor: ['Requires resource reallocation', 'Needs phased rollout'],
    Strategist: ['Requires market analysis', 'Needs contingency planning'],
    Operator: ['Requires user testing', 'Needs documentation'],
  };

  const concernsPool = concernPools[role] ?? ['General concern'];
  const condPool = conditionPools[role] ?? ['General condition'];
  const concernCount = 1 + Math.floor(Math.random() * 2);
  const conditionCount = Math.random() > 0.5 ? 1 : 0;

  let vote: string;
  if (rand < adjustedProb) {
    vote = 'approve';
  } else if (rand < adjustedProb + (1 - adjustedProb) * 0.3) {
    vote = 'abstain';
  } else {
    vote = 'reject';
  }

  return {
    vote,
    confidence: vote === 'approve' ? 0.6 + Math.random() * 0.3 : 0.4 + Math.random() * 0.3,
    concerns: concernsPool.sort(() => Math.random() - 0.5).slice(0, concernCount),
    conditions: condPool.sort(() => Math.random() - 0.5).slice(0, conditionCount),
  };
}
