# Cursor Integration Guide

Connect Cognitive Kit to Cursor AI editor via MCP.

## Setup

### 1. Configure MCP in Cursor

1. Open Cursor Settings
2. Navigate to **Features → MCP**
3. Click **+ Add New MCP Server**

```
Name: cognitive-kit
Type: command
Command: npx cognitive-kit
```

4. Add environment variables (optional):

| Variable | Value |
|----------|-------|
| `KIT_HOST_ID` | `cursor-my-project` |
| `KIT_HOST_NAME` | `My Project` |
| `KIT_SOVEREIGN_KEY` | *(optional)* |

### 2. Verify

Run any tool from Cursor's MCP panel:

```
cognitive_reason({ problem: "Why is this function failing?" })
```

## Available Commands

Via Cursor's AI chat:

```
Analyze this code using cognitive_reason:
[code block]
```

```
Plan the implementation using cognitive_plan:
[requirements]
```

```
Check for security issues using security_gate:
[code/config]
```

```
Research this topic using cognitive_research:
[topic]
```

## Tips

- Use `agency_execute` for complex multi-step tasks
- Use `guardian_status` to monitor system health
- Use `code_archaeologist` for codebase analysis
- Use `consensus_engine` for architectural decisions
