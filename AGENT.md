# AWS Calculator Assistant — Agent Guide

This tool builds shareable [AWS Pricing Calculator](https://calculator.aws/) estimates via MCP tools. The primary use case is creating MAP (Migration Acceleration Program) funding estimates from customer discovery data.

## Setup

Before using the MCP tools, ensure the server is running:

**Docker (recommended):**
```bash
docker build -t aws-calculator-mcp .
```

**Node.js fallback:**
```bash
cd server && npm install
```

The `.kiro/settings/mcp.json` and `.kiro/agents/aws-calculator.json` configure this automatically when the project is open in Kiro.

---

## How to Approach an Estimate Request

### 1. Gather context before touching any tools

Ask for or look for:
- Customer name and date (for estimate naming)
- AWS region(s)
- Environment breakdown (Prod, DR, Dev, etc.)
- Compute: instance types, quantities, OS
- Database: engine, instance class, deployment option (Multi-AZ?), storage
- Any other services mentioned (load balancers, CDN, storage, monitoring)

If given call notes, a discovery questionnaire, or an architecture diagram — read it fully before starting. Don't start configuring services until you have a clear picture of the environment.

### 2. Name the estimate correctly

Format: `[Customer Name] - AWS MAP Estimate - [YYYY-MM]`

Example: `Acme Corp - AWS MAP Estimate - 2026-06`

This URL gets shared with AWS and the customer. A vague name like "Test" or "My Estimate" looks unprofessional.

### 3. Configure every service before creating the estimate

Always call `configure_service` for each service to get real pricing and properly formatted `calculationComponents`. Never guess or hardcode costs — except for services that return $0 (see Known Limitations below).

### 4. Group services by environment

Every service needs a `group` field. Use this standard taxonomy:

| Group | Include |
|-------|---------|
| `Production` | All prod workloads — this drives MAP ARR |
| `Disaster Recovery` | DR/standby — typically 50–70% of prod cost |
| `Pre-Production` | Staging/UAT if it runs continuously |
| `Development` | Dev/test |
| `Shared Services` | Transit Gateway, WAF, GuardDuty, Route 53, CloudWatch |
| `Assumptions` | Services estimated manually (see below) |

### 5. Present the result

After `create_estimate` returns a link, summarize:
- The shareable URL
- Monthly and annual totals
- Per-group breakdown
- Which MAP funding tier the ARR falls into (see below)
- Any assumptions or $0-priced services

---

## MAP Funding Tiers

| Annual Run-Rate | Tier | Credits |
|---|---|---|
| < $100K/yr | MAP Lite | 15% |
| $100K–$500K/yr | Standard MAP | 15–20% |
| > $500K/yr | Full MAP | up to 25% |

If the estimate is below ~$8,300/mo ($100K/yr), flag it. The customer may need to expand scope or may only qualify for MAP Lite.

---

## Known Limitations & Workarounds

### Services that return $0

These services don't price correctly through the engine. Include them with a manual `monthlyCost` and document in an `Assumptions` group:

| Service | Workaround |
|---------|-----------|
| S3 | Estimate: ~$23/TB/mo standard storage |
| CloudFront | Estimate: ~$85/TB egress + $0.01/10K requests |
| Fargate | Estimate based on vCPU/memory hours |
| EMR | Estimate based on instance hours |
| Transit Gateway | ~$36/attachment/mo + $0.02/GB processed |
| AWS Backup | ~$5/100GB/mo |

### EC2 instance types that return $0

`m6i.18xlarge` and `m7i.18xlarge` — use `m6i.16xlarge` or `m6i.24xlarge` instead.

### Blank estimate page

If the calculator.aws link opens blank, services are missing their `group` field. Every service must be assigned to a group.

### EC2 display name

The `estimateFor` field renders as the service label in the calculator UI. For EC2, `quickEstimate` renders literally — set `description` to something meaningful like `"Web Tier - 4x m6i.2xlarge (Linux)"`.

### RDS configuration

RDS services use `columnFormIPM` for instance configuration, not individual fields. Pass it as a nested object:

```javascript
columnFormIPM: {
  'Instance Type': 'db.r6g.2xlarge',
  'Deployment Option': 'Multi-AZ',
  'TermType': 'OnDemand',
  'Number of Nodes': 1,
}
```

---

## Handling Incomplete Information

If the customer's notes are vague or missing details, make reasonable enterprise assumptions and document them clearly:

- **Unknown instance types** → use a common equivalent (m6i.xlarge for general workloads, r6g.large for memory-intensive)
- **Unknown quantities** → ask, or note the assumption explicitly
- **Unknown regions** → default to `us-east-1` unless context suggests otherwise
- **Unknown storage** → 500GB is a reasonable default for production databases

Always add an `Assumptions` group listing anything estimated rather than specified.

---

## What a Complete MAP Estimate Covers

Don't stop at just EC2 and RDS. A complete estimate includes:

- [ ] Compute (EC2, ECS, EKS workers)
- [ ] Databases (RDS, Aurora, ElastiCache, DynamoDB)
- [ ] Storage (S3, EBS — usually covered by EC2 config)
- [ ] Networking (ALB/NLB, Transit Gateway, NAT Gateway)
- [ ] CDN (CloudFront)
- [ ] Security (WAF, Shield, GuardDuty)
- [ ] Observability (CloudWatch, X-Ray)
- [ ] DR environment (scaled-down copy of production)
- [ ] Backup (AWS Backup or RDS automated backups)

---

## Quick Reference: Common Service Codes

| Service | serviceCode |
|---------|-------------|
| EC2 | `eC2Next` |
| RDS PostgreSQL | `amazonRDSPostgreSQLDB` |
| RDS SQL Server | `amazonRDSForSQLServer` |
| RDS MySQL | `amazonRDSMySQLDB` |
| Aurora PostgreSQL | `amazonRDSAuroraPostgreSQLCompatibleDB` |
| S3 | `amazonSimpleStorageServiceGroup` |
| CloudFront | `amazonCloudFront` |
| Lambda | `awsLambda` |
| Fargate | `awsFargate` |
| CloudWatch | `amazonCloudWatch` |
| ALB | `awsElasticLoadBalancing` |
| DynamoDB | `amazonDynamoDB` |
| ElastiCache | `amazonElastiCache` |

When in doubt, use `search_services("keyword")` to find the right code.
