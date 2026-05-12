import type { KitConfig, HostProfile, StorageConfig, TransportConfig, SovereigntyConfig, ToolDefinition } from '../types.js';

interface ResolvedConfig {
  host: KitConfig['host'];
  storage: StorageConfig;
  sovereignty: SovereigntyConfig;
  transport: TransportConfig;
  tools: { autoLoad: boolean; additional: ToolDefinition[] };
  logging: { level: string; silent: boolean };
}

export class ConfigurationManager {
  private config: ResolvedConfig;
  private envCache: Record<string, string | undefined> = {};

  constructor(config: KitConfig) {
    this.config = this.resolve(config);
  }

  private resolve(config: KitConfig): ResolvedConfig {
    return {
      host: config.host,
      storage: this.resolveStorage(config.storage),
      sovereignty: this.resolveSovereignty(config.sovereignty),
      transport: this.resolveTransport(config.transport),
      tools: {
        autoLoad: config.tools?.autoLoad ?? true,
        additional: config.tools?.additional ?? [],
      },
      logging: {
        level: config.logging?.level ?? 'info',
        silent: config.logging?.silent ?? false,
      },
    };
  }

  private resolveStorage(storage?: StorageConfig): StorageConfig {
    if (storage) return storage;
    return { type: 'memory' };
  }

  private resolveSovereignty(sovereignty?: SovereigntyConfig): SovereigntyConfig {
    if (sovereignty) return sovereignty;
    return {
      hostId: process.env.KIT_HOST_ID || 'unknown-host',
      hostName: process.env.KIT_HOST_NAME || 'Unknown',
    };
  }

  private resolveTransport(transport?: TransportConfig): TransportConfig {
    if (transport) return transport;
    return { type: 'stdio' };
  }

  get host(): KitConfig['host'] {
    return this.config.host;
  }

  get storage(): StorageConfig {
    return this.config.storage;
  }

  get sovereignty(): SovereigntyConfig {
    return this.config.sovereignty;
  }

  get transport(): TransportConfig {
    return this.config.transport;
  }

  get toolsConfig(): { autoLoad: boolean; additional: ToolDefinition[] } {
    return this.config.tools;
  }

  get logging(): { level: string; silent: boolean } {
    return this.config.logging;
  }

  env(key: string, fallback?: string): string | undefined {
    if (this.envCache[key] === undefined) {
      this.envCache[key] = process.env[key] ?? fallback;
    }
    return this.envCache[key];
  }

  toJSON(): Record<string, unknown> {
    return {
      storage: this.storage,
      transport: this.transport,
      sovereignty: this.sovereignty,
      logging: this.logging,
    };
  }
}
