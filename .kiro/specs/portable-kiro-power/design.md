# Design: Portable Dual-Platform AWS Calculator (Kiro Power + Claude Code)

## Final Repository Structure

```
aws-calculator-power/
├── README.md                              # Dual-platform install manual
├── POWER.md                               # Kiro Power metadata + onboarding
├── CLAUDE.md                              # Claude Code project instructions
├── mcp.json                               # Kiro MCP server config
├── .mcp.json                              # Claude Code project-scope MCP config
├── steering/                              # Kiro steering files
│   ├── aws-calculator-workflow.md
│   └── map-estimate-best-practices.md
├── .claude/                               # Claude Code skills + commands
│   ├── skills/
│   │   └── aws-calculator/
│   │       └── SKILL.md                   # Auto-invocable Claude skill
│   └── commands/
│       └── estimate.md                    # /estimate slash command
├── dist/
│   └── server.mjs                         # Bundled single-file MCP server (committed)
├── server/                                # Source (for development/maintenance)
│   ├── index.js
│   ├── index.test.js
│   ├── package.json
│   └── package-lock.json
├── build.sh                               # Bundles server/ → dist/server.mjs
├── Dockerfile                             # Optional: Docker-based server
└── .gitignore
```

## Key Design Decisions

### D1: Bundled server in `dist/server.mjs`

Use `esbuild` to bundle `server/index.js` + all `node_modules` into a single ESM file. This eliminates the need for `npm install` on the consumer side.

- Target: `node18` (matches the engines requirement)
- Format: `esm` (the server uses `import` syntax and `import.meta.url`)
- Platform: `node`
- Bundle: `true` (inline all dependencies)
- External: none (everything gets inlined)

The `import.meta.url === \`file://${process.argv[1]}\`` guard at the bottom of index.js will still work in the bundle since esbuild preserves `import.meta.url`.

### D2: Dual MCP config files

**`mcp.json`** (Kiro Power format):
```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["./dist/server.mjs"]
    }
  }
}
```

**`.mcp.json`** (Claude Code project-scope format):
```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["./dist/server.mjs"]
    }
  }
}
```

These are identical in content but serve different platforms. Kiro reads `mcp.json`, Claude Code reads `.mcp.json`. Both use relative paths that resolve when the tool is run from the repo root.

For global installation, the README provides the absolute path version that users paste into their platform's global config.

### D3: CLAUDE.md — Claude Code project instructions

`CLAUDE.md` is read by Claude Code at session start. It serves the same role as POWER.md + steering files combined, but in Claude's format. Content includes:

- What this repo is (1-2 sentences)
- Available MCP tools and their purpose
- Core workflow (configure → create)
- Common service codes
- Group structure requirement
- MAP estimate best practices (condensed)
- Known limitations
- Pointer to the skill for detailed instructions

Kept under 200 lines per Claude Code best practices — enough to orient the agent but not so much it gets filtered.

### D4: Claude Code skill (`.claude/skills/aws-calculator/SKILL.md`)

YAML frontmatter triggers autonomous invocation:

```yaml
---
name: aws-calculator
description: Build shareable AWS Pricing Calculator estimates with grouped services, real-time pricing, and MAP funding best practices. Use when asked to create AWS cost estimates, MAP estimates, or calculator.aws links.
---
```

The skill body contains the full detailed workflow — equivalent to the Kiro steering file `aws-calculator-workflow.md`. Claude loads this on-demand when the task matches the description.

### D5: Claude Code slash command (`.claude/commands/estimate.md`)

```yaml
---
description: Build an AWS Pricing Calculator estimate from a description of infrastructure. Returns a shareable calculator.aws link.
argument-hint: describe the infrastructure to estimate
---
```

Invoked as `/estimate 4 m6i.2xlarge EC2 instances in us-east-1 for production`. This is the quick-entry-point equivalent.

### D6: README structure for dual-platform consumption

```markdown
# AWS Calculator Power

One-line description.

## Prerequisites
- Node.js >= 18

## Install for Kiro

### Option A: Global Power (use from any workspace)
[exact commands for clone + mcp.json registration]

### Option B: Workspace Power (use in one project)
[exact commands for .kiro/settings setup]

## Install for Claude Code

### Option A: Project scope (auto-discovered)
[clone, cd into it, run claude — .mcp.json auto-loads]

### Option B: Global scope (use from anywhere)
[claude mcp add command with absolute path]

### Option C: Skill only (no local clone needed)
[copy skill to ~/.claude/skills/]

## Verify Installation
[test command that works for both]

## Update
git pull

## Uninstall
[platform-specific removal steps]

## Development
[how to modify server and rebuild]
```

### D7: Kiro steering files remain the source of truth

The content hierarchy:
- **`steering/aws-calculator-workflow.md`** — canonical workflow reference (most detailed)
- **`steering/map-estimate-best-practices.md`** — canonical MAP reference
- **`CLAUDE.md`** — condensed version of both for Claude Code (session-start context)
- **`.claude/skills/aws-calculator/SKILL.md`** — workflow detail for on-demand loading (mirrors steering/aws-calculator-workflow.md)
- **`POWER.md`** — Kiro onboarding (lighter, points to steering files)

When updating domain knowledge, update the steering files first, then sync CLAUDE.md and the skill.

### D8: What gets deleted vs transformed

| Current file | Action |
|---|---|
| `setup.ps1` | Delete |
| `.claude-plugin/plugin.json` | Delete (replaced by `.mcp.json` + `.claude/skills/`) |
| `commands/estimate.md` | Move to `.claude/commands/estimate.md` (update format) |
| `AGENT.md` | Delete (content → `CLAUDE.md`) |
| `skills/aws-calculator-estimates/SKILL.md` | Content → `.claude/skills/aws-calculator/SKILL.md` + steering |
| `skills/aws-calculator-estimates/mcp-client-template.mjs` | Keep in repo root or `examples/` for scripting use |
| `power-aws-calculator/POWER.md` | Move to repo root `POWER.md` |
| `power-aws-calculator/mcp.json` | Move to repo root `mcp.json` (update content) |
| `power-aws-calculator/steering/` | Move to repo root `steering/` |
| `.kiro/agents/aws-calculator.json` | Delete (not needed for a power) |
| `.kiro/settings/mcp.json` | Delete (workspace-level, replaced by root `mcp.json`) |
| `README.md` | Rewrite completely |
| `Dockerfile` | Keep (alternative install method) |

### D9: .gitignore

```
node_modules/
.DS_Store
```

`dist/` is NOT gitignored — committed as the distributable artifact.
`.claude/` is NOT gitignored — it's part of the distribution.

### D10: Build process

`build.sh`:
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

# Install dev dependencies (esbuild) if needed
if [ ! -f server/node_modules/.bin/esbuild ]; then
  echo "Installing build dependencies..."
  cd server && npm install && cd ..
fi

# Bundle
mkdir -p dist
npx --prefix server esbuild server/index.js \
  --bundle \
  --platform=node \
  --target=node18 \
  --format=esm \
  --outfile=dist/server.mjs \
  --banner:js='#!/usr/bin/env node'

chmod +x dist/server.mjs
echo "Built dist/server.mjs ($(wc -c < dist/server.mjs | tr -d ' ') bytes)"
```

Add esbuild as a dev dependency in `server/package.json`.

## Testing Strategy

1. Run `build.sh` to produce `dist/server.mjs`
2. Run existing tests: `cd server && node --test index.test.js`
3. Verify bundle directly: pipe MCP initialize + tools/list to `dist/server.mjs`
4. Simulate Kiro install: clone to temp `~/.kiro/powers/` path, verify MCP responds
5. Simulate Claude Code install: verify `.mcp.json` is discovered when running from repo directory
6. Docker still works: `docker build -t aws-calculator-mcp . && echo '...' | docker run --rm -i aws-calculator-mcp`
