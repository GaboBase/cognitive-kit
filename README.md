# cognitive-kit

**Pluggable cognitive layer** — embeddable MCP server with 31+ tools for reasoning, research, planning, creativity, reflection, security, knowledge, analysis, agency orchestration, and adaptive pipelines. Zero external infrastructure required.

```
npm i cognitive-kit
npx cognitive-kit
```

---

## Architecture

```
                    CognitiveKit
                   /    |    |    |     \
          MCP Server  Guardian  Agency  Forge  Federation
              |        Gate    Orch.   Registry  Manager
          ToolRegistry   |       |        |         |
        (31 tools)  Sovereignty Adaptive Pattern  SSE + Client
                    +Firewall Pipeline Detector  Multi-Kit
                    +State    +8 Agents +Forger
                     Guardian
```

### Core Components

| Component | Description |
|-----------|-------------|
| **MCP Server** | Model Context Protocol server (v2024-11-05). Supports stdio, SSE, and Direct transports |
| **Guardian Gate** | Middleware that wraps every tool call: sovereignty validation → firewall → state check |
| **Agency Orchestrator** | Adaptive pipeline that selects agents and phases dynamically based on objective analysis |
| **Skill Forger** | Detects usage patterns and auto-generates new skills |
| **Federation Manager** | Connects multiple Cognitive Kit instances via SSE protocol |

### 31 MCP Tools

| Category | Tools |
|----------|-------|
| **Cognitive** (5) | `cognitive_reason`, `cognitive_research`, `cognitive_plan`, `cognitive_create`, `cognitive_reflect` |
| **Security** (9) | `security_gate`, `ethics_audit`, `integrity_ledger`, `threat_mapper`, `red_team`, `blast_radius`, `guardian_status`, `guardian_freeze`, `guardian_unfreeze` |
| **Knowledge** (3) | `memory_vam`, `knowledge_evolve`, `context_synth` |
| **Analysis** (4) | `code_archaeologist`, `sentiment_adapter`, `consensus_engine`, `execution_flow` |
| **Agency** (4) | `swarm_orchestrator`, `meta_orchestrator`, `subagent_protocol`, `agency_execute` |
| **Federation** (4) | `federation_status`, `federation_connect`, `federation_execute`, `federation_disconnect` |
| **Host** (2+) | `fs_read`, `fs_write`, `fs_list`, `fs_stat`, `pg_query`, `pg_schema`, `vscode_read_file`, `vscode_get_selection` |

---

## Installation

```bash
npm install cognitive-kit
```

### Quick Start (MCP Server)

```bash
npx cognitive-kit
```

Connects to any MCP client (VS Code, Cursor, Claude Desktop, custom) via stdio.

### Quick Start (Library)

```typescript
import { CognitiveKit } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: { type: 'cli', name: 'My App', capabilities: ['filesystem'] },
  storage: { type: 'memory' },
  transport: { type: 'stdio' },
  sovereignty: { hostId: 'my-app', hostName: 'My App' },
});

await kit.start();
// 31 MCP tools ready
```

---

## MCP Integration Guides

### VS Code

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "cognitive-kit": {
      "type": "stdio",
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_HOST_ID": "vscode-${workspaceFolderBasename}",
        "KIT_HOST_NAME": "${workspaceFolderBasename}",
        "KIT_SOVEREIGN_KEY": ""
      }
    }
  }
}
```

### Cursor

Settings → MCP → Add Server:

```
Name: cognitive-kit
Type: command
Command: npx cognitive-kit
Environment variables:
  KIT_HOST_ID=cursor
  KIT_HOST_NAME=my-project
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cognitive-kit": {
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_HOST_ID": "claude-desktop",
        "KIT_HOST_NAME": "Claude Desktop"
      }
    }
  }
}
```

### Node.js (Direct Embedding)

```typescript
import { CognitiveKit, FileSystemAdapter } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: new FileSystemAdapter('./workspace', { allowWrite: true }),
  storage: { type: 'sqlite', path: './.kit.db' },
  transport: { type: 'direct' },
});

await kit.initialize();

// Call tools directly
const result = await kit['toolRegistry'].execute('cognitive_reason', {
  problem: 'Analyze this code for potential issues',
  mode: 'logical',
}, {
  identity: { actorId: 'user', actorType: 'user', sovereignty: 0.9, permissions: ['execute'] },
  host: { type: 'cli', name: 'test', capabilities: [] },
  memory: kit['memory'],
});
```

---

## Configuration

### KitConfig

```typescript
interface KitConfig {
  host: HostAdapter | HostProfile;
  storage?: { type: 'sqlite' | 'memory'; path?: string };
  transport?: { type: 'stdio' | 'sse' | 'direct'; port?: number };
  sovereignty?: { hostId: string; hostName: string; hostKey?: string };
  tools?: { autoLoad?: boolean; additional?: ToolDefinition[] };
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIT_HOST_ID` | `cli-host` | Unique identifier for this kit instance |
| `KIT_HOST_NAME` | `Cognitive Kit CLI` | Human-readable host name |
| `KIT_SOVEREIGN_KEY` | - | Key for host-level sovereignty verification |
| `KIT_STORAGE_PATH` | `./.cognitive-kit.db` | SQLite database path |
| `KIT_TRANSPORT` | `stdio` | Transport type: `stdio` or `sse` |
| `KIT_FEDERATION_PORT` | `4200` | Port for federation SSE server |
| `KIT_FEDERATION_PEERS` | - | Comma-separated peer URLs |
| `KIT_FS_ROOT` | `cwd` | Filesystem adapter root path |
| `KIT_FS_ALLOW_WRITE` | `false` | Enable file write operations |
| `KIT_PG_CONNECTION` | - | PostgreSQL connection string |

---

## Host Adapters

| Adapter | Description | Tools |
|---------|-------------|-------|
| **FileSystemAdapter** | Read/write/list files in a root directory | `fs_read`, `fs_write`, `fs_list`, `fs_stat` |
| **PostgresAdapter** | Query databases, inspect schemas | `pg_query`, `pg_schema`, `pg_list_tables`, `pg_describe` |
| **VSCodeAdapter** | VS Code editor integration | `vscode_read_file`, `vscode_get_selection`, `vscode_workspace_info` |
| **Generic** | Minimal adapter for any host type | (no host-specific tools) |

```typescript
// Filesystem
const kit = new CognitiveKit({
  host: new FileSystemAdapter('./data', { allowWrite: true }),
});

// PostgreSQL
const kit = new CognitiveKit({
  host: new PostgresAdapter({ connectionString: 'postgres://...' }),
});
```

---

## Agency System

The adaptive pipeline automatically selects phases and agents based on the objective.

```typescript
const mission = await kit.executeAgency(
  'Design and implement a secure authentication service',
  { mode: 'adaptive' }
);

console.log(mission.status);     // 'completed'
console.log(mission.phases);     // ['create', 'architect', 'security']
console.log(mission.agents);     // [{ name: 'Guardian', role: '...' }, ...]
console.log(mission.synergyScore); // 0.85
```

### Phases

delimit → collect → extract → infer → critical → synergy → architect → validate → research → reason → plan → create → reflect → security → ethics → consensus → execute

### Agents

Architect, Guardian, Executor, Strategist, Analyst, Innovator, Validator, Coordinator

### Modes

`sequential` | `parallel` | `hybrid` | `adaptive`

---

## Guardian Gate

Every tool call passes through the Guardian Gate for security validation.

```
Caller → Sovereignty Check → Firewall (8 rules) → State Check → Tool Execution → Audit
```

```typescript
// Check system status
const metrics = kit.guardian.stateGuardian.getMetrics();
console.log(metrics.totalToolCalls);   // 142
console.log(metrics.errorRate);        // 0.02

// Freeze in emergency (requires sovereignty ≥ 0.9)
await kit.guardian.stateGuardian.freeze('Security breach detected');

// Unfreeze
kit.guardian.stateGuardian.unfreeze();
```

### Firewall Rules

| ID | Pattern | Severity |
|----|---------|----------|
| FW-001 | System command injection | `block` |
| FW-002 | Filesystem escape | `block` |
| FW-003 | API key/secret leak | `block` |
| FW-004 | Mass data access | `flag` |
| FW-005 | Privilege escalation | `block` |
| FW-008 | Arbitrary code execution | `block` |

---

## Skill Forging

The kit detects usage patterns and auto-generates new skills.

```typescript
// Manual forge
const newSkills = kit.forge.forgeFromPatterns(true);
for (const s of newSkills) {
  console.log(`${s.name}: ${s.toolsRequired.join(', ')}`);
}

// Auto-forge runs every 120 seconds when patterns reach threshold
```

---

## Federation

Connect multiple kit instances together.

```typescript
// Kit A starts federation server
const kitA = new CognitiveKit({ transport: { type: 'sse', port: 3100 } });

// Kit B connects to Kit A
const kitB = new CognitiveKit({ transport: { type: 'stdio' } });
await kitB.federationManager.connectTo('http://localhost:3100');

// Execute tools remotely
const result = await kitB.federationManager.executeOnPeer(
  'http://localhost:3100',
  'cognitive_reason',
  { problem: 'Analyze distributed system', mode: 'logical' }
);
```

---

## Examples

See full examples in the repository:

- [Basic MCP Server](docs/examples/mcp-server.md)
- [Library Embedding](docs/examples/library-embed.md)
- [PostgreSQL Knowledge Explorer](docs/examples/pg-explorer.md)
- [Federation Multi-Kit](docs/examples/federation.md)
- [Custom Host Adapter](docs/examples/custom-adapter.md)

---

## Development

```bash
git clone https://github.com/GaboBase/TODO-Cognitive.git
cd packages/cognitive-kit
npm install
npm run build
npm test
```

## License

MIT © GaboBase
