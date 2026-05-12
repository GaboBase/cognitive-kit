import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '..', 'dist', 'cli.js');

const kit = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    KIT_HOST_ID: 'fed-test',
    KIT_HOST_NAME: 'Federation Test',
    KIT_FEDERATION_PORT: '14200',
  },
});

const rl = createInterface({ input: kit.stdout, crlfDelay: Infinity });
let msgId = 0;
const pending = new Map();

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  } catch {}
});

kit.stderr.on('data', (d) => process.stderr.write(d));

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, { resolve });
    kit.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function waitForOutput(pattern, timeout = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    const handler = (data) => {
      if (data.toString().includes(pattern)) {
        clearTimeout(timer);
        kit.stderr.removeListener('data', handler);
        resolve(true);
      }
    };
    kit.stderr.on('data', handler);
  });
}

async function test() {
  await waitForOutput('MCP server started');
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } });

  const toolList = await send('tools/list', {});
  const toolNames = toolList?.result?.tools.map(t => t.name) ?? [];
  console.log(`Tools: ${toolNames.length}`);

  const fedTools = ['federation_status', 'federation_connect', 'federation_execute', 'federation_disconnect'];
  const allPresent = fedTools.every(t => toolNames.includes(t));
  console.log(`Federation tools: ${allPresent ? 'YES' : 'MISSING'}\n`);

  let passed = 0, failed = 0;

  // Test 1: federation_status
  const status = await send('tools/call', { name: 'federation_status', arguments: {} });
  const sText = status?.result?.content?.[0]?.text ?? '';
  if (sText.includes('peerCount') || sText.includes('serverUrl')) {
    console.log('  \u2713 federation_status');
    passed++;
  } else {
    console.log('  \u2717 federation_status');
    failed++;
  }

  // Test 2: federation_connect (to self would fail since we're using port 0, but should handle gracefully)
  const connect = await send('tools/call', { name: 'federation_connect', arguments: { url: 'http://localhost:0' } });
  const cText = connect?.result?.content?.[0]?.text ?? '';
  if (cText.includes('Failed') || cText.includes('Connected') || cText.includes('not')) {
    console.log('  \u2713 federation_connect handles gracefully');
    passed++;
  } else {
    console.log('  \u2717 federation_connect');
    failed++;
  }

  // Test 3: federation_status shows stats
  const status2 = await send('tools/call', { name: 'federation_status', arguments: {} });
  const s2Text = status2?.result?.content?.[0]?.text ?? '';
  if (s2Text) {
    console.log('  \u2713 federation_status returns data');
    passed++;
  } else {
    console.log('  \u2717 federation_status empty');
    failed++;
  }

  // Test 4: federation tool count in list
  const fedCount = fedTools.filter(t => toolNames.includes(t)).length;
  if (fedCount === 4) {
    console.log('  \u2713 All 4 federation tools registered');
    passed++;
  } else {
    console.log(`  \u2717 Expected 4 federation tools, got ${fedCount}`);
    failed++;
  }

  console.log(`\nFederation tests: ${passed}/${passed + failed} passed`);

  await send('shutdown', {});
  setTimeout(() => kit.kill(), 500);
}

test();
