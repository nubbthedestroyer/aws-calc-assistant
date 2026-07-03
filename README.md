# AWS Calculator Power

Build shareable [AWS Pricing Calculator](https://calculator.aws/) estimates programmatically via MCP tools. Designed for creating MAP (Migration Acceleration Program) funding estimates from customer infrastructure descriptions.

Works with both **Kiro** (as a Power) and **Claude Code** (as a project with MCP + skills).

## Prerequisites

- **Node.js >= 18** (check with `node --version`)

## Install for Kiro

### Global Power (use from any workspace)

Clone into your Kiro powers directory:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git ~/.kiro/powers/aws-calc-assistant
```

Add the MCP server to your global Kiro config. Open `~/.kiro/settings/mcp.json` and add `aws-calculator` to the `mcpServers` object:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["~/.kiro/powers/aws-calc-assistant/dist/server.mjs"]
    }
  }
}
```

Restart Kiro or reconnect MCP servers from the MCP Server view.

### Workspace Power (use in one project only)

Clone the repo anywhere and open it in Kiro. The `mcp.json` at the repo root will auto-register the server for that workspace.

## Install for Claude Code

### Option A: Project scope (auto-discovered)

Clone the repo and open it with Claude Code:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git
cd aws-calc-assistant
claude
```

Claude Code automatically discovers `.mcp.json` and loads the MCP server. The `CLAUDE.md` provides project context and `.claude/skills/aws-calculator/SKILL.md` activates on relevant tasks.

### Option B: Global scope (use from anywhere)

Clone to a permanent location:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git ~/tools/aws-calc-assistant
```

Register the MCP server globally:

```bash
claude mcp add aws-calculator --scope user -- node ~/tools/aws-calc-assistant/dist/server.mjs
```

Optionally, copy the skill for global availability:

```bash
mkdir -p ~/.claude/skills/aws-calculator
cp ~/tools/aws-calc-assistant/.claude/skills/aws-calculator/SKILL.md ~/.claude/skills/aws-calculator/
```

## Verify Installation

From the install directory (or anywhere if installed globally), test that the server responds:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node ~/.kiro/powers/aws-calc-assistant/dist/server.mjs
```

You should see a JSON response containing `"name":"aws-calculator-assistant"`.

## Update

```bash
cd ~/.kiro/powers/aws-calc-assistant && git pull
```

Or wherever you cloned the repo. No rebuild needed — `dist/server.mjs` is pre-built and committed.

## Uninstall

### Kiro

```bash
rm -rf ~/.kiro/powers/aws-calc-assistant
```

Then remove the `aws-calculator` entry from `~/.kiro/settings/mcp.json`.

### Claude Code

```bash
claude mcp remove aws-calculator
rm -rf ~/tools/aws-calc-assistant
rm -rf ~/.claude/skills/aws-calculator
```

## Alternative: Docker

If you prefer Docker over running Node.js directly:

```bash
cd ~/.kiro/powers/aws-calc-assistant  # or wherever you cloned
docker build -t aws-calculator-mcp .
```

Then use this MCP config instead:

```json
{
  "aws-calculator": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "aws-calculator-mcp"]
  }
}
```

## Usage

Once installed, ask your AI agent to build estimates:

```
Create an AWS MAP estimate for Acme Corp with:
- Production: 4x m6i.2xlarge EC2 (Linux), RDS PostgreSQL db.r6g.2xlarge Multi-AZ 500GB
- DR: 2x m6i.2xlarge EC2, RDS PostgreSQL db.r6g.large 500GB
- Shared Services: CloudWatch, WAF
Region: us-east-1
```

In Claude Code, you can also use the slash command:

```
/estimate 3 m6i.4xlarge EC2 instances with 500GB gp3 in us-east-1
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `search_services` | Find AWS service codes by keyword |
| `get_service_schema` | Get input field IDs and options for a service |
| `configure_service` | Configure a service → returns cost + calculation components |
| `create_estimate` | Combine services into a shareable calculator.aws link |
| `load_estimate` | Load and inspect an existing estimate |

## Development

To modify the server and rebuild:

```bash
cd server && npm install
# Edit server/index.js
npm test                  # Run tests (20 unit tests)
cd .. && ./build.sh       # Rebuild dist/server.mjs
```

The bundled `dist/server.mjs` is committed to the repo. After rebuilding, commit it so consumers get the update on `git pull`.

### Drift Detection

The Claude Code skill (`.claude/skills/aws-calculator/SKILL.md`) is a symlink to `steering/aws-calculator-workflow.md`. This ensures both platforms always use identical instructions. Run `make verify` to confirm no drift:

```bash
make verify
```

This checks that the symlink is valid, frontmatter is present, MCP configs match, and the server responds.
