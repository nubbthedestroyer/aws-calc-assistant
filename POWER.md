---
name: "aws-pricing-calculator-assistant"
displayName: "AWS Pricing Calculator Assistant"
description: "Generate shareable calculator.aws estimate links by describing your infrastructure in plain language. Supports multi-environment layouts (Production, DR, Staging), real-time AWS pricing lookups, and MAP funding best practices. Includes field quality validation, QA checklists, and automatic service label verification. Example: 'Create a 3-environment estimate with EC2, RDS, and S3 in us-east-1' and get back an editable calculator.aws URL."
keywords: ["aws", "pricing", "calculator", "estimate", "cost", "map", "migration", "ec2", "rds", "infrastructure", "arr", "cloud migration"]
author: "Michael Lucas"
---

# Onboarding

## MCP Configuration

The server runs via npx — no git clone or manual updates needed:

```json
{
  "mcpServers": {
    "aws-calculator": {
      "command": "npx",
      "args": ["@nubbthedestroyer/aws-calc-assistant@latest"]
    }
  }
}
```

## CRITICAL: This Power vs the Public AWS Pricing Calculator MCP

There is a **separate, unrelated** open-source server called `sample-aws-pricing-calculator-mcp`. **Do NOT use it.** If you see tools prefixed with `mcp_aws_pricing_calculator_mcp_server_*` in your environment, those belong to that public server and will produce estimates with $0 line items.

**Always use this power's tools:**

| This Power's Tool | Purpose |
|-------------------|---------|
| `search_services` | Find AWS service codes by keyword |
| `get_service_schema` | Get input field IDs and options for a service |
| `configure_service` | Configure a service with inputs → returns cost + `calculationComponents` |
| `create_estimate` | Combine configured services into a shareable calculator.aws link |
| `load_estimate` | Load and inspect an existing estimate by ID or URL |

**Key difference:** This power's `create_estimate` tool accepts a `monthlyCost` field per service that guarantees non-zero pricing in the output. The public server has no such mechanism and relies entirely on the calculator.aws pricing engine (which returns $0 for many services).

## Verify the server responds

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx @nubbthedestroyer/aws-calc-assistant@latest
```

You should see a JSON response containing `"name":"aws-calculator-assistant"`.

## Handling $0 Pricing and API Failures

The pricing CDN occasionally returns 403 errors or $0. This is **expected** — it uses undocumented AWS APIs.

**Solution: Always pass `monthlyCost` in `create_estimate`.**

When `configure_service` returns a valid cost, use that value as `monthlyCost`. When it returns $0 or fails, calculate the cost manually from published AWS pricing and pass it as `monthlyCost`. Either way, the estimate will render correctly.

```javascript
// In create_estimate services array — monthlyCost is your guarantee
{
  serviceCode: "amazonElasticsearchService",
  serviceName: "Amazon OpenSearch Service",
  monthlyCost: 2462.18,   // ← This ensures non-zero pricing
  region: "us-east-2",
  description: "3x r6g.xlarge, 300GB gp3",
  configSummary: "r6g.xlarge x3, 300GB GP3, On-Demand",
  group: "Production",
  calculationComponents: { ... }
}
```

# When to Load Steering Files

- Building or updating a calculator.aws estimate → `aws-calculator-workflow.md`
- Structuring an estimate for AWS MAP funding → `map-estimate-best-practices.md`
- Asking about environment naming, group structure, or ARR → `map-estimate-best-practices.md`
- Configuring EC2, RDS, S3, or other specific services → `aws-calculator-workflow.md`
- Quality-checking an estimate before delivery → `field-quality-rules.md`

# Instructions

All workflow instructions are in `steering/`. Those files are the single source of truth — shared identically with Claude Code via symlink.
