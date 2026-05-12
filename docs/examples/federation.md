# Example: Multi-Kit Federation

Connect multiple Cognitive Kit instances. Kit in VS Code, Kit in Database, Kit in CI — all federated.

```typescript
// Kit A: Server (database side)
import { CognitiveKit, PostgresAdapter } from 'cognitive-kit';

const kitA = new CognitiveKit({
  host: new PostgresAdapter({ connectionString: 'postgres://...' }),
  storage: { type: 'sqlite', path: './kit-a.db' },
  transport: { type: 'sse', port: 3100 },
});

await kitA.start();
// Federation server listening on port 3100
```

```typescript
// Kit B: Client (VS Code side)
import { CognitiveKit, FileSystemAdapter } from 'cognitive-kit';

const kitB = new CognitiveKit({
  host: new FileSystemAdapter('./project'),
  transport: { type: 'direct' },
});

await kitB.initialize();

// Connect to Kit A
await kitB.federationManager.connectTo('http://localhost:3100');

// Execute database tools remotely
const tables = await kitB.federationManager.executeOnPeer(
  'http://localhost:3100',
  'pg_list_tables',
  {}
);
console.log(tables.data);

// Use Kit A's cognitive tools + Kit B's filesystem tools together
const analysis = await kitB.federationManager.executeOnPeer(
  'http://localhost:3100',
  'knowledge_evolve',
  { knowledgeBase: JSON.stringify(tables), mode: 'gap' }
);
console.log(analysis.data);

await kitB.stop();
```

## Federation Protocol

```
Kit A (SSE:4200)  ←→  Kit B (stdio)  ←→  Kit C (SSE:4201)
       ↑                    ↑
  PostgreSQL            Filesystem
```

Each kit exposes its tools via the federation protocol. Kits discover each other's tools and call them remotely with sovereignty delegation.
