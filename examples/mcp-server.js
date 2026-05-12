// cognitive-kit — MCP Server Example
// Starts the kit as a stdio MCP server (compatible with VS Code, Cursor, Claude Desktop)

import { CognitiveKit } from 'cognitive-kit';

const kit = new CognitiveKit({
  host: { type: 'cli', name: 'Cognitive MCP Server', capabilities: ['filesystem'] },
  storage: { type: 'sqlite', path: './.cognitive-kit.db' },
  transport: { type: 'stdio' },
  sovereignty: {
    hostId: process.env.KIT_HOST_ID || 'mcp-server',
    hostName: process.env.KIT_HOST_NAME || 'MCP Server',
    hostKey: process.env.KIT_SOVEREIGN_KEY,
  },
});

process.on('SIGINT', async () => { await kit.stop(); process.exit(0); });
process.on('SIGTERM', async () => { await kit.stop(); process.exit(0); });

kit.on('error', (err) => console.error('[kit]', err));

await kit.start();
