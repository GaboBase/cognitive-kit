import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

const STRIDE_CATEGORIES = [
  { id: 'S', name: 'Spoofing', description: 'Impersonating someone or something else', baseRisk: 0.6 },
  { id: 'T', name: 'Tampering', description: 'Modifying data or code', baseRisk: 0.7 },
  { id: 'R', name: 'Repudiation', description: 'Denying having performed an action', baseRisk: 0.4 },
  { id: 'I', name: 'Information Disclosure', description: 'Exposing protected data', baseRisk: 0.8 },
  { id: 'D', name: 'Denial of Service', description: 'Disrupting service availability', baseRisk: 0.5 },
  { id: 'E', name: 'Elevation of Privilege', description: 'Gaining unauthorized access', baseRisk: 0.75 },
];

const THREAT_PATTERNS: Array<{ keyword: string; threat: string; category: string; severity: number }> = [
  { keyword: 'auth', threat: 'Authentication bypass via weak credentials', category: 'S', severity: 0.7 },
  { keyword: 'session', threat: 'Session hijacking or fixation', category: 'S', severity: 0.65 },
  { keyword: 'token', threat: 'Token theft or replay attacks', category: 'S', severity: 0.6 },
  { keyword: 'upload', threat: 'Malicious file upload leading to RCE', category: 'E', severity: 0.85 },
  { keyword: 'api', threat: 'Unrestricted API endpoint abuse', category: 'D', severity: 0.55 },
  { keyword: 'database', threat: 'Database injection and data exfiltration', category: 'T', severity: 0.8 },
  { keyword: 'cache', threat: 'Cache poisoning or data leakage', category: 'R', severity: 0.45 },
  { keyword: 'log', threat: 'Log injection or sensitive data in logs', category: 'R', severity: 0.5 },
  { keyword: 'config', threat: 'Configuration-based privilege escalation', category: 'E', severity: 0.6 },
  { keyword: 'network', threat: 'Network-level eavesdropping or MitM', category: 'I', severity: 0.75 },
];

export const threatMapperTool: ToolDefinition = {
  id: 'threat_mapper',
  name: 'Threat Mapper',
  description: 'STRIDE-based threat modeling and attack surface analysis. Maps system descriptions to threat categories, identifies attack vectors, and recommends mitigations.',
  inputSchema: {
    systemDescription: { type: 'string', description: 'Description of the system, architecture, or component to analyze' },
    focus: { type: 'string', description: 'STRIDE focus areas: S,T,R,I,D,E or all (default)' },
    context: { type: 'string', description: 'Deployment context (cloud, on-prem, hybrid, web, mobile)' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const description = String(params.systemDescription || '');
    const focusInput = String(params.focus || 'STRIDE');
    const context = String(params.context || 'general');

    if (!description) {
      return { success: false, data: null, error: 'System description is required' };
    }

    const focusAreas = focusInput === 'STRIDE' || focusInput === 'all'
      ? STRIDE_CATEGORIES
      : STRIDE_CATEGORIES.filter(s => focusInput.includes(s.id));

    const lowerDesc = description.toLowerCase();
    const matchedThreats = THREAT_PATTERNS
      .filter(t => lowerDesc.includes(t.keyword))
      .map(t => ({
        ...t,
        confidence: 0.5 + (Math.random() * 0.4),
        mitigation: generateMitigation(t),
      }));

    const strideAnalysis = focusAreas.map(stride => {
      const relatedThreats = matchedThreats.filter(t => t.category === stride.id);
      const riskLevel = relatedThreats.length > 0
        ? Math.max(stride.baseRisk, ...relatedThreats.map(t => t.severity))
        : stride.baseRisk * 0.5;
      return {
        category: `${stride.id}: ${stride.name}`,
        description: stride.description,
        threatCount: relatedThreats.length,
        riskScore: parseFloat(riskLevel.toFixed(3)),
        riskLevel: riskLevel >= 0.7 ? 'HIGH' : riskLevel >= 0.4 ? 'MEDIUM' : 'LOW',
        sampleThreats: relatedThreats.slice(0, 3),
      };
    });

    const overallRisk = parseFloat(
      (strideAnalysis.reduce((sum, s) => sum + s.riskScore, 0) / strideAnalysis.length).toFixed(3),
    );

    const criticalCategories = strideAnalysis.filter(s => s.riskLevel === 'HIGH');

    await ctx.memory.store('threat', `map-${Date.now()}`, {
      context,
      threatCount: matchedThreats.length,
      overallRisk,
      criticalCount: criticalCategories.length,
    });

    return {
      success: true,
      data: {
        systemContext: context,
        overallRiskScore: overallRisk,
        overallRiskLevel: overallRisk >= 0.7 ? 'CRITICAL' : overallRisk >= 0.4 ? 'ELEVATED' : 'NORMAL',
        strideAnalysis,
        threatsDetected: matchedThreats.length,
        criticalAreas: criticalCategories.map(c => c.category),
        recommendedActions: criticalCategories.map(c =>
          `Prioritize ${c.category} — implement ${c.category.split(':')[0] === 'I' ? 'encryption and access controls' : 'input validation and monitoring'}`,
        ),
      },
      metadata: {
        matchedThreats: matchedThreats.length,
        categories: focusAreas.length,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function generateMitigation(threat: { category: string; threat: string }): string {
  const mitigations: Record<string, string[]> = {
    S: ['Implement multi-factor authentication', 'Use cryptographic identity verification', 'Deploy session management with rotation'],
    T: ['Apply integrity checks (checksums, signatures)', 'Use parameterized queries', 'Implement audit logging'],
    R: ['Enable comprehensive audit trails', 'Implement digital signatures', 'Use non-repudiation mechanisms'],
    I: ['Encrypt data at rest and in transit', 'Apply least-privilege access', 'Implement data classification'],
    D: ['Deploy rate limiting and throttling', 'Use auto-scaling and redundancy', 'Implement circuit breakers'],
    E: ['Apply principle of least privilege', 'Regular permission audits', 'Implement RBAC with separation of duties'],
  };
  const cat = mitigations[threat.category] || mitigations['I'];
  return cat[Math.floor(Math.random() * cat.length)];
}
