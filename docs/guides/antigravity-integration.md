# Antigravity Integration Guide

Integrate `cognitive-kit` (31+ MCP tools) into the **Antigravity AI Agent** framework to extend its cognitive capabilities — reasoning, research, planning, security, knowledge, agency orchestration, and adaptive pipelines.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│            ANTIGRAVITY AI AGENT               │
│  .gemini/GEMINI.md  ←  Agent Rules            │
│  C4IRS+S Roles     ←  Reasoning Cycles        │
│  AR-Tier Personas  ←  Domain Specialization   │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │        MCP CLIENT (built-in)         │    │
│  └──────────┬───────────────────────────┘    │
└─────────────┼────────────────────────────────┘
              │ MCP stdio/SSE
              ▼
┌──────────────────────────────────────────────┐
│             COGNITIVE KIT (MCP Server)        │
│                                              │
│  31 tools: cognitive_reason, cognitive_plan, │
│  security_gate, ethics_audit, agency_execute, │
│  guardian_status, skill_forge, federation...  │
│                                              │
│  Guardian Gate → Sovereignty + Firewall      │
│  Agency Orch.  → Adaptive pipelines           │
│  Skill Forging → Pattern → Skills            │
│  Federation   → Multi-kit                    │
└──────────────────────────────────────────────┘
```

---

## Quick Start (VS Code)

### 1. Install the Kit

```bash
npm install -g cognitive-kit
```

### 2. Configure MCP in VS Code

Create `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "cognitive-kit": {
      "type": "stdio",
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_HOST_ID": "antigravity-${workspaceFolderBasename}",
        "KIT_HOST_NAME": "${workspaceFolderBasename}",
        "KIT_SOVEREIGN_KEY": ""
      }
    }
  }
}
```

### 3. Restart VS Code

The kit's 31 tools appear in the MCP tool list. Antigravity can now invoke them via C4IRS cycles.

---

## Persona-to-Tool Mapping

Map C4IRS+S roles and AR-tier personas to cognitive-kit tools for precise capability delegation.

| C4IRS Role | AR Persona | cognitive-kit Tools |
|------------|------------|-------------------|
| **`[C]` Command** | AR-100 Architect | `cognitive_plan`, `cognitive_reason`, `consensus_engine` |
| **`[C]` Control** | AR-200 Engineer | `execution_flow`, `swarm_orchestrator`, `subagent_protocol` |
| **`[C]` Communications** | AR-300 Artisan | `cognitive_create`, `sentiment_adapter`, `context_synth` |
| **`[I]` Intelligence** | AR-400 Oracle | `cognitive_research`, `knowledge_evolve`, `memory_vam` |
| **`[R]` Reconnaissance** | AR-400 Oracle | `code_archaeologist`, `context_synth`, `threat_mapper` |
| **`[S]` Surveillance** | AR-500 Operator | `guardian_status`, `state_guardian`, `integrity_ledger` |
| **`[S]` Sovereignty** | AR-100 Architect | `guardian_freeze`, `guardian_unfreeze`, `integrity_ledger` |

---

## C4IRS Workflow Integration

### `[C]` Command — Strategic Planning

Instead of manual reasoning, delegate to the agency pipeline:

```
Antigravity: "Plan the authentication microservice"
  → calls agency_execute(objective: "Design auth service", mode: "adaptive")
  → Kit selects phases: [delimit, research, architect, security, validate]
  → Kit assigns agents: [Strategist, Analyst, Architect, Guardian, Validator]
  → Returns: mission plan with 5 phases, synergy score, sovereignty seal
```

### `[I]` Intelligence — Deep Research

Use multi-perspective research:

```
Antigravity: "Research vector database options"
  → calls cognitive_research(topic: "vector databases 2026", depth: "deep")
  → Returns: analysis from architect, guardian, executor, strategic perspectives
```

### `[R]` Reconnaissance — Codebase Analysis

Analyze project structure:

```
Antigravity: "Analyze the src/ directory structure"
  → calls fs_list(path: "src")
  → calls code_archaeologist(code: "<file content>", mode: "full")
  → calls knowledge_evolve(knowledgeBase: "<analysis>", mode: "gap")
```

### `[S]` Surveillance — System Health

Monitor the kit's operational state:

```
Antigravity: "Check system health"
  → calls guardian_status()
  → Returns: tool metrics, error rate, firewall stats, sovereignty chain
```

---

## Prompt Injection (`.gemini/GEMINI.md`)

Add these rules to your `.gemini/GEMINI.md` to enable cognitive-kit awareness:

```markdown
## 🧠 Cognitive Kit Integration (MCP)

You have access to the Cognitive Kit MCP server with 31+ tools.

### Available Tool Categories

| Category | Tools | Use Case |
|----------|-------|----------|
| **Cognitive** | reason, research, plan, create, reflect | Core reasoning & analysis |
| **Security** | gate, ethics, ledger, threat, redteam, blast | Security audits & threat modeling |
| **Knowledge** | vam, evolve, synth | Memory & knowledge operations |
| **Analysis** | code, sentiment, consensus, flow | Code review & process analysis |
| **Agency** | swarm, meta, subagent, execute | Multi-agent orchestration |
| **Guardian** | status, freeze, unfreeze | System monitoring & control |
| **Federation** | status, connect, execute, disconnect | Multi-kit communication |
| **Forge** | skill_forge, skill_list_forged | Auto-generate skills |

### C4IRS Tool Delegation

- Use `agency_execute` for complex multi-step tasks (replaces manual iteration)
- Use `cognitive_reason` for logical analysis (replaces chain-of-thought)
- Use `consensus_engine` for architectural decisions (replaces manual deliberation)
- Use `threat_mapper` for risk assessment (replaces STRIDE manual analysis)
- Use `guardian_status` before ANY destructive operation

### Execution Protocol

1. Before any action, call `guardian_status` to verify system health
2. For complex tasks, call `agency_execute` with mode: "adaptive"
3. For analysis, delegate to the appropriate cognitive tool
4. After execution, call `integrity_ledger` to seal the operation
5. Call `guardian_status` to verify post-operation state
```

---

## Antigravity Autorun Configuration

Update your `.antigravity-autorun.njk` to start the kit automatically:

```njk
# Antigravity Autorun Configuration
# Auto-enables CDP: true
# Run always: true

# Start Cognitive Kit MCP Server
npx cognitive-kit &
sleep 2
echo "Cognitive Kit ready — 31 tools available"

{% set languages = ["python", "go", "typescript"] %}
{% for lang in languages %}
- Enable {{ lang }} usage: true
{% endfor %}
```

---

## Using cognitive-kit as a Library (Embedded Mode)

For deeper integration, embed cognitive-kit directly into Antigravity's runtime:

```javascript
// antigravity-cognitive.js
import { CognitiveKit, FileSystemAdapter } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: new FileSystemAdapter(process.cwd(), { allowWrite: true }),
  storage: { type: 'sqlite', path: './.cognitive-kit.db' },
  transport: { type: 'direct' }, // in-process, no MCP needed
  sovereignty: {
    hostId: 'antigravity-' + process.env.KIT_HOST_ID,
    hostName: 'Antigravity Agent',
  },
});

await kit.initialize();

export default {
  // Expose tools to Antigravity's reasoning engine
  reason: (problem) => kit['toolRegistry'].execute('cognitive_reason', { problem }),
  research: (topic) => kit['toolRegistry'].execute('cognitive_research', { topic }),
  plan: (objective) => kit.executeAgency(objective, { mode: 'adaptive' }),
  gate: (payload) => kit.guardian.guardianGate.executeTool('security_gate', { payload }, ctx),
  status: () => kit.guardian.stateGuardian.getMetrics(),
};
```

---

## Federation: Antigravity + Other Systems

Connect Antigravity to other kit instances (databases, CI/CD, etc.):

```
Antigravity (VS Code)
  │ federation_connect("http://db-kit:4200")
  │
  ├── pg_schema → Explore database structure
  ├── cognitive_reason → Analyze schema relationships
  └── knowledge_evolve → Identify knowledge gaps
```

```json
{
  "servers": {
    "cognitive-kit": {
      "type": "stdio",
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_FEDERATION_PEERS": "http://localhost:4200"
      }
    }
  }
}
```

---

## Tool Reference by Antigravity Workflow

### W-201 Deep Research
```
cognitive_research(topic, depth: "deep", perspectives: "architect,guardian,executor,strategic")
knowledge_evolve(knowledgeBase: "<findings>", mode: "gap")
context_synth(sources: "<findings>", mode: "summarize")
```

### W-202 Chain Actions
```
agency_execute(objective, mode: "sequential")
execution_flow(process, granularity: "fine")
subagent_protocol(task, mode: "supervised")
```

### W-203 Semantic Embeddings
```
memory_vam(action: "search", query, namespace: "knowledge")
knowledge_evolve(knowledgeBase: "<results>", mode: "connect")
```

### W-204 Context Orchestration
```
context_synth(sources: "<contexts>", mode: "merge")
memory_vam(action: "store", content: "<synthesized>", namespace: "context")
```

### W-205 Criteria Enforcement
```
ethics_audit(subject: "<decision>")
consensus_engine(proposal: "<decision>", model: "weighted")
integrity_ledger(action: "create", payload: "<decision>")
```

---

## Example: Antigravity + cognitive-kit Session

```
User: "Design and implement a secure file upload service"

Antigravity:
  [C] Command → agency_execute(objective: "Design file upload service", mode: "adaptive")
  ← Returns: 6-phase plan [delimit, research, architect, security, validate, execute]

  [I] Intelligence → cognitive_research(topic: "secure file upload patterns 2026", depth: "deep")
  ← Returns: multi-perspective analysis

  [C] Control → execution_flow(process: "Implement upload endpoint", granularity: "fine")
  ← Returns: 8-step execution plan with dependencies

  [S] Surveillance → security_gate(payload: "<implementation code>")
  ← Returns: PASSED (no violations)

  [S] Sovereignty → integrity_ledger(action: "create", payload: "Upload service v1 deployed")
  ← Returns: signed ledger entry with seal

  → Emits: Sovereign Audit Trace with completion status
```

---

## Requirements

- Node.js ≥ 20
- VS Code (or any MCP-compatible editor)
- `npx cognitive-kit` (auto-installs on first run)
- `.vscode/mcp.json` configured (see Quick Start)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Tool not found" | Ensure cognitive-kit is running (`npx cognitive-kit`) |
| Connection refused | Restart VS Code after adding `mcp.json` |
| Firewall blocked | Check `guardian_status` for blocked operations |
| Federation timeout | Verify peer URL and port are correct |

---

## Related

- [VS Code Integration Guide](./vscode-integration.md)
- [Cursor Integration Guide](./cursor-integration.md)
- [Claude Desktop Integration Guide](./claude-desktop-integration.md)
- [Federation Multi-Kit Example](../examples/federation.md)
- [Cognitive Kit README](../../README.md)
