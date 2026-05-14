# Security Analysis — `cognitive-kit`

**Package**: `cognitive-kit@1.0.0-alpha.4`
**Audit Date**: 2026-05-12
**Status**: ✅ Clean (0 vulnerabilities)

---

## Dependency Audit

| Tool | Result |
|------|--------|
| `npm audit` | 0 vulnerabilities |
| `sql.js` (WASM) | Pure WASM, no native code execution |
| `pg` (optional) | Optional, only loaded when PostgresAdapter is configured |

## Supply Chain Security

- **Single dependency**: `sql.js` — SQLite compiled to WebAssembly. Deterministic builds, no native bindings.
- **Zero native modules**: No `node-gyp` compilation required. No `better-sqlite3`, no `bcrypt`, no native deps.
- **Optional dependency**: `pg` — Only installed when PostgreSQL functionality is needed.
- **No network calls at runtime**: The kit does not phone home, send telemetry, or download code at runtime. Federation requires explicit user configuration.

## Code Security Review

### Static Analysis Results

| Pattern | Status |
|---------|--------|
| `eval()` calls | ❌ None found |
| `child_process` usage | ❌ None found |
| Dynamic `require()` | ❌ None found |
| Template injection in SQL | ❌ All queries parameterized |
| Path traversal (FileSystemAdapter) | ✅ Fixed — resolved path must start with root |
| SQL injection (PostgresAdapter) | ✅ Parameterized queries + SELECT-only enforced |
| SQL injection (SQLiteProvider) | ✅ All inputs parameterized |
| Secret leakage | ✅ FW-003 blocks API keys, tokens, secrets |

### Guardian Gate Protections (Per-Tool-Call)

Every tool call passes through these checks in order:

```
1. Rate Limit      → 300 calls/minute default
2. State Check     → Is system frozen?
3. Sovereignty     → Does caller have sufficient weight?
4. Firewall        → 8 rules (block/flag/log)
5. Tool Execution  → Delegated with reduced sovereignty
6. Audit           → Recorded in sovereignty ledger
```

### Firewall Rules

| ID | Pattern | Severity | Bypass Risk |
|----|---------|----------|-------------|
| FW-001 | System commands (`rm -rf`, `format`, `shutdown`) | `block` | Low |
| FW-002 | Path escape (`../../`, encoded variants) | `block` | Low (regex validated) |
| FW-003 | Secrets (`sk-...`, `ghp_...`, `AKIA...`) | `block` | Low |
| FW-004 | Mass data (`SELECT *`, `DROP TABLE`) | `flag` | Low |
| FW-005 | Privilege escalation (`chmod 777`, `sudo`) | `block` | Low |
| FW-006 | Recon tools (`nmap`, `sqlmap`) | `flag` | Medium (case-insensitive) |
| FW-007 | Crypto ops (`openssl enc`) | `flag` | Medium (legitimate use) |
| FW-008 | Code exec (`eval(`, `exec(`, `system(`) | `block` | Low |

## Residual Risks

### 1. PostgresAdapter — Write Operations (Medium)

The `pg_query` tool only allows SELECT statements. However, if the connected PostgreSQL user has write permissions on sequences or functions, SELECT-based exploits (e.g., `SELECT nextval('seq')`, `SELECT func_with_side_effects()`) could mutate state.

**Mitigation**: Connect with a read-only PostgreSQL user when using `pg_query`.

### 2. FileSystemAdapter — Write/Delete (Medium)

Write and delete operations are disabled by default (`allowWrite: false`, `allowDelete: false`). If enabled, path traversal is blocked by `resolve()` + prefix check. However, symbolic links within the root could escape.

**Mitigation**: Avoid enabling `allowDelete` in production. Use a dedicated root directory without symlinks.

### 3. Rate Limiting — In-Memory Only (Low)

Rate limit counters are per-process and reset on restart. Distributed denial-of-service across multiple kit instances is not prevented.

**Mitigation**: Deploy behind a reverse proxy (nginx) for cross-instance rate limiting.

### 4. Federation — No Transport Encryption (Medium)

Federation uses plain HTTP (no TLS by default). Sensitive data in tool parameters and results could be intercepted.

**Mitigation**: Configure `KIT_FEDERATION_PORT` behind a TLS-terminating reverse proxy. Use `https://` URLs in production.

## Recommendations

```env
# Production-hardened configuration
KIT_FS_ALLOW_WRITE=false
KIT_FS_ALLOW_DELETE=false
KIT_PG_CONNECTION=postgres://readonly_user:...@host/db
KIT_FEDERATION_PORT=4200           # Behind TLS proxy
```

## Running Your Own Audit

```bash
cd cognitive-kit
npm audit           # Dependency scan
npm test            # Integration tests (33/33)
```

## Related

- [Guardian Gate Architecture](../src/security/GuardianGate.ts)
- [Synaptic Firewall Rules](../src/security/SynapticFirewall.ts)
- [Sovereignty Manager](../src/security/SovereigntyManager.ts)
- [Antigravity Integration Guide](./guides/antigravity-integration.md)
