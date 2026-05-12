import type { ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export const codeArchaeologistTool: ToolDefinition = {
  id: 'code_archaeologist',
  name: 'Code Archaeologist',
  description: 'Code analysis and pattern discovery engine. Analyzes source code for structural patterns, anti-patterns, complexity metrics, dependency relationships, and evolutionary insights.',
  inputSchema: {
    code: { type: 'string', description: 'Source code to analyze' },
    language: { type: 'string', description: 'Programming language (auto-detected if empty)' },
    mode: { type: 'string', enum: ['structure', 'patterns', 'complexity', 'dependencies', 'full'], description: 'Analysis mode' },
  },
  category: 'cognitive',
  handler: async (params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> => {
    const code = String(params.code || '');
    const language = String(params.language || detectLanguage(code));
    const mode = String(params.mode || 'full');

    if (!code) {
      return { success: false, data: null, error: 'Source code is required' };
    }

    const lines = code.split('\n');
    const structure = analyzeStructure(code, language);
    const complexity = computeComplexity(code, lines);
    const patterns = findPatterns(code, language);
    const deps = findDependencies(code, language);
    const antiPatterns = findAntiPatterns(code, language);

    let analysis: any;

    switch (mode) {
      case 'structure': {
        analysis = {
          mode: 'structural_analysis',
          language,
          structure,
          loc: lines.length,
          summary: `${structure.functions.length} functions, ${structure.classes.length} classes, ${lines.length} LOC`,
        };
        break;
      }

      case 'patterns': {
        analysis = {
          mode: 'pattern_discovery',
          language,
          patterns,
          antiPatterns,
          patternCount: patterns.length,
          antiPatternCount: antiPatterns.length,
          summary: `Found ${patterns.length} design patterns, ${antiPatterns.length} anti-patterns`,
        };
        break;
      }

      case 'complexity': {
        analysis = {
          mode: 'complexity_analysis',
          language,
          complexity,
          loc: lines.length,
          summary: `Complexity score: ${complexity.overall.toFixed(1)}, Depth: ${complexity.maxDepth}, Dependencies: ${deps.length}`,
        };
        break;
      }

      case 'dependencies': {
        analysis = {
          mode: 'dependency_analysis',
          language,
          dependencies: deps,
          depCount: deps.length,
          summary: `${deps.length} dependencies found (${deps.filter(d => d.type === 'external').length} external, ${deps.filter(d => d.type === 'internal').length} internal)`,
        };
        break;
      }

      default: {
        analysis = {
          mode: 'full_analysis',
          language,
          loc: lines.length,
          structure,
          complexity,
          patterns,
          antiPatterns,
          dependencies: deps,
          overallHealth: computeHealth(complexity, antiPatterns),
          summary: `Full analysis of ${lines.length} LOC ${language} code: ${structure.functions.length} functions, ${complexity.overall.toFixed(1)} complexity, ${deps.length} dependencies`,
        };
      }
    }

    await ctx.memory.store('analysis', `code-${Date.now()}`, {
      language,
      loc: lines.length,
      mode,
    });

    return {
      success: true,
      data: analysis,
      metadata: {
        language,
        loc: lines.length,
        mode,
        sovereignty: ctx.identity.sovereignty,
      },
    };
  },
};

function detectLanguage(code: string): string {
  if (code.includes('import') && (code.includes('def ') || code.includes('class ') && code.includes(':'))) return 'python';
  if (code.includes('function') || code.includes('const ') || code.includes('let ') || code.includes('=>')) return 'javascript';
  if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
  if (code.includes('fn ') || code.includes('let mut') || code.includes('->')) return 'rust';
  if (code.includes('public class') || code.includes('private ') || code.includes('System.out')) return 'java';
  return 'unknown';
}

function analyzeStructure(code: string, _language: string): Record<string, any> {
  const functions = (code.match(/(?:function|def|fn|const\s+\w+\s*=\s*(?:async\s*)?\(|public|private|protected)\s+\w+\s*\(/g) || []).length;
  const classes = (code.match(/(?:class|interface|struct|trait)\s+\w+/g) || []).length;
  const imports = (code.match(/(?:import|require|from|using|include)\s+/g) || []).length;
  const comments = (code.match(/\/\/|\/\*|#|--|<!--/g) || []).length;
  const blankLines = code.split('\n').filter(l => l.trim() === '').length;
  return {
    functions,
    classes,
    imports,
    comments,
    blankLines,
    commentRatio: code.split('\n').length > 0 ? parseFloat((comments / code.split('\n').length).toFixed(3)) : 0,
  };
}

function computeComplexity(code: string, lines: string[]): Record<string, number> {
  const cyclomatic = (code.match(/if\s|else\s|for\s|while\s|case\s|catch\s|&&|\|\|/g) || []).length;
  const nesting = lines.reduce((max, line) => {
    const depth = (line.match(/\s/g) || []).length;
    return Math.max(max, Math.floor(depth / 2));
  }, 0);
  const tokens = code.split(/\W+/).filter(t => t.length > 0);
  return {
    cyclomatic,
    maxDepth: Math.min(nesting, 10),
    tokenCount: tokens.length,
    overall: parseFloat((cyclomatic * 0.4 + nesting * 0.3 + (tokens.length / 100) * 0.3).toFixed(2)),
  };
}

function findPatterns(code: string, _language: string): string[] {
  const patterns: string[] = [];
  if (code.includes('class') && code.includes('extends')) patterns.push('inheritance');
  if (code.includes('interface')) patterns.push('abstraction');
  if (code.includes('async') || code.includes('await')) patterns.push('async/await');
  if (code.includes('.map(') || code.includes('.filter(')) patterns.push('functional-transformation');
  if (code.includes('Promise') || code.includes('.then(')) patterns.push('promise-chain');
  if (code.includes('try') && code.includes('catch')) patterns.push('error-handling');
  if (code.match(/^\s*\/\*\*/m)) patterns.push('jsdoc-annotated');
  if (code.includes('singleton') || code.includes('getInstance')) patterns.push('singleton');
  if (code.includes('factory') || code.includes('create')) patterns.push('factory-method');
  if (code.includes('observer') || code.includes('EventEmitter') || code.includes('addEventListener')) patterns.push('observer');
  if (code.includes('strategy') || code.includes('Strategy')) patterns.push('strategy');
  return patterns.length > 0 ? patterns : ['no-clear-patterns'];
}

function findDependencies(code: string, _language: string): Array<{ name: string; type: string }> {
  const deps: Array<{ name: string; type: string }> = [];
  const importRegex = /(?:import\s+(?:\w+\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|from\s+(\w+)\s+import)/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (name) {
      deps.push({
        name,
        type: name.startsWith('.') || name.startsWith('/') ? 'internal' : 'external',
      });
    }
  }
  return deps.slice(0, 15);
}

function findAntiPatterns(code: string, _language: string): string[] {
  const anti: string[] = [];
  if (code.includes('var ')) anti.push('var-usage (use let/const instead)');
  if ((code.match(/function/g) || []).length > 15) anti.push('god-function (too many functions in scope)');
  if ((code.match(/\s{4}/g) || []).length > (code.match(/\t/g) || []).length) anti.push('mixed-indentation');
  if (code.includes('any') && (code.match(/any/g) || []).length > 5) anti.push('excessive-any-types');
  if ((code.match(/\/\/ TODO/g) || []).length > 3) anti.push('accumulated-todos');
  if ((code.match(/console\.log/g) || []).length > 5) anti.push('debug-logging-in-production');
  if (code.split('\n').some(l => l.length > 120)) anti.push('long-lines (>120 chars)');
  if (code.includes('catch') && !code.includes('console.error') && !code.includes('throw')) anti.push('empty-catch-blocks');
  if ((code.match(/if\s*\(/g) || []).length > 10) anti.push('deep-conditional-nesting');
  return anti.slice(0, 8);
}

function computeHealth(complexity: Record<string, number>, antiPatterns: string[]): Record<string, unknown> {
  const score = Math.max(0, Math.min(10, 10 - complexity.overall - antiPatterns.length * 0.5));
  return {
    score: parseFloat(score.toFixed(1)),
    label: score >= 7 ? 'HEALTHY' : score >= 4 ? 'NEEDS_ATTENTION' : 'CRITICAL',
    complexityImpact: parseFloat((complexity.overall / 10).toFixed(2)),
    antiPatternImpact: parseFloat((antiPatterns.length * 0.5 / 10).toFixed(2)),
  };
}
