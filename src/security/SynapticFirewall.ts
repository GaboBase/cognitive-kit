interface FirewallRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: 'block' | 'flag' | 'log';
  category: string;
  description: string;
}

const DEFAULT_RULES: FirewallRule[] = [
  { id: 'FW-001', name: 'System Command Injection', pattern: /(?:rm\s+-rf|format\s+|del\s+\/f|shutdown\s+\/s|taskkill)/i, severity: 'block', category: 'command-injection', description: 'Detected destructive system command' },
  { id: 'FW-002', name: 'Filesystem Escape', pattern: /(?:\.\.\/){2,}|%2e%2e[%2f\\]|\.\.\\\.\.\\/, severity: 'block', category: 'path-traversal', description: 'Detected filesystem escape attempt' },
  { id: 'FW-003', name: 'Secret Pattern Detection', pattern: /(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|AKIA[0-9A-Z]{16})/, severity: 'block', category: 'secret-leak', description: 'Detected potential API key or secret' },
  { id: 'FW-004', name: 'Mass Data Exfiltration', pattern: /(?:select\s+\*|drop\s+table|truncate|delete\s+from)/i, severity: 'flag', category: 'data-access', description: 'Detected mass data access pattern' },
  { id: 'FW-005', name: 'Privilege Escalation', pattern: /(?:chmod\s+777|sudo\s+.*-u\s+root|setuid|setgid)/i, severity: 'block', category: 'privilege-escalation', description: 'Detected privilege escalation attempt' },
  { id: 'FW-006', name: 'Network Reconnaissance', pattern: /(?:nmap|nikto|sqlmap|wireshark|ettercap)/i, severity: 'flag', category: 'recon', description: 'Detected reconnaissance tool' },
  { id: 'FW-007', name: 'Encryption Tampering', pattern: /(?:openssl\s+enc|gpg\s+--decrypt|certutil|disable.*tls)/i, severity: 'flag', category: 'crypto', description: 'Detected encryption operation' },
  { id: 'FW-008', name: 'Code Execution', pattern: /(?:eval\s*\(|exec\s*\(|system\s*\(|shell_exec|popen|curl\|bash)/i, severity: 'block', category: 'code-execution', description: 'Detected arbitrary code execution attempt' },
];

export class SynapticFirewall {
  private rules: FirewallRule[] = [...DEFAULT_RULES];
  private blockedCount = 0;
  private flaggedCount = 0;
  private recentHits: Array<{ rule: string; input: string; timestamp: number }> = [];

  addRule(rule: FirewallRule): void {
    this.rules.push(rule);
  }

  inspect(input: string, context?: string): { passed: boolean; blocks: FirewallRule[]; flags: FirewallRule[] } {
    const combined = `${input} ${context ?? ''}`;
    const blocks: FirewallRule[] = [];
    const flags: FirewallRule[] = [];

    for (const rule of this.rules) {
      if (rule.pattern.test(combined)) {
        if (rule.severity === 'block') {
          blocks.push(rule);
          this.blockedCount++;
        } else {
          flags.push(rule);
          this.flaggedCount++;
        }
        this.recentHits.push({ rule: rule.id, input: input.slice(0, 100), timestamp: Date.now() });
        if (this.recentHits.length > 100) this.recentHits.shift();
      }
    }

    return {
      passed: blocks.length === 0,
      blocks,
      flags,
    };
  }

  inspectParams(params: Record<string, unknown>, toolId: string): { passed: boolean; blocks: FirewallRule[]; flags: FirewallRule[] } {
    const allValues = Object.values(params).map(v => String(v ?? '')).join(' ');
    return this.inspect(allValues, toolId);
  }

  getStats(): { blockedCount: number; flaggedCount: number; totalHits: number; rulesActive: number } {
    return {
      blockedCount: this.blockedCount,
      flaggedCount: this.flaggedCount,
      totalHits: this.recentHits.length,
      rulesActive: this.rules.length,
    };
  }

  getRecentHits(count = 10): Array<{ rule: string; input: string; timestamp: number }> {
    return this.recentHits.slice(-count).reverse();
  }

  clearStats(): void {
    this.blockedCount = 0;
    this.flaggedCount = 0;
    this.recentHits = [];
  }
}
