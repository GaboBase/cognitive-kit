import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '..', 'dist', 'cli.js');

const kit = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, KIT_HOST_ID: 'forge-test', KIT_HOST_NAME: 'Forge Test' },
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
  console.log(`Forge tools: ${['skill_forge', 'skill_list_forged'].every(t => toolNames.includes(t)) ? 'YES' : 'NO'}\n`);

  let passed = 0, failed = 0;

  // Step 1: Make some tool calls to create usage patterns
  console.log('Creating usage patterns...');
  for (let i = 0; i < 3; i++) {
    await send('tools/call', { name: 'cognitive_reason', arguments: { problem: `Test ${i}`, mode: 'logical' } });
    await send('tools/call', { name: 'cognitive_research', arguments: { topic: `Topic ${i}`, depth: 'quick' } });
  }
  console.log('  Made 6 tool calls\n');

  // Step 2: List forged skills (should be 0 before forging)
  const before = await send('tools/call', { name: 'skill_list_forged', arguments: {} });
  const bText = before?.result?.content?.[0]?.text ?? '';
  console.log(`Forged skills before forge: ${JSON.parse(bText).count || 0}`);

  // Step 3: Forge! (force=true since pattern freq might be low)
  const forge = await send('tools/call', { name: 'skill_forge', arguments: { force: true } });
  const fText = forge?.result?.content?.[0]?.text ?? '';
  const fData = JSON.parse(fText);

  if (fData.forged > 0) {
    console.log(`  \u2713 Forged ${fData.forged} skill(s) from ${fData.stats?.patternsFound || 0} patterns`);
    for (const s of fData.newSkills) {
      console.log(`    - ${s.name} (tools: ${s.tools.join(', ')})`);
    }
    passed++;
  } else if (fData.totalForged > 0) {
    console.log(`  \u2713 Already has ${fData.totalForged} forged skills`);
    passed++;
  } else {
    console.log('  \u2717 No skills forged');
    failed++;
  }

  // Step 4: List forged skills again
  const after = await send('tools/call', { name: 'skill_list_forged', arguments: {} });
  const aText = after?.result?.content?.[0]?.text ?? '';
  const aData = JSON.parse(aText);
  if (aData.count > 0) {
    console.log(`  \u2713 Total forged: ${aData.count}`);
    passed++;
  } else {
    console.log('  \u2717 No forged skills listed');
    failed++;
  }

  // Step 5: Verify stats in forge response
  if (fData.stats?.totalCalls >= 6 && fData.stats?.uniqueTools >= 2) {
    console.log(`  \u2713 Pattern stats: ${fData.stats.totalCalls} calls, ${fData.stats.uniqueTools} tools, ${fData.stats.patternsFound} patterns`);
    passed++;
  } else {
    console.log('  \u2717 Stats mismatch');
    failed++;
  }

  console.log(`\nForge tests: ${passed}/${passed + failed} passed`);

  await send('shutdown', {});
  setTimeout(() => kit.kill(), 500);
}

test();
