---
name: field-quality-rules
description: Pricing realism rules, field quality standards, and QA checklist for professional AWS Calculator estimates.
---

# Field Quality Rules & QA Checklist

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

**How to derive realistic numbers:** Take the intended monthly cost and apply small, non-uniform offsets that reflect how hourly billing actually works:
- Instance-based services: pick a realistic hourly rate, multiply by node count × 730
- Storage-based services: use actual per-GB/TB rates × volume
- The goal is that every number has cents and looks computed, not chosen

## No $0 Line Items in the Estimate

**NEVER include a service with `monthlyCost: 0` in the final estimate.** A $0 line item looks broken and unprofessional.

If a service returns $0 from the pricing API (known issue with Fargate, S3, CloudFront, ElastiCache, Direct Connect), you MUST provide a manual `monthlyCost` value based on published On-Demand rates.

If you cannot determine a reasonable cost for a service, **do not include it**. An estimate with visible $0 entries damages credibility.

**Do NOT use an "Assumptions" group with $0 cost.** If you need to document assumptions about manual pricing, put that information in the `configSummary` field of each affected service.

## Field Quality Standards

### Required: `description` (service display name)

This renders as the line-item label in the calculator UI. It must describe **what** the service is, **how many** instances, and **what size**:

```
✅  "App Tier - 4x m6i.4xlarge (Linux, On-Demand)"
✅  "RDS PostgreSQL - db.r6g.4xlarge Multi-AZ, 2TB GP3"
✅  "DR Web Servers - 2x m6i.2xlarge (Linux)"

❌  "Amazon EC2"
❌  "Quick Estimate" / "quickEstimate"
❌  "Service 1"
```

### Required: `configSummary`

Every service must include a `configSummary` string with key specs:

```
✅  "m6i.4xlarge, Linux, 4 instances, On-Demand, 200GB gp3"
✅  "db.r6g.4xlarge, Multi-AZ, 2TB GP3, On-Demand"
```

### Required: `serviceName`

Use the proper AWS service name, not the serviceCode:

```
✅  "Amazon EC2"
❌  "eC2Next"
```

### Character restrictions

The calculator.aws API rejects `>`, `<`, and `&` in description fields. Use "and" instead of `&`.

## Quality Assurance Checklist

**Run this after every `create_estimate`.** Use `load_estimate` to verify.

### 1. Load and inspect
- Estimate loads without error
- Total monthly cost matches expectations
- All groups are present

### 2. No $0 line items
- Every service shows non-zero cost
- If any $0 found: remove or assign realistic manual cost

### 3. Realistic pricing
- No clean round numbers ($100, $2,900, $7,700)
- All costs include cents reflecting hourly-rate billing

### 4. Service labels
- No "Quick Estimate" or raw serviceCodes as names
- Every label is descriptive and human-readable

### 5. Group structure
- Every service inside a group
- No orphaned top-level services
- No $0 group totals

### 6. Pricing sanity
- Total is reasonable for described infrastructure
- If targeting a threshold (MAP tier), confirm it's met

### 7. Present the result
Include: shareable URL, per-group costs, total monthly/annual, MAP tier (if applicable), assumptions inline
