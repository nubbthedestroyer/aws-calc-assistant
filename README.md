# AWS Calculator Power

Build shareable [AWS Pricing Calculator](https://calculator.aws/) estimates programmatically via MCP tools. Designed for creating MAP (Migration Acceleration Program) funding estimates from customer infrastructure descriptions.

Works with both **Kiro** (as a Power) and **Claude Code** (as a project with MCP + skills).

## Prerequisites

- **Node.js >= 18** (check with `node --version`)

## Install via npx (recommended)

The simplest way to use this server — no git clone or manual updates needed. Updates are automatic via `@latest`.

### Kiro

Add to your global Kiro config at `~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "npx",
      "args": ["@desktopninjas/aws-calc-assistant@latest"]
    }
  }
}
```

Restart Kiro or reconnect MCP servers from the MCP Server view.

### Claude Code

Register the MCP server globally:

```bash
claude mcp add aws-calculator --scope user -- npx @desktopninjas/aws-calc-assistant@latest
```

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "npx",
      "args": ["@desktopninjas/aws-calc-assistant@latest"]
    }
  }
}
```

### Pin a specific version

For stability in production environments, pin to a specific version:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "npx",
      "args": ["@desktopninjas/aws-calc-assistant@1.0.0"]
    }
  }
}
```

## Install from source (alternative)

If you want to develop or modify the server locally:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git
cd aws-calc-assistant
```

Then use the local path in your MCP config:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["/path/to/aws-calc-assistant/dist/server.mjs"]
    }
  }
}
```

### Kiro Power (from source)

Clone into your Kiro powers directory for automatic discovery:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git ~/.kiro/powers/aws-calc-assistant
```

### Claude Code (from source)

Clone and open with Claude Code — it auto-discovers `.mcp.json`:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git
cd aws-calc-assistant
claude
```

## Verify Installation

Test that the server responds:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx @desktopninjas/aws-calc-assistant@latest
```

You should see a JSON response containing `"name":"aws-calculator-assistant"`.

## Update

With npx, updates are automatic — `@latest` always fetches the newest version. To clear the npx cache:

```bash
npx clear-npx-cache
```

If installed from source:

```bash
cd ~/.kiro/powers/aws-calc-assistant && git pull
```

## Uninstall

### npx

Just remove the `aws-calculator` entry from your MCP config. No files to delete.

### From source (Kiro)

```bash
rm -rf ~/.kiro/powers/aws-calc-assistant
```

Then remove the `aws-calculator` entry from `~/.kiro/settings/mcp.json`.

### From source (Claude Code)

```bash
claude mcp remove aws-calculator
rm -rf ~/tools/aws-calc-assistant
rm -rf ~/.claude/skills/aws-calculator
```

## Alternative: Docker

If you prefer Docker over running Node.js directly:

```bash
git clone https://github.com/desktopninjas/aws-calc-assistant.git
cd aws-calc-assistant
docker build -t aws-calculator-mcp .
```

Then use this MCP config:

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

The bundled `dist/server.mjs` is committed to the repo. After rebuilding, commit and publish:

```bash
npm version patch         # bumps version in root package.json
npm publish --access public
```

### Drift Detection

The Claude Code skill (`.claude/skills/aws-calculator/SKILL.md`) is a symlink to `steering/aws-calculator-workflow.md`. This ensures both platforms always use identical instructions. Run `make verify` to confirm no drift:

```bash
make verify
```

This checks that the symlink is valid, frontmatter is present, MCP configs match, and the server responds.
