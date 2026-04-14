# Security Policy

[中文](./SECURITY.md)

`claude-code-lite` is a local-first AI agent CLI reference implementation.
Because it can read/write files, run shell commands, fetch web pages, and persist sessions, the main security boundaries are:

- tool permissions
- shell command execution
- transcript / session storage
- provider API key handling

## Supported Scope

Security fixes are primarily expected for:

- the latest main branch
- capabilities explicitly described in the current README

Not covered:

- third-party tools you add yourself
- custom providers / custom MCP servers
- remote execution logic added in forks

## Reporting

If you found a security issue, do not open a public issue with full exploit details.

At minimum include:

- issue type
- affected area
- trigger conditions
- reproduction steps
- possible impact

Use normal bug reports for non-security issues.

## Current Security Boundaries

### Permission confirmation is not a sandbox

The current `allow / deny / ask` model is a runtime permission mechanism, not a system-level sandbox.

### Shell is inherently high-risk

The `Shell` tool is a local command execution entrypoint. Confirmation helps, but it does not make execution inherently safe.

### Transcripts are persisted

Conversation and tool results are written to:

- `.claude-code-lite/transcripts/`
- `.claude-code-lite/sessions/`

Sensitive content may therefore be persisted if a tool returns it.

### Provider keys come from environment variables

The current setup expects keys like:

- `CCL_LLM_API_KEY`

Do not put them into repository files, screenshots, exported transcripts, or issue threads.

## Practical Usage Advice

- keep risky tools in `ask` mode
- avoid blindly running shell actions in untrusted directories
- clean `.claude-code-lite/` regularly
- inspect exported transcripts before sharing them
- never commit real provider keys
