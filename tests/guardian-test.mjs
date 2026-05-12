import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '..', 'dist', 'cli.js');

const kit = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, KIT_HOST_ID: 'guardian-test', KIT_HOST_NAME: 'Guardian Test' },
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
  console.log(`Guardian tools present: ${['guardian_status', 'guardian_freeze', 'guardian_unfreeze'].every(t => toolNames.includes(t)) ? 'YES' : 'MISSING'}\n`);

  let passed = 0, failed = 0;

  // Test 1: guardian_status
  const status = await send('tools/call', { name: 'guardian_status', arguments: {} });
  const sText = status?.result?.content?.[0]?.text ?? '';
  if (sText.includes('metrics') && sText.includes('firewall')) {
    console.log('  \u2713 guardian_status');
    passed++;
  } else {
    console.log('  \u2717 guardian_status');
    failed++;
  }

  // Test 2: guardian_status should show guardian metadata on all tool calls
  const reason = await send('tools/call', { name: 'cognitive_reason', arguments: { problem: 'Test', mode: 'logical' } });
  const rMeta = reason?.result?.meta;
  if (rMeta?.guardian?.operationId && rMeta?.guardian?.seal) {
    console.log(`  \u2713 guardian metadata on tool call (seal: ${rMeta.guardian.seal})`);
    passed++;
  } else {
    console.log('  \u2717 guardian metadata missing');
    failed++;
  }

  // Test 3: Verify sovereignty chain
  const status2 = await send('tools/call', { name: 'guardian_status', arguments: {} });
  const sText2 = status2?.result?.content?.[0]?.text ?? '';
  if (sText2.includes('totalOperations') && sText2.includes('recentOperations')) {
    console.log('  \u2713 guardian_status with sovereignty info');
    passed++;
  } else {
    console.log('  \u2717 guardian_status missing sovereignty info');
    failed++;
  }

  // Test 4: firewall blocks dangerous input
  const block = await send('tools/call', { name: 'cognitive_plan', arguments: { objective: 'rm -rf / && format C:' } });
  const bText = block?.result?.content?.[0]?.text ?? '';
  const bError = block?.result?.isError;
  if (bError && bText.includes('BLOCKED') || bText.includes('GUARDIAN')) {
    console.log('  \u2713 firewall blocked dangerous input');
    passed++;
  } else {
    console.log('  \u2717 firewall did not block (isError=' + bError + ')');
    failed++;
  }

  // Test 5: firewall blocks secret pattern
  const block2 = await send('tools/call', { name: 'cognitive_create', arguments: { prompt: 'My key is sk-test12345678901234567890' } });
  const b2Text = block2?.result?.content?.[0]?.text ?? '';
  const b2Error = block2?.result?.isError;
  if (b2Error && (b2Text.includes('BLOCKED') || b2Text.includes('GUARDIAN'))) {
    console.log('  \u2713 firewall blocked secret key pattern');
    passed++;
  } else {
    console.log('  \u2717 firewall allowed secret (isError=' + b2Error + ')');
    failed++;
  }

  console.log(`\nGuardian tests: ${passed}/${passed + failed} passed`);

  await send('shutdown', {});
  setTimeout(() => kit.kill(), 500);
}

test();
