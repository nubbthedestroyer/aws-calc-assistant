# Tasks: Portable Dual-Platform AWS Calculator (Kiro Power + Claude Code)

## Task 1: Set up the build pipeline
- [ ] Add `esbuild` as a dev dependency in `server/package.json`
- [ ] Create `build.sh` at repo root that bundles `server/index.js` → `dist/server.mjs`
- [ ] Run the build and verify `dist/server.mjs` is produced
- [ ] Test the bundle: pipe an MCP initialize JSON-RPC message to it and confirm valid response
- [ ] Add a `"build"` script to `server/package.json` for convenience

## Task 2: Restructure into Power layout (Kiro side)
- [ ] Move `power-aws-calculator/POWER.md` to repo root as `POWER.md`
- [ ] Move `power-aws-calculator/mcp.json` to repo root as `mcp.json`
- [ ] Move `power-aws-calculator/steering/` to repo root as `steering/`
- [ ] Delete the now-empty `power-aws-calculator/` directory
- [ ] Update `mcp.json` to point at `./dist/server.mjs` (not Docker)
- [ ] Delete `.kiro/agents/aws-calculator.json`
- [ ] Delete `.kiro/settings/mcp.json`

## Task 3: Add Claude Code configuration
- [ ] Create `.mcp.json` at repo root (Claude Code project-scope MCP config) pointing to `./dist/server.mjs`
- [ ] Create `CLAUDE.md` at repo root with condensed project instructions (under 200 lines): what the tools do, core workflow, service codes, group requirement, MAP basics, known limitations
- [ ] Create `.claude/skills/aws-calculator/SKILL.md` with YAML frontmatter (`name`, `description`) and full workflow instructions (mirrors steering/aws-calculator-workflow.md content + MAP essentials)
- [ ] Create `.claude/commands/estimate.md` with frontmatter (`description`, `argument-hint`) and the estimate-building prompt

## Task 4: Remove legacy files
- [ ] Delete `setup.ps1`
- [ ] Delete `.claude-plugin/` directory
- [ ] Delete `commands/` directory (old location — content moved to `.claude/commands/`)
- [ ] Delete `AGENT.md`
- [ ] Delete `skills/` directory (content absorbed into `.claude/skills/` and steering)
- [ ] Update `.gitignore` to final state (node_modules ignored; dist/ and .claude/ NOT ignored)

## Task 5: Update POWER.md for Kiro
- [ ] Keep existing front matter (name, description, keywords, author)
- [ ] Update onboarding to reference `dist/server.mjs` (not Docker build)
- [ ] Document all 5 MCP tools with brief descriptions
- [ ] Document when to load each steering file
- [ ] Remove all Docker/Node.js fallback setup instructions (README handles install)

## Task 6: Consolidate steering files
- [ ] Update `steering/aws-calculator-workflow.md` — absorb relevant content from old `skills/aws-calculator-estimates/SKILL.md`: full service codes table, EC2/RDS input examples, group structure, known limitations, estimate expiry, EC2 naming gotcha
- [ ] Review `steering/map-estimate-best-practices.md` — ensure it's complete and standalone
- [ ] Verify no critical information from AGENT.md or old SKILL.md is lost in either platform's instructions

## Task 7: Write the README as a dual-platform install manual
- [ ] Write brief description (what this is, 2-3 sentences)
- [ ] Write `## Prerequisites` (Node.js >= 18)
- [ ] Write `## Install for Kiro` with subsections:
  - [ ] Global Power: `git clone` to `~/.kiro/powers/` + mcp.json registration
  - [ ] Workspace Power: alternative for single-project use
- [ ] Write `## Install for Claude Code` with subsections:
  - [ ] Project scope: clone + open (auto-discovers .mcp.json)
  - [ ] Global scope: `claude mcp add` command with absolute path to dist/server.mjs
- [ ] Write `## Verify Installation` with a test command
- [ ] Write `## Update` (`git pull`)
- [ ] Write `## Uninstall` (both platforms)
- [ ] Write `## Alternative: Docker` for users who prefer it
- [ ] Write `## Development` (modify server, run build.sh, test)
- [ ] Ensure all instructions are concrete commands parseable by an AI agent

## Task 8: Update Dockerfile
- [ ] Update Dockerfile to use `dist/server.mjs` instead of building from source with npm ci
- [ ] Verify Docker build still works and server responds

## Task 9: Verify end-to-end (Kiro path)
- [ ] Run `build.sh` to regenerate `dist/server.mjs`
- [ ] Run `cd server && node --test index.test.js` to confirm source tests pass
- [ ] Test the bundle by starting it and calling `search_services` via JSON-RPC
- [ ] Simulate install: copy to a temp `~/.kiro/powers/` location, verify MCP server starts with absolute path

## Task 10: Verify end-to-end (Claude Code path)
- [ ] Verify `.mcp.json` is valid JSON and uses correct relative path
- [ ] Verify `CLAUDE.md` is under 200 lines and contains all essential info
- [ ] Verify `.claude/skills/aws-calculator/SKILL.md` has valid YAML frontmatter with `name` and `description`
- [ ] Verify `.claude/commands/estimate.md` has valid frontmatter with `description` and `argument-hint`
- [ ] Confirm that running `node dist/server.mjs` from repo root starts the server correctly (since both .mcp.json and mcp.json use `./dist/server.mjs`)
