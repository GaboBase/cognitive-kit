import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '..', 'dist', 'cli.js');

const kit = spawn('node', [cliPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, KIT_HOST_ID: 'agency-test', KIT_HOST_NAME: 'Agency Test' },
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
  const tools = toolList?.result?.tools ?? [];
  const toolNames = tools.map(t => t.name);
  console.log(`Tools: ${toolNames.join(', ')}`);
  console.log(`agency_execute: ${toolNames.includes('agency_execute') ? 'YES' : 'NO'}\n`);

  const raw = await send('tools/call', {
    name: 'agency_execute',
    arguments: {
      objective: 'Design a new authentication service',
      context: 'High security, OAuth2, JWT',
      mode: 'sequential',
    },
  });

  console.log('RAW RESPONSE:');
  console.log(JSON.stringify(raw, null, 2).slice(0, 2000));

  await send('shutdown', {});
  setTimeout(() => kit.kill(), 500);
}

test();
