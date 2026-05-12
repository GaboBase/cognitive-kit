import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: { code: number; message: string };
}

let kitProcess: ChildProcess | null = null;
let pendingRequests = new Map<string | number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let rl: ReturnType<typeof createInterface> | null = null;
let requestId = 0;
let ready = false;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

function getKitPath(): string {
  const config = vscode.workspace.getConfiguration('cognitive-kit');
  const customPath = config.get<string>('cliPath');
  if (customPath) return customPath;
  const dir = dirname(fileURLToPath(import.meta.url));
  return resolve(dir, '..', '..', '..', 'packages', 'cognitive-kit', 'dist', 'cli.js');
}

async function startKit(): Promise<void> {
  if (kitProcess) return;

  outputChannel.appendLine('[cognitive-kit] Starting kit process...');
  statusBarItem.text = '$(loading~spin) Cognitive Kit: starting...';
  statusBarItem.tooltip = 'Starting cognitive kit process';

  const kitPath = getKitPath();
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  const env = {
    ...process.env,
    KIT_HOST_ID: vscode.env.machineId,
    KIT_HOST_NAME: vscode.workspace.name || 'untitled',
    KIT_WORKSPACE_ROOT: wsRoot,
    KIT_SOVEREIGN_KEY: vscode.workspace.getConfiguration('cognitive-kit').get<string>('sovereignKey') || '',
  };

  kitProcess = spawn('node', [kitPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: wsRoot || undefined,
  });

  rl = createInterface({
    input: kitProcess.stdout!,
    crlfDelay: Infinity,
  });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg: MCPResponse = JSON.parse(trimmed);
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id)!;
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    } catch {
      outputChannel.appendLine(`[cognitive-kit] Non-JSON output: ${trimmed}`);
    }
  });

  kitProcess.stderr?.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  kitProcess.on('exit', (code) => {
    outputChannel.appendLine(`[cognitive-kit] Process exited with code ${code}`);
    kitProcess = null;
    rl = null;
    pendingRequests.forEach(p => p.reject(new Error('Kit process exited')));
    pendingRequests.clear();
    ready = false;
    statusBarItem.text = '$(circle-slash) Cognitive Kit: stopped';
    statusBarItem.tooltip = 'Cognitive kit process exited';
  });

  kitProcess.on('error', (err) => {
    outputChannel.appendLine(`[cognitive-kit] Process error: ${err.message}`);
  });

  await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cognitive-kit-vscode', version: '1.0.0-alpha' },
  });

  ready = true;
  statusBarItem.text = '$(circuit-board) Cognitive Kit: ready';
  statusBarItem.tooltip = `Cognitive kit running for ${vscode.workspace.name || 'untitled'}`;
  outputChannel.appendLine('[cognitive-kit] Kit initialized successfully');
}

async function stopKit(): Promise<void> {
  if (!kitProcess) return;
  outputChannel.appendLine('[cognitive-kit] Stopping kit...');
  try {
    await sendRequest('shutdown', {});
  } catch {}
  kitProcess.kill();
  kitProcess = null;
  rl = null;
  ready = false;
  statusBarItem.text = '$(circle-slash) Cognitive Kit: stopped';
  statusBarItem.tooltip = 'Cognitive kit is stopped';
}

function sendRequest(method: string, params?: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!kitProcess || !kitProcess.stdin?.writable) {
      reject(new Error('Kit process not running'));
      return;
    }
    const id = ++requestId;
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    pendingRequests.set(id, { resolve, reject });
    kitProcess.stdin.write(msg + '\n');
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timed out'));
      }
    }, 30000);
  });
}

async function listTools(): Promise<any[]> {
  const result = await sendRequest('tools/list', {});
  return result?.tools ?? [];
}

async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  return sendRequest('tools/call', { name, arguments: args });
}

async function analyzeSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }
  const selection = editor.document.getText(editor.selection) || editor.document.getText();
  if (!selection) {
    vscode.window.showWarningMessage('No text selected or document is empty');
    return;
  }

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Cognitive Kit: Analyzing...',
    cancellable: true,
  }, async (progress, token) => {
    progress.report({ message: 'Applying reasoning...' });

    const context = {
      fileName: editor.document.fileName,
      language: editor.document.languageId,
      selectionLength: selection.length,
    };

    const result = await callTool('cognitive_reason', {
      problem: 'Analyze this content and provide insights',
      context: `Content (${editor.document.languageId}):\n${selection.slice(0, 8000)}`,
      mode: 'logical',
    });

    if (token.isCancellationRequested) return;

    const panel = vscode.window.createWebviewPanel(
      'cognitiveKitAnalysis',
      'Cognitive Analysis',
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );

    const content = result?.content?.[0]?.text ?? JSON.stringify(result, null, 2);
    panel.webview.html = renderAnalysisHTML(content, context, result?.meta);
  });
}

function renderAnalysisHTML(content: string, context: any, meta?: any): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body { font-family: var(--vscode-editor-font-family); padding: 16px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
pre { background: var(--vscode-textBlockQuote-background); padding: 12px; border-radius: 4px; overflow-x: auto; }
.meta { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-top: 16px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
</style></head><body>
<h2>🧠 Cognitive Analysis</h2>
<p><span class="badge">${context.language}</span> <span class="badge">${context.fileName.split('/').pop() || context.fileName.split('\\\\').pop()}</span></p>
<pre>${escapeHtml(content)}</pre>
${meta ? `<div class="meta">${JSON.stringify(meta, null, 2)}</div>` : ''}
</body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function reflectOnWorkspace() {
  const wsName = vscode.workspace.name || 'unnamed';
  const fileCount = (await vscode.workspace.findFiles('**/*', '**/node_modules/**')).length;

  const result = await callTool('cognitive_reflect', {
    context: `Workspace: ${wsName}. Files: ${fileCount}. Mode: analyze`,
    mode: 'analyze',
  });

  const content = result?.content?.[0]?.text ?? JSON.stringify(result, null, 2);
  vscode.window.showInformationMessage(`Reflection: ${content.slice(0, 200)}...`);
  outputChannel.appendLine(`[cognitive-kit] Reflection:\n${content}`);
}

async function showStatus() {
  if (!kitProcess || !ready) {
    vscode.window.showWarningMessage('Cognitive Kit is not running');
    return;
  }
  try {
    const tools = await listTools();
    const ping = await sendRequest('ping', {});
    vscode.window.showInformationMessage(
      `Cognitive Kit: ${tools.length} tools available | Status: ${ping?.status}`,
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Cognitive Kit error: ${err.message}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Cognitive Kit');

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(circuit-board) Cognitive Kit: idle';
  statusBarItem.command = 'cognitive-kit.status';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('cognitive-kit.start', startKit),
    vscode.commands.registerCommand('cognitive-kit.stop', stopKit),
    vscode.commands.registerCommand('cognitive-kit.status', showStatus),
    vscode.commands.registerCommand('cognitive-kit.analyzeSelection', analyzeSelection),
    vscode.commands.registerCommand('cognitive-kit.reflectOnWorkspace', reflectOnWorkspace),
  );

  context.subscriptions.push({ dispose: stopKit });

  outputChannel.appendLine('[cognitive-kit] Extension activated');
  startKit().catch(err => {
    outputChannel.appendLine(`[cognitive-kit] Auto-start failed: ${err.message}`);
    statusBarItem.text = '$(error) Cognitive Kit: error';
    statusBarItem.tooltip = err.message;
  });
}

export function deactivate() {
  stopKit();
}
