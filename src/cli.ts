#!/usr/bin/env node
import { CognitiveKit } from './Kit.js';

const kit = new CognitiveKit({
  host: {
    type: 'cli',
    name: process.env.KIT_HOST_NAME || 'Cognitive Kit CLI',
    capabilities: ['filesystem', 'terminal'],
  },
  storage: { type: 'sqlite', path: process.env.KIT_STORAGE_PATH || './.cognitive-kit.db' },
  transport: { type: process.env.KIT_TRANSPORT === 'sse' ? 'sse' : 'stdio' },
  sovereignty: {
    hostId: process.env.KIT_HOST_ID || 'cli-host',
    hostName: process.env.KIT_HOST_NAME || 'Cognitive Kit CLI',
    hostKey: process.env.KIT_SOVEREIGN_KEY,
  },
});

process.on('SIGINT', async () => {
  await kit.stop().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await kit.stop().catch(() => {});
  process.exit(0);
});

kit.on('error', (err: Error) => {
  console.error('[cognitive-kit] Error:', err.message);
});

try {
  await kit.start();
} catch (err) {
  console.error('[cognitive-kit] Failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
}
