# MAP Estimate Best Practices

The primary purpose of AWS Calculator estimates in this context is to support **AWS MAP (Migration Acceleration Program) funding requests**. MAP credits are 15–25% of projected first-year AWS run-rate for eligible migrated workloads. A well-structured estimate is a key artifact in the Assess phase business case.

## Estimate Naming

Use the format: `[Customer] - AWS MAP Estimate - [YYYY-MM]`

Examples:
- `Acme Corp - AWS MAP Estimate - 2026-06`
- `Acme Corp - AWS MAP Estimate - Post-Migration Run Rate`

Avoid vague names like "My Estimate" or "Test" — the estimate URL gets shared with AWS and the customer.

## Group / Environment Structure

Groups represent the post-migration AWS environment. **Always include all environments** — MAP funding is calculated on total post-migration run-rate, not just production.

Standard group taxonomy for MAP:

| Group Name | Purpose |
|---|---|
| `Production` | Primary production workloads — the core of the MAP ARR calculation |
| `Disaster Recovery` | DR / standby environment (often 50–70% of prod cost) |
| `Pre-Production` | Staging / UAT — include if it runs continuously |
| `Development` | Dev/test environments |
| `Shared Services` | Networking, security tooling, monitoring (Transit Gateway, GuardDuty, etc.) |

For multi-account or multi-region architectures, nest groups:
```javascript
group: ["Production", "us-east-1"]
group: ["Production", "eu-west-1"]
```

Only **Production** and **DR** workloads count toward MAP-eligible ARR. Include Dev/Pre-Prod anyway — they show total AWS footprint and strengthen the business case.

## Service / Resource Naming

The `description` field renders as the line-item label in the calculator UI. Make it human-readable and specific:

```
✅  "Web Tier - 4x m6i.2xlarge (Linux, On-Demand)"
✅  "RDS PostgreSQL - db.r6g.4xlarge Multi-AZ, 500GB"
✅  "EKS Worker Nodes - 6x m6i.xlarge"

❌  "EC2"
❌  "quickEstimate"
❌  "Service 1"
```

## Pricing Model

Use **On-Demand pricing** as the baseline — MAP ARR is calculated on list price consumption, not reserved rates. You can note Reserved/Savings Plan pricing separately as an optimization scenario, but the MAP funding calculation uses On-Demand.

## What to Include for a Complete MAP Estimate

A MAP-sufficient estimate must cover:
1. **All production workloads** — compute, database, storage, networking, load balancers
2. **Data transfer costs** — inter-AZ, egress, and CloudFront
3. **Managed services** — RDS, ElastiCache, OpenSearch, MSK instead of self-managed where applicable (increases ARR and strengthens the cloud-native story)
4. **Shared infrastructure** — VPC, Transit Gateway, Route 53, WAF, Shield
5. **Observability** — CloudWatch, X-Ray
6. **DR environment** — at minimum, compute and database tier at reduced capacity

## ARR Thresholds

MAP funding tiers (as of 2024):

| Annual Run-Rate | MAP Tier | Credits |
|---|---|---|
| < $100K/yr | MAP Lite | 15% |
| $100K–$500K/yr | Standard MAP | 15–20% |
| > $500K/yr | Full MAP | up to 25% |

If the estimate total is below ~$8,300/mo ($100K/yr), flag this — the engagement may only qualify for MAP Lite.

## Assumptions Block

If any services are estimated (not configured via the pricing engine), add an `Assumptions` group and document them:

```javascript
group: "Assumptions"
description: "S3: ~$200/mo estimated (50TB standard storage). CloudFront: ~$150/mo estimated (2TB egress). Fargate: ~$300/mo estimated."
```

This makes the estimate auditable when sharing with the customer or AWS.
