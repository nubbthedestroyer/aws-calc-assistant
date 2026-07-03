# Requirements: Portable Dual-Platform AWS Calculator (Kiro Power + Claude Code)

## Goal

Restructure this repository into a self-contained, distributable package that works as both a **Kiro Power** and a **Claude Code skill + MCP server**. Anyone in the organization should be able to point either Kiro or Claude Code at this GitHub repo and have the agent install and configure everything — MCP server, workflow instructions, and documentation — without needing Docker, npm publish, or being inside a specific workspace.

## Functional Requirements

### FR-1: Single-file bundled MCP server
The MCP server (`server/index.js` + dependencies) must be bundled into a single JavaScript file with zero external dependencies. A user only needs Node.js >= 18 to run it. No `npm install` required after cloning.

### FR-2: Kiro Power structure
The repo must follow the Kiro Power format:
- `POWER.md` — onboarding instructions, tool documentation, and steering file triggers
- `mcp.json` — MCP server configuration that works relative to the power's install location
- `steering/` — workflow guidance and best practices files

### FR-3: Claude Code compatibility
The repo must simultaneously work as a Claude Code project with:
- `.mcp.json` — project-scope MCP server config (Claude Code discovers this automatically when opened in the repo)
- `CLAUDE.md` — project instructions that Claude Code reads at session start (equivalent to Kiro's POWER.md + steering, but in Claude's format)
- `.claude/skills/aws-calculator/SKILL.md` — a Claude Code skill file with YAML frontmatter (`name`, `description`) so Claude can auto-invoke the skill when relevant
- `.claude/commands/estimate.md` — a slash command (`/estimate`) for quick estimate building

### FR-4: Global installability (Kiro)
The README must contain clear instructions that Kiro (or a user following Kiro's guidance) can execute to:
1. Clone the repo into `~/.kiro/powers/`
2. Register the MCP server in `~/.kiro/settings/mcp.json`
3. Verify the server starts correctly

The instructions should be automatable by Kiro from any workspace directory.

### FR-5: Global installability (Claude Code)
The README must contain instructions for Claude Code users to:
1. Clone the repo to a known location
2. Register the MCP server globally via `claude mcp add` (user scope) or point to the bundled server
3. Optionally copy the skill to `~/.claude/skills/` for global availability

Alternatively, for project-scope use, simply cloning the repo and opening it in Claude Code should auto-discover the `.mcp.json` and skill.

### FR-6: Cross-platform support
The install process must work on macOS and Linux. Windows support via WSL is acceptable. No platform-specific scripts required beyond what's in the README.

### FR-7: Remove legacy distribution cruft
The following legacy/single-platform files are replaced by the new dual-platform structure:
- `.claude-plugin/plugin.json` → replaced by `.claude/skills/` and `.mcp.json`
- `commands/estimate.md` (old location) → moved to `.claude/commands/estimate.md`
- `AGENT.md` → replaced by `CLAUDE.md`
- `setup.ps1` → removed (README provides instructions)
- `skills/aws-calculator-estimates/` (old Kiro skill format) → content absorbed into steering files and Claude skill

### FR-8: README as install manual for both platforms
The README must be structured so that either Kiro or Claude Code can parse it and execute installation steps autonomously:
- Clearly separated sections for Kiro vs Claude Code installation
- Steps are concrete shell commands (not prose)
- File paths use standard conventions (`~/.kiro/` and `~/.claude/`)
- MCP server registration JSON is copy-pasteable for both platforms

### FR-9: Steering/instruction files are self-sufficient
The workflow instruction files (steering for Kiro, CLAUDE.md + skill for Claude Code) must contain all knowledge needed to use the MCP tools correctly — service codes, input patterns, group structure requirements, MAP best practices, known limitations. No external dependencies on other instruction files.

### FR-10: Build script for bundling
Include a build script (e.g., `build.sh` or npm script) that developers use to regenerate the bundled server file from source. The source (`server/index.js`) and the bundle (`dist/server.mjs`) both live in the repo — the bundle is committed so consumers never need to build.

### FR-11: Shared MCP server
Both Kiro and Claude Code must use the same bundled server (`dist/server.mjs`). There is one server implementation that both platforms consume — no forking or platform-specific builds.

## Non-Functional Requirements

### NFR-1: Bundle size
The bundled server file should be under 500KB. The current server is ~1000 lines; with the MCP SDK and Zod inlined, this should be achievable.

### NFR-2: No network dependencies at install time
Installing should not require any network calls beyond `git clone`. All runtime dependencies are baked into the bundle.

### NFR-3: Update path
Users update by running `git pull` in their installed directory. The README should document this for both platforms.

### NFR-4: Server test
The bundled server must pass the existing test suite (`server/index.test.js`) to ensure bundling didn't break anything.

### NFR-5: No content duplication drift
The CLAUDE.md/skill content and the Kiro steering/POWER.md content cover the same domain knowledge. The source of truth for workflow instructions is the steering files; CLAUDE.md and the Claude skill should reference or mirror this content. Document in a development note which files need to stay in sync.
