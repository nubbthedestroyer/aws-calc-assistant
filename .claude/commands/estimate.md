---
description: Build an AWS Pricing Calculator estimate from a description of infrastructure. Returns a shareable calculator.aws link.
argument-hint: describe the infrastructure to estimate
---

Use the AWS Calculator MCP tools to build an AWS Pricing Calculator estimate based on `$ARGUMENTS`. The goal is a MAP-ready estimate suitable for an AWS Migration Acceleration Program funding request.

Behavior:

1. Parse the infrastructure description to identify AWS services, instance types, quantities, and regions.
2. Use `configure_service` for each service to get real-time pricing and `calculationComponents`.
3. Group services by environment using the standard MAP taxonomy: Production, Disaster Recovery, Pre-Production, Development, Shared Services.
4. Use `create_estimate` to save and return a shareable calculator.aws link.
5. Present a summary table with per-group and total monthly/annual costs.
6. Call out the projected annual run-rate (ARR) and which MAP funding tier it falls into (< $100K = MAP Lite at 15%; $100K–$500K = Standard MAP at 15–20%; > $500K = Full MAP at up to 25%).

If the description is vague, make reasonable assumptions for an enterprise workload and note them in an Assumptions group.
For services where the pricing engine returns $0 (S3, Fargate, Backup, etc.), include them with manually estimated costs and document the estimates in the Assumptions group.
Use On-Demand pricing as the baseline — MAP ARR is calculated on list price, not reserved rates.
