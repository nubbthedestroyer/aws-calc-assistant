---
name: "aws-calculator"
displayName: "AWS Pricing Calculator"
description: "Build shareable AWS Pricing Calculator estimates programmatically — with real-time pricing, grouped environments, and MAP funding best practices"
iconUrl: "https://raw.githubusercontent.com/desktopninjas/aws-calc-assistant/main/icon.png"
keywords: ["aws", "pricing", "calculator", "estimate", "cost", "map", "migration", "ec2", "rds", "infrastructure", "arr", "cloud migration"]
author: "Michael Lucas"
---

# Onboarding

## Confirm MCP tools are available

After installation, the following MCP tools should be available via the `aws-calculator` server:

| Tool | Purpose |
|------|---------|
| `search_services` | Find AWS service codes by keyword |
| `get_service_schema` | Get input field IDs and options for a service |
| `configure_service` | Configure a service with inputs → returns cost + `calculationComponents` |
| `create_estimate` | Combine configured services into a shareable calculator.aws link |
| `load_estimate` | Load and inspect an existing estimate by ID or URL |

## Verify the server responds

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/server.mjs
```

You should see a JSON response containing `"name":"aws-calculator-assistant"`.

# When to Load Steering Files

- Building or updating a calculator.aws estimate → `aws-calculator-workflow.md`
- Structuring an estimate for AWS MAP funding → `map-estimate-best-practices.md`
- Asking about environment naming, group structure, or ARR → `map-estimate-best-practices.md`
- Configuring EC2, RDS, S3, or other specific services → `aws-calculator-workflow.md`
- Quality-checking an estimate before delivery → `aws-calculator-workflow.md` (QA Checklist section)

# Instructions

All workflow instructions are in `steering/`. Those files are the single source of truth — shared identically with Claude Code via symlink.
