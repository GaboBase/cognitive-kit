# Example: Custom Host Adapter

Create a custom adapter to integrate Cognitive Kit with any system.

```typescript
import { CognitiveKit, type HostAdapter, type HostProfile, type ToolDefinition, type ToolResult, type ToolContext, type HostCapability } from 'cognitive-kit';

class MyAPIAdapter implements HostAdapter {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get profile(): HostProfile {
    return {
      type: 'api',
      name: 'My API Adapter',
      version: '1.0.0',
      capabilities: this.getCapabilities(),
      metadata: { baseUrl: this.baseUrl },
    };
  }

  async initialize(): Promise<void> {
    console.error(`[my-adapter] Connected to ${this.baseUrl}`);
  }

  async shutdown(): Promise<void> {
    console.error('[my-adapter] Disconnected');
  }

  getHostTools(): ToolDefinition[] {
    return [
      {
        id: 'my_api_call',
        name: 'My API Call',
        description: 'Call an endpoint on My API',
        inputSchema: {
          endpoint: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST'] },
          body: { type: 'object' },
        },
        category: 'host',
        handler: async (params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> => {
          const endpoint = String(params.endpoint || '');
          const method = String(params.method || 'GET');
          try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
              method,
              headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
              body: method === 'POST' ? JSON.stringify(params.body || {}) : undefined,
            });
            const data = await response.json();
            return { success: response.ok, data, error: response.ok ? undefined : data.error };
          } catch (err) {
            return { success: false, data: null, error: `API call failed: ${err instanceof Error ? err.message : String(err)}` };
          }
        },
      },
    ];
  }

  getCapabilities(): HostCapability[] {
    return ['network'];
  }
}

// Use it
const kit = new CognitiveKit({
  host: new MyAPIAdapter('sk-...', 'https://api.example.com'),
  transport: { type: 'stdio' },
});

await kit.start();
// Now has all cognitive tools + my_api_call
```
