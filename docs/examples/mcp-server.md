# Example: MCP Server (standalone)

Run Cognitive Kit as a standalone MCP server for any client (VS Code, Cursor, Claude Desktop, or custom).

```typescript
// mcp-server.ts
import { CognitiveKit } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: {
    type: 'cli',
    name: 'My MCP Server',
    capabilities: ['filesystem'],
  },
  storage: { type: 'sqlite', path: './.kit.db' },
  transport: { type: 'stdio' },
  sovereignty: {
    hostId: process.env.KIT_HOST_ID || 'mcp-1',
    hostName: process.env.KIT_HOST_NAME || 'MCP Server',
  },
});

process.on('SIGINT', async () => { await kit.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await kit.stop(); process.exit(0); });

await kit.start();
// MCP protocol on stdio — 31 tools available
```

## Run

```bash
npx tsx mcp-server.ts
```

## Add to VS Code

```json
{
  "servers": {
    "cognitive-kit": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server.ts"]
    }
  }
}
```
