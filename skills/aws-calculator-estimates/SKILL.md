---
name: aws-calculator-estimates
description: Use when building AWS Pricing Calculator estimates — creating shareable calculator.aws links with grouped services, correct pricing, and editable configurations
---

# AWS Calculator Estimates

Build shareable AWS Pricing Calculator estimates programmatically. The bundled MCP server calls undocumented calculator.aws APIs to create editable estimate links.

**Core workflow:** `configure_service` → collect `calculationComponents` → `create_estimate`

## Tools

| Tool | Purpose |
|------|---------|
| `search_services` | Find service codes by keyword |
| `get_service_schema` | Get input field IDs and options for a service |
| `configure_service` | Configure inputs → returns `calculationComponents` + calculated cost |
| `create_estimate` | Combine services → returns shareable calculator.aws link |
| `load_estimate` | Load existing estimate by ID/URL |

## Workflow

**ALWAYS use `configure_service` first** to get properly formatted `calculationComponents`. Never build them manually.

```
1. search_services("EC2")           → serviceCode: "eC2Next"
2. get_service_schema("eC2Next")    → field IDs, options, templates
3. configure_service(serviceCode, inputs, templateId)
                                    → { monthlyCost, calculationComponents, templateId }
4. create_estimate(name, services[]) → shareable URL
```

## Group Structure (Critical)

Services **MUST be nested inside groups** via the `group` field, not at the top level. If the estimate link opens blank, this is almost certainly the cause.

```javascript
// ✅ Each service has a group field
{ serviceCode: "eC2Next", group: "PRODUCTION", ... }
{ serviceCode: "eC2Next", group: ["Accounts", "CI/CD"], ... }  // nested

// ❌ Services without groups render blank
```

## Common Service Codes

| Service | serviceCode | Notes |
|---------|-------------|-------|
| EC2 | `eC2Next` | Set `estimateFor` to description (not template ID) |
| RDS SQL Server | `amazonRDSForSQLServer` | Uses `columnFormIPM` |
| RDS PostgreSQL | `amazonRDSPostgreSQLDB` | Uses `columnFormIPM` |
| S3 | `amazonSimpleStorageServiceGroup` | Loader layout — template: `s3StandardStorage` |
| CloudFront | `amazonCloudFront` | |
| Lambda | `awsLambda` | |
| Fargate | `awsFargate` | |
| CloudWatch | `amazonCloudWatch` | |

## EC2 Inputs

```javascript
{
  serviceCode: 'eC2Next',
  templateId: 'quickEstimate',
  inputs: {
    instanceType: 'm6i.8xlarge',
    selectedOS: 'linux',          // linux, windows, windows-std
    quantity: 2,
    pricingStrategy: { model: 'ondemand' },
    storageAmount: { value: 100, unit: 'GB' },
  }
}
```

## RDS Inputs

```javascript
{
  serviceCode: 'amazonRDSForSQLServer',
  inputs: {
    columnFormIPM: {
      'Instance Type': 'db.r6i.4xlarge',
      'Deployment Option': 'Multi-AZ',
      'TermType': 'OnDemand',
      'Number of Nodes': 1,
      'Database Edition': 'Enterprise',
      'License': 'License included',
    },
    storageType: 'General Purpose-GP3',
    storageAmount: { value: 500, unit: 'GB' },
  }
}
```

## Known Pricing Limitations

Some services return `$0` from the pricing engine. Include them with manual `monthlyCost` values:
- S3, Fargate, EMR, Transit Gateway, AWS Backup
- EC2 `m6i.18xlarge` / `m7i.18xlarge` — use 16xlarge or 24xlarge instead

## EC2 Naming

The `estimateFor` field renders as the service name in the calculator UI. For EC2, `quickEstimate` renders literally. **Set `estimateFor` to the description** for meaningful names.

## Client Template

A reusable MCP client is included at `skills/aws-calculator-estimates/mcp-client-template.mjs` for building estimates programmatically from scripts.

## Estimate Expiry

Calculator.aws estimates expire after **1 year**. These are undocumented APIs.

---

## MAP Estimate Best Practices

The primary purpose of these estimates is to support **AWS MAP (Migration Acceleration Program) funding requests**. MAP credits are calculated as 15–25% of projected first-year AWS run-rate for eligible migrated workloads. A well-structured estimate is a key artifact in the Assess phase business case.

### Estimate Naming

Use the format: `[Customer] - AWS MAP Estimate - [YYYY-MM]`

Examples:
- `Acme Corp - AWS MAP Estimate - 2026-06`
- `Acme Corp - AWS MAP Estimate - Post-Migration Run Rate`

Avoid vague names like "My Estimate" or "Test" — the estimate URL gets shared with AWS and the customer.

### Group / Environment Structure

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

### Service / Resource Naming

The `description` field renders as the line-item label in the calculator UI. Make it human-readable and specific:

```
✅  "Web Tier - 4x m6i.2xlarge (Linux, On-Demand)"
✅  "RDS PostgreSQL - db.r6g.4xlarge Multi-AZ, 500GB"
✅  "EKS Worker Nodes - 6x m6i.xlarge"

❌  "EC2"
❌  "quickEstimate"
❌  "Service 1"
```

### Pricing Model Guidance

For MAP estimates, use **On-Demand pricing** as the baseline — MAP ARR is calculated on list price consumption, not reserved rates. You can add a separate group or note showing Reserved/Savings Plan pricing as the optimized scenario, but the MAP funding calculation uses On-Demand.

### What to Include for a Complete MAP Estimate

A MAP-sufficient estimate must cover:
1. **All production workloads** — compute, database, storage, networking, load balancers
2. **Data transfer costs** — often underestimated; include inter-AZ, egress, and CloudFront
3. **Managed services** — RDS, ElastiCache, OpenSearch, MSK instead of self-managed where applicable (increases ARR and strengthens the cloud-native story)
4. **Shared infrastructure** — VPC, Transit Gateway, Route 53, WAF, Shield
5. **Observability** — CloudWatch, X-Ray (even at $0 from the pricing engine, include them)
6. **DR environment** — at minimum, include the compute and database tier at reduced capacity

### ARR Thresholds

MAP funding tiers (as of 2024):
- **< $100K ARR**: MAP Lite — 15% credits
- **$100K–$500K ARR**: Standard MAP — 15–20% credits
- **> $500K ARR**: Full MAP — up to 25% credits

If the estimate total is below $100K/year (~$8,300/mo), flag this to the user — they may need to expand scope or the engagement may only qualify for MAP Lite.

### Assumptions Block

If any services are estimated (not configured via the pricing engine), add an `Assumptions` group with a single placeholder service and document them in the `description` field:

```javascript
group: "Assumptions"
description: "S3: ~$200/mo estimated (50TB standard storage). CloudFront: ~$150/mo estimated (2TB egress). Fargate: ~$300/mo estimated."
```

This makes the estimate auditable and sets expectations when sharing with the customer or AWS.
