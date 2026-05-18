---
name: "aws-calculator"
displayName: "AWS Pricing Calculator"
description: "Build shareable AWS Pricing Calculator estimates programmatically — with real-time pricing, grouped environments, and MAP funding best practices"
keywords: ["aws", "pricing", "calculator", "estimate", "cost", "map", "migration", "ec2", "rds", "infrastructure", "arr", "cloud migration"]
author: "SoftServe"
---

# Onboarding

## Step 1: Start the MCP server

**Option A — Docker (recommended, no Node.js required):**

```bash
docker build -t aws-calculator-mcp .
```

Verify Docker is available first:
```bash
docker --version
```

**Option B — Node.js (if Docker is unavailable):**

```bash
cd server && npm install
```

Then edit `.kiro/settings/mcp.json` and replace the `docker` command with:
```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "node",
      "args": ["${workspaceFolder}/server/index.js"]
    }
  }
}
```

## Step 2: Confirm MCP tools are available
After installation, the following MCP tools should be available via the `aws-calculator` server:
- `search_services` — find AWS service codes by keyword
- `get_service_schema` — get field IDs and options for a service
- `configure_service` — configure a service and get real-time pricing
- `create_estimate` — combine services into a shareable calculator.aws link
- `load_estimate` — load and inspect an existing estimate by ID or URL

# When to Load Steering Files

- Building or updating a calculator.aws estimate → `aws-calculator-workflow.md`
- Structuring an estimate for AWS MAP funding → `map-estimate-best-practices.md`
- Asking about environment naming, group structure, or ARR → `map-estimate-best-practices.md`
- Configuring EC2, RDS, S3, or other specific services → `aws-calculator-workflow.md`
