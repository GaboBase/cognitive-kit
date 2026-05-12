import type { HostProfile, ToolDefinition, HostCapability } from '../types.js';

export interface HostAdapter {
  readonly profile: HostProfile;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getHostTools(): ToolDefinition[];
  getCapabilities(): HostCapability[];
}
