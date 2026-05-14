import type { HostAdapter } from '../HostAdapter.js';
import type { HostProfile, ToolDefinition, ToolResult, ToolContext, HostCapability } from '../../types.js';
import { access, readFile, writeFile, readdir, mkdir, unlink, stat } from 'node:fs/promises';
import { resolve, relative, basename, extname, dirname } from 'node:path';

export class FileSystemAdapter implements HostAdapter {
  private rootPath: string;
  private allowWrite: boolean;
  private allowDelete: boolean;

  constructor(rootPath?: string, options?: { allowWrite?: boolean; allowDelete?: boolean }) {
    this.rootPath = rootPath ?? process.env.KIT_FS_ROOT ?? process.cwd();
    this.allowWrite = options?.allowWrite ?? (process.env.KIT_FS_ALLOW_WRITE === 'true');
    this.allowDelete = options?.allowDelete ?? (process.env.KIT_FS_ALLOW_DELETE === 'true');
  }

  get profile(): HostProfile {
    return {
      type: 'cli',
      name: 'FileSystem Adapter',
      version: '1.0.0',
      capabilities: this.getCapabilities(),
      metadata: {
        rootPath: this.rootPath,
        allowWrite: String(this.allowWrite),
        allowDelete: String(this.allowDelete),
      },
    };
  }

  async initialize(): Promise<void> {
    try {
      await access(this.rootPath);
      console.error(`[fs-adapter] Root: ${this.rootPath} (write: ${this.allowWrite}, delete: ${this.allowDelete})`);
    } catch {
      console.error(`[fs-adapter] Warning: root path does not exist: ${this.rootPath}`);
    }
  }

  async shutdown(): Promise<void> {}

  getHostTools(): ToolDefinition[] {
    return [
      this.createReadTool(),
      this.createListTool(),
      this.createStatTool(),
      ...(this.allowWrite ? [this.createWriteTool()] : []),
      ...(this.allowDelete ? [this.createDeleteTool()] : []),
    ];
  }

  getCapabilities(): HostCapability[] {
    const caps: HostCapability[] = ['filesystem'];
    if (this.allowWrite) caps.push('filesystem');
    return caps;
  }

  private resolvePath(userPath: string): string {
    const resolved = resolve(this.rootPath, userPath);
    if (!resolved.startsWith(this.rootPath)) {
      throw new Error(`Path traversal detected: ${userPath} escapes root ${this.rootPath}`);
    }
    return resolved;
  }

  private createReadTool(): ToolDefinition {
    return {
      id: 'fs_read',
      name: 'Read File',
      description: 'Read the contents of a file. Returns text content and metadata.',
      inputSchema: { path: { type: 'string', description: 'File path relative to workspace root' } },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const userPath = String(params.path || '');
        if (!userPath) return { success: false, data: null, error: 'path is required' };
        try {
          const fullPath = this.resolvePath(userPath);
          const content = await readFile(fullPath, 'utf-8');
          const meta = await stat(fullPath);
          return {
            success: true,
            data: {
              path: userPath,
              fullPath,
              content,
              size: content.length,
              lines: content.split('\n').length,
              ext: extname(fullPath),
              modifiedAt: meta.mtime.toISOString(),
            },
          };
        } catch (err) {
          return { success: false, data: null, error: `Cannot read: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createWriteTool(): ToolDefinition {
    return {
      id: 'fs_write',
      name: 'Write File',
      description: 'Write content to a file. Creates directories if needed.',
      inputSchema: {
        path: { type: 'string', description: 'File path relative to workspace root' },
        content: { type: 'string', description: 'Content to write' },
      },
      sovereignty: 0.6,
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const userPath = String(params.path || '');
        const content = String(params.content || '');
        if (!userPath) return { success: false, data: null, error: 'path is required' };
        try {
          const fullPath = this.resolvePath(userPath);
          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, content, 'utf-8');
          return { success: true, data: { path: userPath, bytesWritten: Buffer.byteLength(content, 'utf-8') } };
        } catch (err) {
          return { success: false, data: null, error: `Cannot write: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createListTool(): ToolDefinition {
    return {
      id: 'fs_list',
      name: 'List Directory',
      description: 'List files and directories at a path. Shows names, types, and sizes.',
      inputSchema: { path: { type: 'string', description: 'Directory path (default: root)' } },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const userPath = String(params.path || '');
        const target = userPath ? this.resolvePath(userPath) : this.rootPath;
        try {
          const entries = await readdir(target, { withFileTypes: true });
          const items = await Promise.all(entries.map(async (entry) => {
            const fullPath = resolve(target, entry.name);
            try {
              const s = await stat(fullPath);
              return { name: entry.name, type: entry.isDirectory() ? 'dir' : 'file', size: s.size, modifiedAt: s.mtime.toISOString() };
            } catch {
              return { name: entry.name, type: entry.isDirectory() ? 'dir' : 'file', size: 0, modifiedAt: null };
            }
          }));
          return {
            success: true,
            data: { path: userPath || '.', fullPath: target, items, total: items.length },
          };
        } catch (err) {
          return { success: false, data: null, error: `Cannot list: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createStatTool(): ToolDefinition {
    return {
      id: 'fs_stat',
      name: 'File Stats',
      description: 'Get detailed information about a file or directory.',
      inputSchema: { path: { type: 'string', description: 'File or directory path' } },
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const userPath = String(params.path || '');
        if (!userPath) return { success: false, data: null, error: 'path is required' };
        try {
          const fullPath = this.resolvePath(userPath);
          const s = await stat(fullPath);
          return {
            success: true,
            data: {
              path: userPath, fullPath, size: s.size,
              isDirectory: s.isDirectory(), isFile: s.isFile(),
              created: s.birthtime.toISOString(), modified: s.mtime.toISOString(),
              permissions: s.mode.toString(8).slice(-3),
            },
          };
        } catch (err) {
          return { success: false, data: null, error: `Cannot stat: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }

  private createDeleteTool(): ToolDefinition {
    return {
      id: 'fs_delete',
      name: 'Delete File',
      description: 'Permanently delete a file. Use with caution.',
      inputSchema: { path: { type: 'string', description: 'File path to delete' } },
      sovereignty: 0.8,
      category: 'host',
      handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
        const userPath = String(params.path || '');
        if (!userPath) return { success: false, data: null, error: 'path is required' };
        try {
          const fullPath = this.resolvePath(userPath);
          await unlink(fullPath);
          return { success: true, data: { path: userPath, deleted: true } };
        } catch (err) {
          return { success: false, data: null, error: `Cannot delete: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    };
  }
}
