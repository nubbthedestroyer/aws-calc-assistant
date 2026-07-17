# AWS Calculator Power

This repo provides MCP tools for building shareable AWS Pricing Calculator estimates. The MCP server is at `dist/server.mjs`.

## Instructions

All workflow instructions, service codes, field quality rules, and QA checklists are in the `steering/` directory:

- `steering/aws-calculator-workflow.md` — core workflow, configuration patterns, field quality rules, QA checklist
- `steering/map-estimate-best-practices.md` — MAP naming, group structure, ARR thresholds, assumptions

**Read both files before building any estimate.** They are the single source of truth for how to use these tools correctly.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `search_services` | Find AWS service codes by keyword |
| `get_service_schema` | Get input field IDs and options for a service |
| `configure_service` | Configure a service → cost + calculationComponents |
| `create_estimate` | Combine services into a shareable calculator.aws link |
| `load_estimate` | Load and inspect an existing estimate (use for QA) |

## Customer Scripts

When generating `.mjs` build scripts for specific customer estimates, **always save them to `customer-scripts/`**. This folder is gitignored to keep customer-specific data out of the repo. Never put customer estimate scripts in the root, `estimates/`, or any other tracked directory.
