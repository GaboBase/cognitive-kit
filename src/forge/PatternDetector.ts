export interface ToolUsageRecord {
  toolId: string;
  timestamp: number;
  success: boolean;
  params: Record<string, unknown>;
}

export interface Pattern {
  id: string;
  toolSequence: string[];
  frequency: number;
  avgConfidence: number;
  firstSeen: number;
  lastSeen: number;
  source: string;
}

export class PatternDetector {
  private usageHistory: ToolUsageRecord[] = [];
  private maxHistory = 500;
  private minPatternLength = 2;
  private maxPatternLength = 5;
  private minPatternFrequency = 2;

  recordUsage(toolId: string, success: boolean, params: Record<string, unknown>): void {
    this.usageHistory.push({ toolId, timestamp: Date.now(), success, params });
    if (this.usageHistory.length > this.maxHistory) {
      this.usageHistory = this.usageHistory.slice(-this.maxHistory);
    }
  }

  detectPatterns(threshold?: number): Pattern[] {
    const minFreq = threshold ?? this.minPatternFrequency;

    const patterns: Pattern[] = [];
    const seen = new Set<string>();

    for (let len = this.minPatternLength; len <= this.maxPatternLength; len++) {
      for (let i = 0; i <= this.usageHistory.length - len; i++) {
        const sequence = this.usageHistory.slice(i, i + len).map(r => r.toolId);
        const key = sequence.join('::');

        if (seen.has(key)) continue;

        let count = 0;
        let firstSeen = Infinity;
        let lastSeen = 0;

        for (let j = 0; j <= this.usageHistory.length - len; j++) {
          const match = this.usageHistory.slice(j, j + len).every(
            (r, k) => r.toolId === sequence[k],
          );
          if (match) {
            count++;
            const ts = this.usageHistory[j].timestamp;
            firstSeen = Math.min(firstSeen, ts);
            lastSeen = Math.max(lastSeen, ts);
          }
        }

        if (count >= minFreq) {
          seen.add(key);
          const successCount = count; // reusing
          patterns.push({
            id: `pattern-${Date.now()}-${patterns.length}`,
            toolSequence: sequence,
            frequency: count,
            avgConfidence: parseFloat((count / Math.max(1, this.usageHistory.length / len)).toFixed(3)),
            firstSeen,
            lastSeen,
            source: 'detected',
          });
        }
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  getTopTools(limit = 5): Array<{ toolId: string; count: number }> {
    const freq = new Map<string, number>();
    for (const r of this.usageHistory) {
      freq.set(r.toolId, (freq.get(r.toolId) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([toolId, count]) => ({ toolId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getStats(): { totalCalls: number; uniqueTools: number; topTools: Array<{ toolId: string; count: number }>; patternsFound: number } {
    const unique = new Set(this.usageHistory.map(r => r.toolId));
    return {
      totalCalls: this.usageHistory.length,
      uniqueTools: unique.size,
      topTools: this.getTopTools(),
      patternsFound: this.detectPatterns().length,
    };
  }

  clear(): void {
    this.usageHistory = [];
  }
}
