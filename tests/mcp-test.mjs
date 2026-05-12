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
    KIT_HOST_ID: 'test-host',
    KIT_HOST_NAME: 'E2E Test',
    KIT_SOVEREIGN_KEY: 'test-key',
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
  } catch {
    console.error('NON-JSON:', trimmed);
  }
});

kit.stderr.on('data', (d) => process.stderr.write(d));

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, { resolve });
    kit.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

async function waitForOutput(pattern, timeout = 5000) {
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
  const passed = [];
  const failed = [];

  try {
    // Wait for kit to start
    await waitForOutput('MCP server started');
    console.log('✓ Kit started');

    // Test 1: Initialize
    const init = await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    });
    if (init.result?.serverInfo?.name) {
      passed.push('initialize');
      console.log(`  ✓ initialize -> ${init.result.serverInfo.name}`);
    } else {
      failed.push('initialize');
      console.log('  ✗ initialize failed:', JSON.stringify(init));
    }

    // Test 2: List tools
    const list = await send('tools/list', {});
    if (list.result?.tools?.length >= 5) {
      passed.push('tools/list');
      const names = list.result.tools.map(t => t.name);
      console.log(`  ✓ tools/list -> ${list.result.tools.length} tools: ${names.join(', ')}`);
    } else {
      failed.push('tools/list');
      console.log('  ✗ tools/list failed:', JSON.stringify(list));
    }

    // Test 3: Call cognitive_reason
    const reason = await send('tools/call', {
      name: 'cognitive_reason',
      arguments: { problem: 'All humans are mortal. Socrates is human. Is Socrates mortal?', mode: 'deductive' },
    });
    if (reason.result?.content?.[0]?.text) {
      passed.push('cognitive_reason');
      console.log(`  ✓ cognitive_reason -> confidence: ${reason.result.meta?.sovereignty}`);
    } else {
      failed.push('cognitive_reason');
      console.log('  ✗ cognitive_reason failed:', JSON.stringify(reason));
    }

    // Test 4: Call cognitive_research
    const research = await send('tools/call', {
      name: 'cognitive_research',
      arguments: { topic: 'Quantum computing applications', depth: 'quick' },
    });
    if (research.result?.content?.[0]?.text) {
      passed.push('cognitive_research');
      console.log(`  ✓ cognitive_research -> ${research.result.content[0].text.slice(0, 80)}...`);
    } else {
      failed.push('cognitive_research');
      console.log('  ✗ cognitive_research failed');
    }

    // Test 5: Call cognitive_plan
    const plan = await send('tools/call', {
      name: 'cognitive_plan',
      arguments: { objective: 'Build a web application', constraints: 'Must use React, 2 week timeline' },
    });
    if (plan.result?.content?.[0]?.text) {
      passed.push('cognitive_plan');
      console.log(`  ✓ cognitive_plan -> ${plan.result.content[0].text.slice(0, 80)}...`);
    } else {
      failed.push('cognitive_plan');
    }

    // Test 6: Call cognitive_create
    const create = await send('tools/call', {
      name: 'cognitive_create',
      arguments: { prompt: 'Design a new type of user interface', domain: 'ui', style: 'divergent', count: 3 },
    });
    if (create.result?.content?.[0]?.text) {
      passed.push('cognitive_create');
      console.log(`  ✓ cognitive_create -> ${create.result.content[0].text.slice(0, 80)}...`);
    } else {
      failed.push('cognitive_create');
    }

    // Test 7: Call cognitive_reflect
    const reflect = await send('tools/call', {
      name: 'cognitive_reflect',
      arguments: { context: 'System performance review Q1 2026', mode: 'analyze' },
    });
    if (reflect.result?.content?.[0]?.text) {
      passed.push('cognitive_reflect');
      console.log(`  ✓ cognitive_reflect -> ${reflect.result.content[0].text.slice(0, 80)}...`);
    } else {
      failed.push('cognitive_reflect');
    }

    // Test 8: Ping
    const ping = await send('ping', {});
    if (ping.result?.status === 'ok') {
      passed.push('ping');
      console.log('  ✓ ping -> ok');
    } else {
      failed.push('ping');
    }

    // Summary
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`RESULTS: ${passed.length} passed, ${failed.length} failed`);
    if (failed.length > 0) console.log(`FAILED: ${failed.join(', ')}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (err) {
    console.error('Test error:', err);
  }

  // Shutdown
  await send('shutdown', {});
  setTimeout(() => {
    kit.kill();
    process.exit(failed.length > 0 ? 1 : 0);
  }, 500);
}

test();
