# VS Code Integration Guide

Connect Cognitive Kit to VS Code via MCP for inline reasoning, code analysis, planning, and security auditing.

## Setup

### 1. Install the Kit

```bash
npm install -g cognitive-kit
```

### 2. Configure MCP

Create or edit `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "cognitive-kit": {
      "type": "stdio",
      "command": "npx",
      "args": ["cognitive-kit"],
      "env": {
        "KIT_HOST_ID": "vscode-${workspaceFolderBasename}",
        "KIT_HOST_NAME": "${workspaceFolderBasename}"
      }
    }
  }
}
```

### 3. Restart VS Code

The kit starts automatically. You can now use all 31 tools from the VS Code MCP interface.

## VS Code Extension

Alternatively, install the VS Code extension (if published):

```bash
code --install-extension cognitive-kit-vscode
```

The extension provides:

- **`Cognitive Kit: Analyze Selection`** — Runs reasoning on selected code/text
- **`Cognitive Kit: Reflect on Workspace`** — Meta-reflection on project state
- **`Cognitive Kit: Show Status`** — Guardian metrics and tool counts

## Example Workflows

### Code Review

1. Select a block of code
2. Run `Cognitive Kit: Analyze Selection`
3. The kit applies `cognitive_reason` for logical analysis
4. Results appear in a new editor panel

### Security Audit

Via MCP, call:

```
security_gate(payload: "the code to inspect")
ethics_audit(subject: "implementation decision")
threat_mapper(systemDescription: "architecture overview")
```

### Project Planning

```
agency_execute(objective: "Design authentication module", mode: "adaptive")
```

## Requirements

- VS Code ≥ 1.96
- Node.js ≥ 20
- Internet for first `npx` run
