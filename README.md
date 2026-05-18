# AWS Calculator Assistant

A Claude Code plugin for building shareable [AWS Pricing Calculator](https://calculator.aws/) estimates programmatically.

## What it does

- Searches 400+ AWS services and retrieves their configuration schemas
- Configures services with real-time pricing from AWS APIs
- Creates shareable, editable calculator.aws estimate links
- Supports grouped/nested service organization (e.g., Production, DR, Dev)
- Loads and inspects existing estimates

## Installation

The MCP server can run via Docker (recommended — no Node.js required) or directly with Node.js.

### Option 1: Docker (recommended)

```bash
docker build -t aws-calculator-mcp .
```

MCP config:
```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "aws-calculator-mcp"]
    }
  }
}
```

### Option 2: Node.js (if Docker is unavailable)

```bash
cd server && npm install
```

MCP config:
```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["/full/path/to/aws-calc-assistant/server/index.js"]
    }
  }
}
```

---

### Kiro

After cloning and completing either option above:

1. Open the project in Kiro. `.kiro/settings/mcp.json` registers the MCP server automatically (Docker by default — edit it to use Node.js if needed), and `.kiro/agents/aws-calculator.json` provides a ready-to-use agent.

2. Switch to the agent in chat:

```
/agent aws-calculator
```

The `skills/aws-calculator-estimates/SKILL.md` skill is loaded on demand — Kiro will reference it automatically when building estimates.

---

### Claude Code

Add the MCP server to your Claude Code settings:

```
/mcp add aws-calculator -- docker run --rm -i aws-calculator-mcp
```

Or with Node.js:

```
/mcp add aws-calculator -- node /full/path/to/aws-calc-assistant/server/index.js
```

Restart Claude Code or run `/mcp` to verify the server is connected.

### As a distributable Claude Code plugin

Once published to a GitHub repo, users can install with:

```bash
/plugin marketplace add <your-org>/aws-calc-assistant
/plugin install aws-calc-assistant@<your-marketplace>
/reload-plugins
```

## Usage

### Slash command

```
/aws-calc-assistant:estimate 3 m6i.4xlarge EC2 instances with 500GB gp3 in us-east-1
```

### Via MCP tools

The plugin provides 5 MCP tools: `search_services`, `get_service_schema`, `configure_service`, `create_estimate`, and `load_estimate`.

### Programmatic (scripts)

```javascript
import { createMCPClient, configureService, buildServiceEntry, buildGroupedPayload, saveEstimate }
  from './skills/aws-calculator-estimates/mcp-client-template.mjs';

const client = createMCPClient('/path/to/server/index.js');
await client.init();

const { entry } = await buildServiceEntry(client, 'eC2Next', {
  instanceType: 'm6i.4xlarge', selectedOS: 'linux', quantity: 4,
  pricingStrategy: { model: 'ondemand' }, storageAmount: { value: 500, unit: 'GB' },
}, 'Prod App Servers', 'Linux, m6i.4xlarge, 4 inst, 500GB gp3', 'quickEstimate');

const payload = buildGroupedPayload('My Estimate', {
  PRODUCTION: { services: { [`svc-${crypto.randomUUID()}`]: entry } },
});

const url = await saveEstimate(payload);
console.log(url);
client.close();
```

## Known limitations

- Some services (S3, Fargate, EMR, Transit Gateway, AWS Backup) return $0 from the pricing engine. Include them with manual `monthlyCost` overrides.
- EC2 `m6i.18xlarge` and `m7i.18xlarge` return $0 — use 16xlarge or 24xlarge instead.
- Estimates expire after 1 year on calculator.aws.
- These are undocumented AWS APIs that could change without notice.

## License

MIT
