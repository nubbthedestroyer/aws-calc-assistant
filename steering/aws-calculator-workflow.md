---
name: aws-calculator-workflow
description: Build shareable AWS Pricing Calculator estimates with grouped services, real-time pricing, field quality rules, and QA validation. Use when asked to create AWS cost estimates, MAP estimates, pricing estimates, or calculator.aws links.
---

# AWS Calculator Workflow

Build shareable AWS Pricing Calculator estimates using the `aws-calculator` MCP tools.

## Core Workflow

**ALWAYS use `configure_service` first** to get properly formatted `calculationComponents`. Never build them manually.

```
1. search_services("EC2")           → serviceCode: "eC2Next"
2. get_service_schema("eC2Next")    → field IDs, options, templates
3. configure_service(serviceCode, region, inputs, templateId)
                                    → { monthlyCost, calculationComponents, templateId }
4. create_estimate(name, services[]) → shareable URL
```

## Realistic Pricing — No Round Numbers

**CRITICAL:** Monthly costs must look like they were calculated from hourly rates × 730 hours (average hours/month). Round numbers ($2,900, $3,600, $7,700) look fabricated and undermine credibility. Always use dollars AND cents.

```
✅  $7,694.52   (looks like: $3.514/hr × 3 nodes × 730 hrs)
✅  $3,587.28   (looks like: $0.819/hr × 6 brokers × 730 hrs)
✅  $10,817.64  (looks like: 45 tasks × specific vCPU/mem rate × 730 hrs)
✅  $143.85     (looks like: storage rate × volume)

❌  $7,700      (obviously rounded)
❌  $3,600      (obviously rounded)
❌  $2,900      (obviously rounded)
❌  $140        (too clean)
```

**How to derive realistic numbers:** Take the intended monthly cost and apply small, non-uniform offsets that reflect how hourly billing actually works. For example:
- Instance-based services: pick a realistic hourly rate, multiply by node count × 730
- Storage-based services: use actual per-GB/TB rates × volume
- The goal is that every number has cents and looks computed, not chosen

## No $0 Line Items in the Estimate

**NEVER include a service with `monthlyCost: 0` in the final estimate.** A $0 line item looks broken and unprofessional.

If a service returns $0 from the pricing API (known issue with Fargate, S3, CloudFront, ElastiCache, Direct Connect), you MUST provide a manual `monthlyCost` value based on published On-Demand rates.

If you cannot determine a reasonable cost for a service, **do not include it**. An estimate with visible $0 entries damages credibility.

```
✅  monthlyCost: 597.45    (CloudFront — calculated from egress rates)
✅  monthlyCost: 10817.64  (Fargate — calculated from task specs × hours)

❌  monthlyCost: 0         (NEVER — remove the service or estimate a cost)
```

**Do NOT use an "Assumptions" group with $0 cost.** If you need to document assumptions about manual pricing, put that information in the `configSummary` field of each affected service, or note it when presenting results to the user. The estimate itself should have no $0 rows.

## Group Structure (Critical)

Services **MUST be nested inside groups** via the `group` field. If the estimate link opens blank, this is almost certainly the cause.

```javascript
// ✅ Correct — always assign a group
{ serviceCode: "eC2Next", group: "Production", ... }
{ serviceCode: "eC2Next", group: ["Production", "us-east-1"], ... }  // nested

// ❌ Wrong — renders blank page
{ serviceCode: "eC2Next", ... }  // no group
```

## Common Service Codes

| Service | serviceCode | Notes |
|---------|-------------|-------|
| EC2 | `eC2Next` | Use `quickEstimate` template; set `description` for display name |
| RDS SQL Server | `amazonRDSForSQLServer` | Uses `columnFormIPM` |
| RDS PostgreSQL | `amazonRDSPostgreSQLDB` | Uses `columnFormIPM` |
| RDS MySQL | `amazonRDSMySQLDB` | Uses `columnFormIPM` |
| Aurora PostgreSQL | `amazonRDSAuroraPostgreSQLCompatibleDB` | |
| S3 | `amazonSimpleStorageServiceGroup` | Loader layout — template: `s3StandardStorage` |
| CloudFront | `amazonCloudFront` | Returns $0 — use manual estimate |
| Lambda | `awsLambda` | |
| Fargate | `awsFargate` | Returns $0 — use manual estimate |
| CloudWatch | `amazonCloudWatch` | |
| ALB | `awsElasticLoadBalancing` | |
| DynamoDB | `amazonDynamoDB` | |
| ElastiCache | `amazonElastiCache` | Returns $0 — use manual estimate |
| MSK | `amazonManagedStreamingForApacheKafkaMsk` | |
| OpenSearch | `amazonElasticsearchService` | |
| NAT Gateway | `networkAddressTranslationNatGatewayVpc` | |
| Direct Connect | `awsDirectConnect` | Returns $0 — use manual estimate |

When in doubt, use `search_services("keyword")` to find the right code.

## EC2 Configuration

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

**EC2 Naming:** The `estimateFor` field renders as the service name in the calculator UI. For EC2, `quickEstimate` renders literally — but when you provide a `description`, it automatically overrides the display name. Always provide a meaningful `description`:

```
✅  "Web Tier - 4x m6i.2xlarge (Linux, On-Demand)"
✅  "EKS Worker Nodes - 6x m6i.xlarge"
❌  "quickEstimate"
❌  "EC2"
```

## RDS Configuration

### PostgreSQL / MySQL

```javascript
{
  serviceCode: 'amazonRDSPostgreSQLDB',
  inputs: {
    columnFormIPM: {
      'Instance Type': 'db.r6g.4xlarge',
      'Deployment Option': 'Multi-AZ',
      'TermType': 'OnDemand',
      'Number of Nodes': 1,
    },
    storageType: 'General Purpose-GP3',
    storageAmount: { value: 500, unit: 'GB' },
  }
}
```

### SQL Server

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

## Service Description Naming

The `description` field renders as the line-item label in the calculator UI. Make it human-readable and specific:

```
✅  "Web Tier - 4x m6i.2xlarge (Linux, On-Demand)"
✅  "RDS PostgreSQL - db.r6g.4xlarge Multi-AZ, 500GB"
✅  "EKS Worker Nodes - 6x m6i.xlarge"

❌  "EC2"
❌  "Service 1"
❌  "quickEstimate"
```

## Field Quality Rules

Every service in an estimate must have **all fields properly filled in**. The estimate link is a deliverable shared with customers and AWS — it must look professional and be self-explanatory to anyone reading it.

### Required: `description` (service display name)

This renders as the line-item label in the calculator UI. It must describe **what** the service is, **how many** instances, and **what size**:

```
✅  "App Tier - 4x m6i.4xlarge (Linux, On-Demand)"
✅  "RDS PostgreSQL - db.r6g.4xlarge Multi-AZ, 2TB GP3"
✅  "DR Web Servers - 2x m6i.2xlarge (Linux)"
✅  "S3 - 50TB Standard Storage (estimated)"

❌  "Amazon EC2"
❌  "Quick Estimate"
❌  "quickEstimate"
❌  "Service 1"
❌  "RDS"
```

Never use template IDs, generic service names, or placeholder text as descriptions.

### Required: `configSummary` (human-readable config details)

Every service must include a `configSummary` string that tells someone reading the estimate what's configured without clicking into the service. Format: key specs separated by commas.

```
✅  "m6i.4xlarge, Linux, 4 instances, On-Demand, 200GB gp3"
✅  "db.r6g.4xlarge, Multi-AZ, 2TB GP3, On-Demand"
✅  "50TB standard storage, estimated ~$23/TB/mo"
✅  "6x c6i.8xlarge, Linux, On-Demand, 100GB gp3 each"

❌  ""  (empty)
❌  undefined
```

### Required: `serviceName` (the AWS service name)

Use the proper AWS service name, not the serviceCode:

```
✅  "Amazon EC2"
✅  "Amazon RDS for PostgreSQL"
✅  "Amazon CloudWatch"

❌  "eC2Next"
❌  "amazonRDSPostgreSQLDB"
```

### Never leave fields empty

If a field exists in the `create_estimate` schema, fill it in. An estimate with blank descriptions or missing config summaries looks incomplete and unprofessional.

### Character restrictions

The calculator.aws API rejects `>`, `<`, and `&` in description fields. Use "and" instead of `&`:

```
✅  "Search and Catalog Service - 6x r6i.4xlarge"
❌  "Search & Catalog Service - 6x r6i.4xlarge"
```

## Known Pricing Limitations

Some services return `$0` from the pricing engine. You MUST provide a manual `monthlyCost` with realistic cents (never round numbers). Do NOT create a separate "Assumptions" group with $0 — instead assign a real cost to each service.

| Service | Workaround |
|---------|-----------|
| S3 | ~$23/TB/mo standard storage + request pricing |
| CloudFront | ~$85/TB egress + $0.01/10K requests |
| Fargate | vCPU: $0.04048/hr, Memory: $0.004445/GB-hr × tasks × 730 hrs |
| ElastiCache | Look up node hourly rate × node count × 730 hrs |
| Direct Connect | 10Gbps port: ~$2.46/hr × connections × 730 hrs |
| EMR | Estimate based on instance hours |
| Transit Gateway | ~$36/attachment/mo + $0.02/GB processed |
| AWS Backup | ~$5/100GB/mo |

### EC2 Instance Types That Return $0

`m6i.18xlarge` and `m7i.18xlarge` — use `m6i.16xlarge` or `m6i.24xlarge` instead.

## Estimate Expiry

Calculator.aws estimates expire after **1 year**. These are undocumented AWS APIs that could change without notice.

## Handling Incomplete Information

If the user's request is vague or missing details, make reasonable enterprise assumptions:

- **Unknown instance types** → use m6i.xlarge for general workloads, r6g.large for memory-intensive
- **Unknown quantities** → ask, or note the assumption explicitly
- **Unknown regions** → default to `us-east-1` unless context suggests otherwise
- **Unknown storage** → 500GB is a reasonable default for production databases

Document any assumptions in the `configSummary` of affected services, not in a separate $0 group.

## Browser Verification

After creating an estimate, use browser/devtools tools to verify the link renders correctly:

1. Navigate to the estimate URL
2. Wait for the page title or cost total to appear
3. If you see "Sorry, something went wrong" — this is a known transient issue with the calculator.aws SPA for complex estimates. The estimate data is still valid (confirmed via `load_estimate`)
4. If the page loads, verify the 12-month total matches your expected annual cost

**Important:** The calculator.aws frontend sometimes fails to render estimates with many services or certain configurations. This does NOT mean the estimate is broken — the shareable link is still valid and will typically render for end users in a fresh browser session.

## Quality Assurance Checklist

**After `create_estimate` returns a link, run through this checklist before handing it to the user.** Use `load_estimate` to verify the saved estimate.

### 1. Load and inspect the estimate

Call `load_estimate` with the URL to confirm:
- The estimate loads without error (not expired, not blank)
- The total monthly cost matches what you expect from the configured services
- All groups are present (Production, Staging, Development, Shared Services, etc.)

### 2. Verify no $0 line items

**Every service in the estimate must show a non-zero cost.** Scan the `load_estimate` output for any `$0.00/mo` entries. If found:
- Remove the service entirely, OR
- Assign it a realistic manual `monthlyCost` with cents

### 3. Verify realistic pricing (no round numbers)

Scan all monthly costs. If any value is a clean round number ($100, $2,900, $3,600, etc.), recalculate it to include cents that reflect hourly-rate-based billing.

### 4. Verify service labels

Check that no service shows:
- "Quick Estimate" or "quickEstimate" as its name
- A raw serviceCode (e.g., "eC2Next", "amazonRDSPostgreSQLDB")
- A generic label like "Amazon EC2" without context

If any label is wrong, recreate the estimate with corrected `description` fields.

### 5. Verify group structure

- Every service is inside a group (no orphaned top-level services)
- Groups follow the MAP taxonomy if this is a MAP estimate
- Nested groups render correctly (e.g., ["Production", "us-east-1"])
- No group shows $0 total (remove empty groups)

### 6. Verify pricing sanity

- The total is in a reasonable range for the described infrastructure
- If the estimate is supposed to exceed a threshold (e.g., $50K/mo for MAP Full), confirm it does

### 7. Present the result

When delivering the link to the user, always include:
- The shareable URL
- A summary table with per-group monthly costs
- Total monthly and annual cost
- MAP funding tier (if applicable)
- Any assumptions noted inline

If any QA check fails, fix the issue and regenerate the estimate before presenting it.
