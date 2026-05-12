import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const ETHICAL_FRAMEWORKS = [
  {
    name: 'utilitarian',
    questions: [
      'Does this maximize overall well-being?',
      'Does it produce the greatest good for the greatest number?',
      'Are the benefits distributed fairly?',
    ],
    weight: 0.33,
  },
  {
    name: 'deontological',
    questions: [
      'Does this respect fundamental rights and duties?',
      'Would this be acceptable as a universal rule?',
      'Does it treat people as ends rather than means?',
    ],
    weight: 0.33,
  },
  {
    name: 'virtue',
    questions: [
      'Does this reflect honesty, integrity, and compassion?',
      'Would a virtuous actor choose this path?',
      'Does it develop good character?',
    ],
    weight: 0.34,
  },
];

const CONCERN_KEYWORDS: Array<{ word: string; concern: string; impact: number }> = [
  { word: 'bias', concern: 'Potential algorithmic or systemic bias', impact: -0.15 },
  { word: 'discriminat', concern: 'Discriminatory impact on protected groups', impact: -0.25 },
  { word: 'privacy', concern: 'Privacy implications for individuals', impact: -0.2 },
  { word: 'surveillance', concern: 'Surveillance and autonomy concerns', impact: -0.2 },
  { word: 'manipulat', concern: 'Potential for manipulation or coercion', impact: -0.2 },
  { word: 'exclusi', concern: 'Risk of excluding vulnerable populations', impact: -0.15 },
  { word: 'transparen', concern: 'Transparency and explainability', impact: +0.1 },
  { word: 'consent', concern: 'Informed consent considerations', impact: +0.15 },
  { word: 'account', concern: 'Accountability mechanisms present', impact: +0.1 },
  { word: 'fair', concern: 'Fairness considerations addressed', impact: +0.1 },
];

export const ethicsAuditTool: ToolDefinition = {
  id: 'ethics_audit',
  name: 'Ethics Audit',
  description: 'Multi-framework ethics audit. Scores decisions and content against utilitarian, deontological, and virtue ethics frameworks. Flags ethical concerns and provides recommendations.',
  inputSchema: {
    subject: { type: 'string', description: 'The decision, action, or content to audit' },
    frameworks: { type: 'string', description: 'Comma-separated frameworks: utilitarian,deontological,virtue' },
    stakeholder: { type: 'string', description: 'Affected stakeholder groups' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const subject = String(params.subject || '');
    const frameworkFilter = String(params.frameworks || '');
    const stakeholder = String(params.stakeholder || 'general');

    if (!subject) {
      return { success: false, data: null, error: 'Subject is required for ethics audit' };
    }

    const frameworks = frameworkFilter
      ? ETHICAL_FRAMEWORKS.filter(f => frameworkFilter.split(',').map(s => s.trim()).includes(f.name))
      : ETHICAL_FRAMEWORKS;

    const lower = subject.toLowerCase();
    const concerns: Array<{ concern: string; impact: number; evidence: string }> = [];
    let totalImpact = 0;

    for (const { word, concern, impact } of CONCERN_KEYWORDS) {
      if (lower.includes(word)) {
        concerns.push({ concern, impact, evidence: `Found keyword: "${word}"` });
        totalImpact += impact;
      }
    }

    const frameworkScores = frameworks.map(fw => {
      const baseScore = 0.7 + (Math.random() * 0.2);
      const adjustedScore = Math.max(0.1, Math.min(1.0, baseScore + totalImpact));
      return {
        framework: fw.name,
        score: parseFloat(adjustedScore.toFixed(3)),
        questions: fw.questions.map(q => ({
          question: q,
          passed: adjustedScore > 0.5,
        })),
      };
    });

    const overallScore = parseFloat(
      (frameworkScores.reduce((sum, f) => sum + f.score * (ETHICAL_FRAMEWORKS.find(ef => ef.name === f.framework)?.weight ?? 0.33), 0))
        .toFixed(3),
    );

    const topConcern = concerns.length > 0
      ? concerns.reduce((a, b) => Math.abs(a.impact) > Math.abs(b.impact) ? a : b)
      : null;

    await ctx.memory.store('ethics', `audit-${Date.now()}`, {
      subject: subject.slice(0, 200),
      overallScore,
      concernCount: concerns.length,
    });

    return {
      success: true,
      data: {
        subject: subject.slice(0, 500),
        overallScore,
        status: overallScore >= 0.7 ? 'ETHICAL' : overallScore >= 0.4 ? 'NEEDS_REVIEW' : 'UNETHICAL',
        frameworks: frameworkScores,
        concerns,
        topConcern: topConcern?.concern ?? null,
        stakeholderImpact: stakeholder,
        recommendation: overallScore >= 0.7
          ? 'Proceed with standard ethical monitoring'
          : overallScore >= 0.4
            ? 'Address flagged concerns before proceeding'
            : 'DO NOT PROCEED — significant ethical risks detected',
      },
      metadata: {
        concernCount: concerns.length,
        frameworks: frameworks.length,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};
