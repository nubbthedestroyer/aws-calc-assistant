---
name: map-estimate-best-practices
description: Structure AWS Calculator estimates for MAP (Migration Acceleration Program) funding requests. Use when building MAP estimates, structuring environment groups, or calculating ARR thresholds.
---

# MAP Estimate Best Practices

The primary purpose of AWS Calculator estimates in this context is to support **AWS MAP (Migration Acceleration Program) funding requests**. MAP credits are 15–25% of projected first-year AWS run-rate for eligible migrated workloads. A well-structured estimate is a key artifact in the Assess phase business case.

## Estimate Naming

Use the format: `[Customer] - AWS Migration Estimate - [YYYY-MM]`

Examples:
- `Acme Corp - AWS Migration Estimate - 2026-06`
- `Acme Corp - AWS Migration Estimate - Post-Migration Run Rate`

**Do NOT put "MAP" in the estimate name.** The estimate is shared with the customer and AWS — it should describe what it IS (a migration estimate), not what funding program it supports. Putting "MAP" in the title looks like you're gaming the system.

Avoid vague names like "My Estimate" or "Test" — the estimate URL gets shared with AWS and the customer.

## Group / Environment Structure

Groups represent the post-migration AWS environment. **Always include all environments** — MAP funding is calculated on total post-migration run-rate, not just production.

Standard group taxonomy for MAP:

| Group Name | Purpose | Typical sizing |
|---|---|---|
| `Production` | Primary production workloads — the core of the MAP ARR calculation | 100% |
| `Staging` | Pre-production / UAT — include if it runs continuously | ~20% of prod |
| `Development` | Dev/test environments | ~20% of prod |
| `Shared Services` | Networking, security tooling, CDN, monitoring | Flat cost |
| `Disaster Recovery` | DR / standby environment (if applicable) | 50–70% of prod |

For multi-account or multi-region architectures, nest groups:
```javascript
group: ["Production", "us-east-1"]
group: ["Production", "eu-west-1"]
group: ["Staging", "us-east-1"]
group: ["Development", "us-east-1"]
```

**Always include Staging and Development environments.** Even at 20% of production, they add meaningful ARR and reflect a realistic post-migration footprint. Production-only estimates look incomplete.

Only **Production** and **DR** workloads count toward MAP-eligible ARR. Include Dev/Staging anyway — they show total AWS footprint and strengthen the business case.

## Data Transfer and Network Costs — MAP Exclusion

**CRITICAL: AWS MAP does NOT allow network data transfer costs to count toward eligible ARR.** Do not include data transfer line items (inter-region, egress, Direct Connect data transfer out) as a strategy to inflate the estimate total.

What IS allowed:
- ✅ Direct Connect **port charges** (the hourly connection fee)
- ✅ NAT Gateway **hourly charges** and **data processing fees**
- ✅ CloudFront (CDN is a managed service, not raw data transfer)
- ✅ Transit Gateway attachment fees

What is NOT allowed / should be excluded:
- ❌ Direct Connect **data transfer out** charges
- ❌ Inter-region data transfer
- ❌ Internet egress from EC2/VPC
- ❌ S3 data transfer out

When including Direct Connect, configure it with **port-only pricing** (no `dataTransferOut` field). For NAT Gateways, the data processing fee is acceptable but don't inflate volume solely to increase the total.

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

## Realistic Monthly Costs (No Round Numbers)

Every `monthlyCost` value must include dollars and cents. Round numbers ($2,900, $7,700, $3,600) look fabricated and damage credibility with AWS and the customer.

Derive costs from hourly rates × 730 hours/month (the standard billing month). This naturally produces values with cents:

```
✅  $7,694.52   (hourly rate × instances × 730)
✅  $3,587.28
✅  $10,817.64

❌  $7,700
❌  $3,600
❌  $10,800
```

## No $0 Line Items

**NEVER include a service with $0 monthly cost in the estimate.** A $0 entry looks broken.

- If the pricing API returns $0, provide a manual cost estimate with realistic cents
- If you cannot determine a cost, do NOT include the service
- Do NOT create an "Assumptions" group with $0 cost — document assumptions in `configSummary` fields instead

## What to Include for a Complete MAP Estimate

A MAP-sufficient estimate must cover:
1. **All production workloads** — compute, database, storage, networking (port fees), load balancers
2. **Staging environment** — ~20% of production (reduced instance counts/sizes, same services)
3. **Development environment** — ~20% of production
4. **Managed services** — RDS, ElastiCache, OpenSearch, MSK instead of self-managed where applicable (increases ARR and strengthens the cloud-native story)
5. **Shared infrastructure** — Direct Connect (port only), CloudFront, Route 53, WAF
6. **DR environment** (if applicable) — at minimum, compute and database tier at reduced capacity

**Do NOT include:**
- Data transfer egress charges (not MAP-eligible)
- Temporary migration services (DMS, etc.) unless they represent ongoing cost
- Services you cannot reasonably cost (leave them out rather than show $0)

## ARR Thresholds

MAP funding tiers (as of 2024):

| Annual Run-Rate | MAP Tier | Credits |
|---|---|---|
| < $100K/yr | MAP Lite | 15% |
| $100K–$500K/yr | Standard MAP | 15–20% |
| > $500K/yr | Full MAP | up to 25% |

If the estimate total is below ~$8,300/mo ($100K/yr), flag this — the engagement may only qualify for MAP Lite.

**Tip:** Including Staging + Development at 20% of prod each adds ~40% to the total. A $53K/mo production footprint becomes ~$82K/mo with all environments — potentially crossing a tier threshold.

## Assumptions Documentation

Do NOT create a separate "Assumptions" group in the estimate. Instead:

1. Document pricing methodology in each service's `configSummary` field
2. When presenting the estimate to the user, note which services used manual pricing (API returned $0)
3. If creating a companion document, list assumptions there — but the estimate itself should be clean with no $0 rows
