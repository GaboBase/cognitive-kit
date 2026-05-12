import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

interface SecurityPolicy {
  id: string;
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const DEFAULT_POLICIES: SecurityPolicy[] = [
  { id: 'SQLI-01', rule: 'Detect SQL injection patterns', severity: 'critical' },
  { id: 'XSS-01', rule: 'Detect cross-site scripting attempts', severity: 'critical' },
  { id: 'PATH-01', rule: 'Detect path traversal attempts', severity: 'high' },
  { id: 'CMDI-01', rule: 'Detect command injection patterns', severity: 'critical' },
  { id: 'SENS-01', rule: 'Detect sensitive data exposure', severity: 'high' },
  { id: 'AUTH-01', rule: 'Verify authentication tokens', severity: 'high' },
  { id: 'RATE-01', rule: 'Rate limiting check', severity: 'medium' },
];

const INJECTION_PATTERNS = [
  { pattern: new RegExp("'|\u002d\u002d|;|\\/\\*|\\*\\/"), type: 'SQL_INJECTION', severity: 'critical' as const },
  { pattern: /<script|onerror=|onload=|javascript:/i, type: 'XSS', severity: 'critical' as const },
  { pattern: /\.\.\/|\.\.\\|%2e%2e%2f/i, type: 'PATH_TRAVERSAL', severity: 'high' as const },
  { pattern: /rm|del|format|shutdown|cmd|\|[`$]|\$\(|%x/i, type: 'COMMAND_INJECTION', severity: 'critical' as const },
  { pattern: /sk-|ghp_|gho_|xox[bpr]-|AKIA/, type: 'SECRET_LEAK', severity: 'high' as const },
];

export const securityGateTool: ToolDefinition = {
  id: 'security_gate',
  name: 'Security Gateway',
  description: 'Zero-trust security gateway that evaluates requests, payloads, and tokens against security policies. Detects injection, XSS, path traversal, secret leaks, and auth violations.',
  inputSchema: {
    payload: { type: 'string', description: 'The payload or request to evaluate' },
    token: { type: 'string', description: 'Optional authentication token to verify' },
    policies: { type: 'string', description: 'Comma-separated policy IDs to enforce (default: all)' },
    mode: { type: 'string', enum: ['enforce', 'audit', 'learn'], description: 'Enforcement mode' },
    source: { type: 'string', description: 'Source identifier for rate limiting context' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const payload = String(params.payload || '');
    const token = String(params.token || '');
    const mode = String(params.mode || 'enforce');
    const source = String(params.source || 'unknown');
    const policyFilter = String(params.policies || '');

    const activePolicies = policyFilter
      ? DEFAULT_POLICIES.filter(p => policyFilter.split(',').map(s => s.trim()).includes(p.id))
      : DEFAULT_POLICIES;

    const violations: Array<{ policy: string; type: string; severity: string; match: string }> = [];

    for (const { pattern, type, severity } of INJECTION_PATTERNS) {
      const match = payload.match(pattern);
      if (match) {
        violations.push({
          policy: activePolicies.find(p => p.severity === severity.split('_')[0])?.id ?? 'GEN-01',
          type,
          severity,
          match: match[0],
        });
      }
    }

    let authResult: { valid: boolean; reason: string } = { valid: true, reason: 'No token required' };
    if (token) {
      const isValid = token.length >= 8 && /^[a-zA-Z0-9_-]+$/.test(token);
      authResult = {
        valid: isValid,
        reason: isValid ? 'Token format valid' : 'Token format invalid or too short',
      };
    }

    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const blocked = mode === 'enforce' && (criticalCount > 0 || highCount > 2);

    await ctx.memory.store('security', `gate-${Date.now()}`, {
      source,
      violationCount: violations.length,
      blocked,
      mode,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: {
        verdict: blocked ? 'BLOCKED' : mode === 'audit' ? 'AUDITED' : 'PASSED',
        blocked,
        violations,
        violationCount: violations.length,
        auth: authResult,
        policiesApplied: activePolicies.length,
        riskScore: Math.min(1, (criticalCount * 0.4 + highCount * 0.2 + violations.length * 0.1)),
        summary: blocked
          ? `Blocked: ${criticalCount} critical, ${highCount} high severity violations`
          : violations.length === 0
            ? 'No security violations detected'
            : `Audit mode: ${violations.length} violation(s) detected but not blocked`,
      },
      metadata: {
        mode,
        blocked,
        sovereignty: ctx.identity.sovereignty,
        timestamp: Date.now(),
      },
    };
  },
};
