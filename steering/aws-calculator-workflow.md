---
name: aws-calculator-workflow
description: Build shareable AWS Pricing Calculator estimates with grouped services and real-time pricing. Use when asked to create AWS cost estimates, pricing estimates, or calculator.aws links.
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
| EC2 | `eC2Next` | Use `quickEstimate` template |
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
| NAT Gateway | `networkAddressTranslationNatGatewayVpc` | |

When in doubt, use `search_services("keyword")` to find the right code.

## EC2 Configuration

```javascript
{
  serviceCode: 'eC2Next',
  templateId: 'quickEstimate',
  inputs: {
    instanceType: 'm6i.8xlarge',
    selectedOS: 'linux',
    quantity: 2,
    pricingStrategy: { model: 'ondemand' },
    storageAmount: { value: 100, unit: 'GB' },
  }
}
```

## RDS Configuration

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

Some services return `$0` from the pricing engine. Provide a manual `monthlyCost` override:

| Service | Workaround |
|---------|-----------|
| S3 | ~$23/TB/mo standard storage + request pricing |
| CloudFront | ~$85/TB egress + $0.01/10K requests |
| Fargate | vCPU: $0.04048/hr, Memory: $0.004445/GB-hr × tasks × 730 hrs |
| ElastiCache | Look up node hourly rate × node count × 730 hrs |
| Direct Connect | 10Gbps port: ~$2.46/hr × connections × 730 hrs |

### EC2 Instance Types That Return $0

`m6i.18xlarge` and `m7i.18xlarge` — use `m6i.16xlarge` or `m6i.24xlarge` instead.

## Estimate Expiry

Calculator.aws estimates expire after **1 year**. These are undocumented AWS APIs.

## Extended Guidance

For MAP funding best practices, field quality rules, and QA checklists, see the private steering files. If they are not available, request access to the `aws-calc-steering-private` repository.
