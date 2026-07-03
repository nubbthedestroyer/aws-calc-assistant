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
| ElastiCache | `amazonElastiCache` | |

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

Some services return `$0` from the pricing engine. Include them with manual `monthlyCost` values and document in an Assumptions group:

| Service | Workaround |
|---------|-----------|
| S3 | Estimate: ~$23/TB/mo standard storage |
| CloudFront | Estimate: ~$85/TB egress + $0.01/10K requests |
| Fargate | Estimate based on vCPU/memory hours |
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

Always add an `Assumptions` group listing anything estimated rather than specified.

## Quality Assurance Checklist

**After `create_estimate` returns a link, run through this checklist before handing it to the user.** Use `load_estimate` to verify the saved estimate.

### 1. Load and inspect the estimate

Call `load_estimate` with the URL to confirm:
- The estimate loads without error (not expired, not blank)
- The total monthly cost matches what you expect from the configured services
- All groups are present (Production, DR, Shared Services, etc.)

### 2. Verify service labels

Check that no service shows:
- "Quick Estimate" or "quickEstimate" as its name
- A raw serviceCode (e.g., "eC2Next", "amazonRDSPostgreSQLDB")
- A generic label like "Amazon EC2" without context — every EC2 entry should have a descriptive name like "Web Tier - 4x m6i.4xlarge"

If any label is wrong, recreate the estimate with corrected `description` fields.

### 3. Verify group structure

- Every service is inside a group (no orphaned top-level services)
- Groups follow the MAP taxonomy if this is a MAP estimate
- Nested groups render correctly (e.g., ["Production", "us-east-1"])

### 4. Verify pricing sanity

- No service shows $0.00 unless it's a known $0-priced service (S3, Fargate, etc.) documented in an Assumptions group
- The total is in a reasonable range for the described infrastructure
- If the estimate is supposed to exceed a threshold (e.g., $50K/mo), confirm it does

### 5. Verify completeness

- All services requested by the user are present in the estimate
- Config summaries are populated for every service
- The estimate name follows the `[Customer] - AWS MAP Estimate - [YYYY-MM]` format if it's a MAP estimate
- An Assumptions group exists if any services have manually estimated costs

### 6. Present the result

When delivering the link to the user, always include:
- The shareable URL
- A summary table with per-group monthly costs
- Total monthly and annual cost
- MAP funding tier (if applicable)
- Any assumptions or limitations noted

If any QA check fails, fix the issue and regenerate the estimate before presenting it.
