# AWS Calculator Assistant

A Multi-Agent compatible plugin for building shareable [AWS Pricing Calculator](https://calculator.aws/) estimates programmatically.

## What it does

- Searches 400+ AWS services and retrieves their configuration schemas
- Configures services with real-time pricing from AWS APIs
- Creates shareable, editable calculator.aws estimate links
- Supports grouped/nested service organization (e.g., Production, DR, Dev)
- Loads and inspects existing estimates

## Quick Start

The fastest way to use this tool is to point your AI agent directly at this repo and describe what you need:

1. Clone the repo and open it in Kiro (or add the MCP server to Claude Code — see Installation below)
2. Give your agent context and ask it to build the estimate:

```
Use this repo to build an AWS MAP estimate. Here are the customer's call notes and
infrastructure details: [paste notes, discovery questionnaire, architecture diagram, etc.]
```

The agent will set up the MCP server, search for the right AWS services, configure pricing,
and return a shareable calculator.aws link — no manual setup required.

---

## Installation

The MCP server can run via Docker (recommended — no Node.js required) or directly with Node.js.

### Windows

Run the setup script — it auto-detects Docker or Node.js and configures Kiro automatically:

```powershell
.\setup.ps1
```

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

### Slash command (Claude Code)

```
/aws-calc-assistant:estimate 3 m6i.4xlarge EC2 instances with 500GB gp3 in us-east-1
```

### Example queries

**Build a MAP estimate for a 3-tier web app:**
```
Create an AWS MAP estimate for Acme Corp with:
- Production: 4x m6i.2xlarge EC2 (Linux), RDS PostgreSQL db.r6g.2xlarge Multi-AZ 500GB
- DR: 2x m6i.2xlarge EC2, RDS PostgreSQL db.r6g.large 500GB
- Shared Services: CloudWatch, WAF
Region: us-east-1
```

**Look up a service:**
```
Search for RDS services
```

**Load an existing estimate:**
```
Load estimate https://calculator.aws/#/estimate?id=abc123
```

### Example tool outputs

**search_services("RDS")**
```
Found 8 service(s) matching "RDS":

  Amazon RDS for MySQL                          serviceCode: amazonRDSMySQL
  Amazon RDS for PostgreSQL                     serviceCode: amazonRDSPostgreSQLDB
  Amazon RDS for SQL Server                     serviceCode: amazonRDSForSQLServer
  Amazon RDS for Oracle                         serviceCode: amazonRDSForOracle
  ...

Use serviceCode with get_service_schema or configure_service.
```

**configure_service("eC2Next", { instanceType: "m6i.2xlarge", quantity: 4, ... })**
```json
{
  "serviceName": "Amazon EC2",
  "serviceCode": "eC2Next",
  "region": "us-east-1",
  "monthlyCost": 560.64,
  "upfrontCost": 0,
  "annualCost": 6727.68,
  "summary": "Amazon EC2 in US East (N. Virginia): $560.64/mo | $6,727.68/yr",
  "templateId": "quickEstimate",
  "calculationComponents": { ... }
}
```

**create_estimate(...)**
```
Estimate "Acme Corp - AWS MAP Estimate - 2026-06" saved.
Link: https://calculator.aws/#/estimate?id=5ec6ae5fb817...
Monthly: $2,847.50 | Upfront: $0.00 | 12-month: $34,170.00
Services: 6

Groups:
  Production ($1,842.30/mo)
  Disaster Recovery ($805.20/mo)
  Shared Services ($200.00/mo)
```

**load_estimate("https://calculator.aws/#/estimate?id=...")**
```
Estimate: Acme Corp - AWS MAP Estimate - 2026-06
Monthly: $2,847.50 | Annual: $34,170.00 | Upfront: $0.00
Created: 2026-06-01T14:23:11.000Z

Groups:
  Production: $1,842.30/mo
    - Amazon EC2 (us-east-1): $560.64/mo
    - Amazon RDS for PostgreSQL (us-east-1): $1,281.66/mo
  Disaster Recovery: $805.20/mo
    - Amazon EC2 (us-east-1): $280.32/mo
    - Amazon RDS for PostgreSQL (us-east-1): $524.88/mo
  Shared Services: $200.00/mo
    - Amazon CloudWatch (us-east-1): $200.00/mo
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
