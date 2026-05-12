import type { SkillDefinition } from '../types.js';
import type { SkillRegistry } from '../skills/SkillRegistry.js';
import type { PatternDetector } from './PatternDetector.js';
import type { SkillForger } from './SkillForger.js';

export interface ForgeOptions {
  minPatternFrequency?: number;
  autoForgeThreshold?: number;
  maxForgedSkills?: number;
}

export class ForgeRegistry {
  private skillRegistry: SkillRegistry;
  private detector: PatternDetector;
  private forger: SkillForger;
  private forgedSkills: SkillDefinition[] = [];
  private options: Required<ForgeOptions>;
  private lastAutoForge = 0;

  constructor(
    skillRegistry: SkillRegistry,
    detector: PatternDetector,
    forger: SkillForger,
    options?: ForgeOptions,
  ) {
    this.skillRegistry = skillRegistry;
    this.detector = detector;
    this.forger = forger;
    this.options = {
      minPatternFrequency: options?.minPatternFrequency ?? 2,
      autoForgeThreshold: options?.autoForgeThreshold ?? 3,
      maxForgedSkills: options?.maxForgedSkills ?? 20,
    };
  }

  recordUsage(toolId: string, success: boolean, params: Record<string, unknown>): void {
    this.detector.recordUsage(toolId, success, params);
  }

  forgeFromPatterns(force?: boolean): SkillDefinition[] {
    const patterns = this.detector.detectPatterns(
      force ? 1 : this.options.minPatternFrequency,
    );
    const newSkills: SkillDefinition[] = [];

    for (const pattern of patterns) {
      if (this.forgedSkills.length >= this.options.maxForgedSkills) break;

      const exists = this.forgedSkills.some(s =>
        s.toolsRequired.length === pattern.toolSequence.length &&
        s.toolsRequired.every((t, i) => t === pattern.toolSequence[i]),
      );
      if (exists) continue;

      const skill = this.forger.forge(pattern);
      this.forgedSkills.push(skill);
      this.skillRegistry.add(skill);
      newSkills.push(skill);
    }

    return newSkills;
  }

  autoForge(): SkillDefinition[] {
    const now = Date.now();
    if (now - this.lastAutoForge < 60000) return [];
    this.lastAutoForge = now;

    const stats = this.detector.getStats();
    if (stats.totalCalls >= this.options.autoForgeThreshold) {
      return this.forgeFromPatterns(false);
    }
    return [];
  }

  listForged(): SkillDefinition[] {
    return [...this.forgedSkills];
  }

  clearForged(): void {
    for (const skill of this.forgedSkills) {
    }
    this.forgedSkills = [];
  }

  get detector_(): PatternDetector { return this.detector; }
  get forger_(): SkillForger { return this.forger; }
}
