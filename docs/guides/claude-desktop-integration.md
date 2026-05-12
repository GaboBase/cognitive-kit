# Claude Desktop Integration Guide

Connect Cognitive Kit to Claude Desktop as an MCP tool server.

## Setup

### 1. Install the Kit

```bash
npm install -g cognitive-kit
```

### 2. Configure Claude Desktop

Edit `claude_desktop_config.json` (located at `~/Library/Application Support/Claude/` on macOS, `%APPDATA%/Claude/` on Windows):

```json
{
  "mcpServers": {
    "cognitive-kit": {
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_HOST_ID": "claude-desktop",
        "KIT_HOST_NAME": "Claude Desktop",
        "KIT_SOVEREIGN_KEY": ""
      }
    }
  }
}
```

### 3. Restart Claude Desktop

The kit's 31 tools become available to Claude.

## Using with Claude

Claude can now invoke cognitive tools directly in conversation:

```
User: "Analyze this business strategy using multiple frameworks"
Claude: [calls cognitive_research, ethics_audit, consensus_engine]
```

### Example Prompts

**Strategic Planning:**
```
Use agency_execute to plan the Q2 product roadmap
with mode: "sequential" and include all 8 phases
```

**Code Review:**
```
Run code_archaeologist on my project's main module
and then apply cognitive_reason to identify improvements
```

**Security Assessment:**
```
Execute threat_mapper on our architecture,
then red_team for adversarial simulation,
then guardian_status to verify protections
```

## Notes

- Claude Desktop passes tool results back to the conversation
- The kit runs as a child process — Claude handles lifecycle
- Use `guardian_freeze` if you need to pause operations
