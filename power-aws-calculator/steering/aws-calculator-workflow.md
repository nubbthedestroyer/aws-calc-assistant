# AWS Calculator Workflow

Build shareable AWS Pricing Calculator estimates using the `aws-calculator` MCP tools.

## Core Workflow

**ALWAYS use `configure_service` first** to get properly formatted `calculationComponents`. Never build them manually.

```
1. search_services("EC2")           → serviceCode: "eC2Next"
2. get_service_schema("eC2Next")    → field IDs, options, templates
3. configure_service(serviceCode, inputs, templateId)
                                    → { monthlyCost, calculationComponents, templateId }
4. create_estimate(name, services[]) → shareable URL
```

## Group Structure (Critical)

Services **MUST be nested inside groups**. If the estimate link opens blank, this is the cause.

```javascript
// ✅ Correct
{ serviceCode: "eC2Next", group: "Production", ... }
{ serviceCode: "eC2Next", group: ["Production", "us-east-1"], ... }  // nested

// ❌ Wrong — renders blank
{ serviceCode: "eC2Next", ... }  // no group
```

## Common Service Codes

| Service | serviceCode | Notes |
|---------|-------------|-------|
| EC2 | `eC2Next` | Set `estimateFor` to description, not template ID |
| RDS SQL Server | `amazonRDSForSQLServer` | Uses `columnFormIPM` |
| RDS PostgreSQL | `amazonRDSPostgreSQLDB` | Uses `columnFormIPM` |
| S3 | `amazonSimpleStorageServiceGroup` | Loader layout — template: `s3StandardStorage` |
| CloudFront | `amazonCloudFront` | Returns $0 — use manual estimate |
| Lambda | `awsLambda` | |
| Fargate | `awsFargate` | Returns $0 — use manual estimate |
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

**EC2 Naming:** The `estimateFor` field renders as the service name in the UI. For EC2, `quickEstimate` renders literally — set `estimateFor` to a meaningful description instead.

## RDS Inputs

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

## Known Pricing Limitations

Some services return `$0` from the pricing engine. Include them with manual `monthlyCost` estimates and document in an Assumptions group:
- S3, Fargate, EMR, Transit Gateway, AWS Backup
- EC2 `m6i.18xlarge` / `m7i.18xlarge` — use 16xlarge or 24xlarge instead

## Estimate Expiry

Calculator.aws estimates expire after **1 year**. These are undocumented AWS APIs that could change without notice.
