import type { HostAdapter } from '../HostAdapter.js';
import type { HostProfile, ToolDefinition, ToolResult, ToolContext } from '../../types.js';

export interface VSCodeAPI {
  workspace?: {
    name?: string;
    rootPath?: string;
    getConfiguration?(section: string): Record<string, unknown>;
  };
  editor?: {
    document?: {
      fileName?: string;
      languageId?: string;
      getText?(): string;
      lineCount?: number;
    };
    selection?: { text?: string };
  };
  commands?: {
    executeCommand?(command: string, ...args: unknown[]): Promise<unknown>;
  };
  environment?: {
    machineId?: string;
    sessionId?: string;
    appName?: string;
    appVersion?: string;
  };
  globalState?: {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Promise<void>;
  };
}

export class VSCodeAdapter implements HostAdapter {
  private api: VSCodeAPI;

  constructor(api: VSCodeAPI) {
    this.api = api;
  }

  get profile(): HostProfile {
    const env = this.api.environment ?? {};
    const ws = this.api.workspace ?? {};
    return {
      type: 'ide',
      name: env.appName ?? 'VS Code',
      version: env.appVersion ?? 'unknown',
      capabilities: this.getCapabilities(),
      metadata: {
        machineId: env.machineId ?? 'unknown',
        workspaceName: ws.name ?? 'untitled',
        rootPath: ws.rootPath ?? '',
        sessionId: env.sessionId ?? '',
      },
    };
  }

  async initialize(): Promise<void> {
    const ws = this.api.workspace;
    if (ws?.name) {
      console.error(`[cognitive-kit] Initialized for workspace: ${ws.name}`);
    }
    if (this.api.globalState) {
      const lastRun = this.api.globalState.get<string>('cognitive-kit:lastRun');
      console.error(`[cognitive-kit] Last run: ${lastRun ?? 'first time'}`);
      await this.api.globalState.update('cognitive-kit:lastRun', new Date().toISOString());
    }
  }

  async shutdown(): Promise<void> {
    console.error('[cognitive-kit] VSCodeAdapter shutting down');
  }

  getHostTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    if (this.api.workspace || this.api.editor) {
      tools.push(this.createReadFileTool());
      tools.push(this.createGetSelectionTool());
      tools.push(this.createGetWorkspaceInfoTool());
    }

    if (this.api.commands) {
      tools.push(this.createExecuteCommandTool());
    }

    return tools;
  }

  getCapabilities(): import('../../types.js').HostCapability[] {
    const caps: import('../../types.js').HostCapability[] = [];
    if (this.api.workspace) caps.push('filesystem');
    if (this.api.editor) caps.push('editor');
    if (this.api.commands) caps.push('terminal');
    return caps;
  }

  private createReadFileTool(): ToolDefinition {
    return {
      id: 'vscode_read_file',
      name: 'Read File (VS Code)',
      description: 'Read the contents of a file in the current VS Code workspace',
      inputSchema: {
        filePath: { type: 'string', description: 'Relative or absolute file path' },
      },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const filePath = String(params.filePath || '');
        if (!filePath) {
          return { success: false, data: null, error: 'filePath is required' };
        }
        const root = this.api.workspace?.rootPath ?? '';
        const fullPath = filePath.startsWith('/') || filePath.includes(':')
          ? filePath
          : `${root}/${filePath}`;

        try {
          const fs = await import('node:fs/promises');
          const content = await fs.readFile(fullPath, 'utf-8');
          return {
            success: true,
            data: { filePath, content, size: content.length },
            metadata: { path: fullPath },
          };
        } catch (err) {
          return { success: false, data: null, error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createGetSelectionTool(): ToolDefinition {
    return {
      id: 'vscode_get_selection',
      name: 'Get Editor Selection (VS Code)',
      description: 'Get the currently selected text in the VS Code editor',
      inputSchema: {},
      category: 'host',
      handler: async (_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const ed = this.api.editor;
        if (!ed?.document) {
          return { success: false, data: null, error: 'No active editor' };
        }
        const text = ed.selection?.text ?? ed.document.getText?.() ?? '';
        return {
          success: true,
          data: {
            text,
            fileName: ed.document.fileName,
            language: ed.document.languageId,
            lineCount: ed.document.lineCount,
          },
        };
      },
    };
  }

  private createGetWorkspaceInfoTool(): ToolDefinition {
    return {
      id: 'vscode_workspace_info',
      name: 'Workspace Info (VS Code)',
      description: 'Get information about the current VS Code workspace',
      inputSchema: {},
      category: 'host',
      handler: async (_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        return {
          success: true,
          data: this.profile,
        };
      },
    };
  }

  private createExecuteCommandTool(): ToolDefinition {
    return {
      id: 'vscode_execute_command',
      name: 'Execute Command (VS Code)',
      description: 'Execute a VS Code command',
      inputSchema: {
        command: { type: 'string', description: 'VS Code command ID' },
        args: { type: 'array', description: 'Command arguments' },
      },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const command = String(params.command || '');
        const args = Array.isArray(params.args) ? params.args : [];
        if (!command || !this.api.commands?.executeCommand) {
          return { success: false, data: null, error: 'Command execution not available' };
        }
        try {
          const result = await this.api.commands.executeCommand(command, ...args);
          return { success: true, data: result ?? { executed: command } };
        } catch (err) {
          return { success: false, data: null, error: `Command failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }
}
