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
    KIT_HOST_NAME: 'Phase2 Test',
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
  } catch { /* stderr output */ }
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

const tests = [
  { id: 'initialize', fn: () => send('initialize', {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' },
  }).then(r => r.result?.serverInfo?.name ? true : 'no server name') },

  { id: 'tools/list', fn: () => send('tools/list', {}).then(r => {
    const tools = r.result?.tools ?? [];
    return tools.length >= 21 ? true : `expected >=21 tools, got ${tools.length}`;
  }) },

  { id: 'security_gate', fn: () => send('tools/call', {
    name: 'security_gate', arguments: { payload: "SELECT * FROM users WHERE id='1' OR '1'='1", mode: 'enforce' },
  }).then(r => {
    const text = r.result?.content?.[0]?.text ?? '';
    return text.includes('BLOCKED') || text.includes('violation') ? true : 'no violation detected';
  }) },

  { id: 'ethics_audit', fn: () => send('tools/call', {
    name: 'ethics_audit', arguments: { subject: 'Using AI to monitor employee communications for productivity tracking', frameworks: 'utilitarian,deontological' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'integrity_ledger', fn: () => send('tools/call', {
    name: 'integrity_ledger', arguments: { action: 'create', actor: 'test', resource: 'test-resource', payload: 'test entry' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'threat_mapper', fn: () => send('tools/call', {
    name: 'threat_mapper', arguments: { systemDescription: 'Web application with authentication API and database backend', context: 'cloud' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'red_team', fn: () => send('tools/call', {
    name: 'red_team', arguments: { target: 'Internal API gateway with JWT auth', intensity: 'standard' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'blast_radius', fn: () => send('tools/call', {
    name: 'blast_radius', arguments: { failedComponent: 'primary-database', failureMode: 'data corruption', systemContext: 'Microservices with postgres, redis, and api gateway' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'memory_vam', fn: () => send('tools/call', {
    name: 'memory_vam', arguments: { action: 'store', namespace: 'test', content: 'Test memory entry for VAM evaluation', key: 'vam-test' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'knowledge_evolve', fn: () => send('tools/call', {
    name: 'knowledge_evolve', arguments: { knowledgeBase: 'Artificial Intelligence Machine Learning Deep Learning Neural Networks are related fields. AI is the broadest category.', mode: 'gap' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'context_synth', fn: () => send('tools/call', {
    name: 'context_synth', arguments: { sources: JSON.stringify([{ id: 'src1', content: 'The system uses microservices architecture', type: 'doc' }, { id: 'src2', content: 'Each service runs independently with its own database', type: 'doc' }]), mode: 'summarize' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'code_archaeologist', fn: () => send('tools/call', {
    name: 'code_archaeologist', arguments: { code: 'function hello(name) { console.log("Hello, " + name); }\nfunction add(a,b) { return a + b; }', language: 'javascript', mode: 'full' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'sentiment_adapter', fn: () => send('tools/call', {
    name: 'sentiment_adapter', arguments: { text: 'This is absolutely fantastic and wonderful! The system works perfectly. I am very happy with the excellent results.', mode: 'full' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'consensus_engine', fn: () => send('tools/call', {
    name: 'consensus_engine', arguments: { proposal: 'Adopt new microservices architecture for the platform', model: 'weighted', stakeholders: 'Architect,Guardian,Executor,Strategist,Operator' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'execution_flow', fn: () => send('tools/call', {
    name: 'execution_flow', arguments: { process: 'Deploy a new microservice to production: build, test, containerize, deploy to staging, run integration tests, deploy to production, monitor', mode: 'full', granularity: 'medium' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'swarm_orchestrator', fn: () => send('tools/call', {
    name: 'swarm_orchestrator', arguments: { objective: 'Analyze system performance and recommend optimizations', mode: 'adaptive', agentCount: 4 },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'meta_orchestrator', fn: () => send('tools/call', {
    name: 'meta_orchestrator', arguments: { systemState: 'The orchestration system is processing 1000 requests per second with 99.9% uptime', depth: 2, focus: 'full' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'subagent_protocol', fn: () => send('tools/call', {
    name: 'subagent_protocol', arguments: { task: 'Design and implement a new authentication microservice', mode: 'semi-autonomous', subAgentCount: 3 },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'cognitive_reason', fn: () => send('tools/call', {
    name: 'cognitive_reason', arguments: { problem: 'All humans are mortal. Socrates is human. Is Socrates mortal?', mode: 'deductive' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'cognitive_research', fn: () => send('tools/call', {
    name: 'cognitive_research', arguments: { topic: 'Quantum computing applications', depth: 'quick' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },

  { id: 'cognitive_plan', fn: () => send('tools/call', {
    name: 'cognitive_plan', arguments: { objective: 'Build a web application', constraints: 'Must use React, 2 week timeline' },
  }).then(r => r.result?.content?.[0]?.text ? true : 'no response') },
];

async function run() {
  await waitForOutput('MCP server started');
  console.log('Kit started\n');

  const passed = [];
  const failed = [];

  for (const { id, fn } of tests) {
    try {
      const result = await fn();
      if (result === true) {
        passed.push(id);
        process.stdout.write(`  \u2713 ${id}\n`);
      } else {
        failed.push(id);
        process.stdout.write(`  \u2717 ${id} (${result})\n`);
      }
    } catch (err) {
      failed.push(id);
      process.stdout.write(`  \u2717 ${id} (error: ${err.message})\n`);
    }
  }

  console.log(`\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`);
  console.log(`RESULTS: ${passed.length}/${tests.length} passed`);
  if (failed.length > 0) console.log(`FAILED: ${failed.join(', ')}`);

  await send('shutdown', {});
  setTimeout(() => { kit.kill(); process.exit(failed.length > 0 ? 1 : 0); }, 500);
}

run();
