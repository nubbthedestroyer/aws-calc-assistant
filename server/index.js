#!/usr/bin/env node
// AWS Calculator Assistant — MCP Server
// Builds shareable AWS Pricing Calculator estimates via undocumented calculator.aws APIs.
// Pricing engine executes the same formulas the AWS Calculator web UI uses.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── API Endpoints ───────────────────────────────────────────────────────────

const API = {
  save: "https://dnd5zrqcec4or.cloudfront.net/Prod/v2/saveAs",
  load: "https://d3knqfixx3sbls.cloudfront.net",
  manifest: "https://d1qsjq9pzbk1k6.cloudfront.net/manifest/en_US.json",
  serviceDef: (code) => `https://d1qsjq9pzbk1k6.cloudfront.net/data/${code}/en_US.json`,
  pricing: (name) => `https://calculator.aws/pricing/2.0/meteredUnitMaps/${name}/USD/current/${name}.json`,
};

// ─── Constants ───────────────────────────────────────────────────────────────

const REGION_NAMES = {
  "us-east-1": "US East (N. Virginia)", "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)", "us-west-2": "US West (Oregon)",
  "af-south-1": "Africa (Cape Town)", "ap-east-1": "Asia Pacific (Hong Kong)",
  "ap-south-1": "Asia Pacific (Mumbai)", "ap-south-2": "Asia Pacific (Hyderabad)",
  "ap-southeast-1": "Asia Pacific (Singapore)", "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-southeast-3": "Asia Pacific (Jakarta)", "ap-southeast-4": "Asia Pacific (Melbourne)",
  "ap-southeast-5": "Asia Pacific (Malaysia)", "ap-southeast-7": "Asia Pacific (Thailand)",
  "ap-northeast-1": "Asia Pacific (Tokyo)", "ap-northeast-2": "Asia Pacific (Seoul)",
  "ap-northeast-3": "Asia Pacific (Osaka)", "ca-central-1": "Canada (Central)",
  "ca-west-1": "Canada West (Calgary)", "eu-central-1": "EU (Frankfurt)",
  "eu-central-2": "EU (Zurich)", "eu-west-1": "EU (Ireland)",
  "eu-west-2": "EU (London)", "eu-west-3": "EU (Paris)",
  "eu-south-1": "EU (Milan)", "eu-south-2": "EU (Spain)",
  "eu-north-1": "EU (Stockholm)", "il-central-1": "Israel (Tel Aviv)",
  "me-south-1": "Middle East (Bahrain)", "me-central-1": "Middle East (UAE)",
  "sa-east-1": "South America (Sao Paulo)", "mx-central-1": "Mexico (Central)",
};

const SERVICE_REDIRECTS = { amazonS3: "amazonSimpleStorageServiceGroup" };

const FILE_SIZE_TO_GB = { KB: 1 / (1024 * 1024), MB: 1 / 1024, GB: 1, TB: 1024 };
const FREQ_TO_MONTH = {
  "per second": 2592000, "per minute": 43200, "per hour": 720, "per day": 30,
  "per week": 30 / 7, "per month": 1, "per year": 1 / 12,
  perSecond: 2592000, perMinute: 43200, perHour: 720, perDay: 30,
  perWeek: 30 / 7, perMonth: 1, perYear: 1 / 12,
  millionPerMonth: 1e6, thousandPerMonth: 1e3, billionPerMonth: 1e9,
  hundredThousandPerMonth: 1e5, millionPerDay: 1e6 * 30,
  thousandPerDay: 1e3 * 30, millionPerHour: 1e6 * 720, thousandPerHour: 1e3 * 720,
};
const DURATION_TO_HOURS = { sec: 1 / 3600, min: 1 / 60, hr: 1, day: 24, week: 168, month: 730 };
const THROUGHPUT_TO_MBPS = { kbps: 1 / 1024, mbps: 1, gbps: 1024 };

// ─── Cache ───────────────────────────────────────────────────────────────────

let manifestCache = null;
const pricingCache = {};

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} fetching ${url}`);
  return r.json();
}

// ─── Group Tree Builder ──────────────────────────────────────────────────────
// Services MUST be nested inside groups (not at top level) or the calculator
// renders a blank page. This builds the recursive structure calculator.aws expects.

function buildGroupTree(groupedSvcs, idGenerator = () => `group-${crypto.randomUUID()}`) {
  const groupsObj = {};
  const makeNode = (name) => ({
    name, services: {}, groups: {},
    groupSubtotal: { monthly: 0, upfront: 0 },
    totalCost: { monthly: 0, upfront: 0 },
  });
  for (const { key, entry, path } of groupedSvcs) {
    let container = { groups: groupsObj };
    for (const segment of path) {
      const existingId = Object.entries(container.groups).find(([, g]) => g.name === segment)?.[0];
      const gid = existingId || idGenerator();
      if (!existingId) container.groups[gid] = makeNode(segment);
      container = container.groups[gid];
    }
    container.services[key] = entry;
  }
  const rollup = (node) => {
    let m = 0, u = 0;
    for (const svc of Object.values(node.services || {})) {
      m += svc.serviceCost?.monthly || 0; u += svc.serviceCost?.upfront || 0;
    }
    for (const child of Object.values(node.groups || {})) {
      const r = rollup(child); m += r.monthly; u += r.upfront;
    }
    node.groupSubtotal = { monthly: m, upfront: u };
    node.totalCost = { monthly: m, upfront: u };
    return { monthly: m, upfront: u };
  };
  for (const node of Object.values(groupsObj)) rollup(node);
  return groupsObj;
}

function normalizeGroupPath(group) {
  if (!group) return [];
  if (Array.isArray(group)) return group.filter(Boolean);
  return [group];
}

// ─── Service Manifest ────────────────────────────────────────────────────────

async function getManifest() {
  if (!manifestCache) {
    manifestCache = fetchJSON(API.manifest).catch(e => { manifestCache = null; throw e; });
  }
  return manifestCache;
}

// ─── Input Extraction ────────────────────────────────────────────────────────
// Recursively extracts input fields from service definition templates.

function extractInputs(def, templateId) {
  const inputs = [];
  function walkComponents(comps) {
    for (const comp of comps || []) {
      if (comp.id) {
        const field = {
          id: comp.id, label: comp.label,
          type: comp.subType || comp.type,
          description: comp.description || "",
          default: comp.defaultValue ?? comp.value ?? comp.defaultDropDownItem ?? null,
          unit: comp.unit || null,
          options: comp.options?.map((o) => ({ label: o.label || o.value, value: o.value || o.id || "" })) || null,
        };
        if (field.type === "frequency" || field.type === "fileSize") {
          if (comp.unitOptions) {
            field.unitOptions = comp.unitOptions;
            field.defaultUnit = comp.unitOptions[0]?.value || comp.unit || null;
            field.format = "value with unit selector";
          } else if (field.unit) {
            field.defaultUnit = field.unit;
            field.format = `value in ${field.unit}`;
          }
        }
        if (field.type === "durationInput" && comp.defaultDuration) field.defaultUnit = comp.defaultDuration;
        if (field.type === "throughput" && comp.defaultThroughput) field.defaultUnit = comp.defaultThroughput;
        if (comp.subType === "pricingStrategy" && comp.radioGroups?.length > 0) {
          const defaultVal = {};
          for (const rg of comp.radioGroups) defaultVal[rg.value] = rg.defaultOption;
          field.default = defaultVal;
          field.radioGroups = comp.radioGroups.map(rg => ({
            label: rg.label, key: rg.value, defaultOption: rg.defaultOption,
            options: rg.options?.map(o => ({ label: o.label, value: o.value })) || [],
          }));
          field.format = "object with keys: " + comp.radioGroups.map(rg => rg.value).join(", ");
        }
        if (comp.subType === "radioTiles" && comp.radioOptions?.length > 0) {
          field.default = comp.defaultSelection || null;
          field.options = comp.radioOptions.map(o => ({ label: o.label, value: o.value, description: o.description }));
        }
        inputs.push(field);
      }
      if (comp.components) walkComponents(comp.components);
    }
  }
  const templates = templateId
    ? (def.templates || []).filter(t => t.id === templateId)
    : (def.templates || []);
  for (const tmpl of templates) {
    for (const card of tmpl.cards || []) {
      walkComponents(card.inputSection?.components);
    }
  }
  return inputs;
}

// ─── Value Resolution ────────────────────────────────────────────────────────

function resolveValue(input, rawValue) {
  if (input.options && typeof rawValue === "string") {
    const match = input.options.find((o) => o.label === rawValue || o.value === rawValue);
    if (match) return match.value;
  }
  return rawValue;
}

function buildComponentValue(input, value) {
  if (!input) return { value };
  if (input.type === "pricingStrategy" && typeof value === "object" && value !== null && !("value" in value)) return value;
  if ((input.type === "frequency" || input.type === "fileSize" || input.type === "durationInput" || input.type === "throughput") && input.defaultUnit) {
    return { value, unit: input.defaultUnit };
  }
  return { value };
}

function buildCalcComponents(inputs, userInputs = {}) {
  const cc = {};
  const inputMap = {};
  for (const inp of inputs) { if (inp.id) inputMap[inp.id] = inp; }

  if (userInputs && Object.keys(userInputs).length > 0) {
    for (const inp of inputs) {
      if (inp.id && inp.default != null && inp.default !== "") cc[inp.id] = buildComponentValue(inp, inp.default);
    }
    for (const [k, v] of Object.entries(userInputs)) {
      const inp = inputMap[k];
      if (inp?.type === "pricingStrategy" && typeof v === "object" && v !== null) {
        cc[k] = "value" in v ? v.value : v;
      } else if (typeof v === "object" && v !== null && "value" in v) {
        const resolved = inp ? resolveValue(inp, v.value) : v.value;
        cc[k] = { ...v, value: resolved };
      } else {
        const resolved = inp ? resolveValue(inp, v) : v;
        cc[k] = buildComponentValue(inp, resolved);
      }
    }
    return cc;
  }

  for (const inp of inputs) {
    if (inp.id && inp.default != null && inp.default !== "") cc[inp.id] = buildComponentValue(inp, inp.default);
  }
  return cc;
}

// ─── Pricing Calculation Engine ──────────────────────────────────────────────

function normalizeValue(subType, raw) {
  if (raw == null) return 0;
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    const rawValue = raw.value;
    const parsed = Number(rawValue);
    const hasNumericValue = Number.isFinite(parsed);
    const v = hasNumericValue ? parsed : rawValue;
    const unit = raw.unit;
    if (subType === "fileSize" && unit && FILE_SIZE_TO_GB[unit] != null && hasNumericValue) return parsed * FILE_SIZE_TO_GB[unit];
    if (subType === "frequency" && unit && hasNumericValue && FREQ_TO_MONTH[unit] != null) return parsed * FREQ_TO_MONTH[unit];
    if (subType === "utilization" && hasNumericValue) return parsed / 100 * 730;
    if (subType === "durationInput" && unit && DURATION_TO_HOURS[unit] != null && hasNumericValue) return parsed * DURATION_TO_HOURS[unit];
    if (subType === "throughput" && unit && THROUGHPUT_TO_MBPS[unit] != null && hasNumericValue) return parsed * THROUGHPUT_TO_MBPS[unit];
    if (subType === "percentInput" && hasNumericValue) return parsed / 100;
    return v;
  }
  if (typeof raw === "number") return (subType === "utilization") ? raw / 100 * 730 : (subType === "percentInput") ? raw / 100 : raw;
  if (typeof raw === "string") { const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : raw; }
  return 0;
}

async function fetchPricingForService(def, regionName, templateId = null) {
  const mappingUrls = {};
  for (const md of def.mappingDefinitions || []) {
    if (md.mappingDefinitionName && md.mappingDefinitionURL) {
      mappingUrls[md.mappingDefinitionName] = `https://calculator.aws/${md.mappingDefinitionURL.replace("[currency]", "USD")}`;
    }
  }

  const mappingDefs = new Set();
  let hasEc2PriceFetcher = false;
  let columnFormIPMDef = null;
  function walkForMappings(comps) {
    for (const c of comps || []) {
      if (c.mappingDefinitionName) mappingDefs.add(c.mappingDefinitionName);
      if (c.subType === "ec2PriceFetcher") hasEc2PriceFetcher = true;
      if (c.subType === "columnFormIPM" && c.mappingDefinitionName) columnFormIPMDef = c.mappingDefinitionName;
      if (c.components) walkForMappings(c.components);
    }
  }
  const templates = templateId ? (def.templates || []).filter((t) => t.id === templateId) : (def.templates || []);
  for (const tmpl of templates) {
    for (const card of tmpl.cards || []) walkForMappings(card.inputSection?.components);
  }

  const result = {};
  await Promise.all([...mappingDefs].map(async (name) => {
    const cacheKey = `${name}__${regionName}`;
    if (pricingCache[cacheKey]) { result[name] = pricingCache[cacheKey]; return; }
    try {
      const url = mappingUrls[name] || API.pricing(name);
      const data = await fetchJSON(url);
      const regionData = data.regions?.[regionName] || {};
      const priceMap = {};
      for (const [unit, info] of Object.entries(regionData)) priceMap[unit] = parseFloat(info.price) || 0;
      pricingCache[cacheKey] = priceMap;
      result[name] = priceMap;
    } catch { result[name] = {}; }
  }));

  if (hasEc2PriceFetcher) {
    const cacheKey = `__ec2__${regionName}`;
    if (pricingCache[cacheKey]) { result.__ec2 = pricingCache[cacheKey]; }
    else {
      try {
        const data = await fetchJSON("https://calculator.aws/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2.json");
        const regionData = data.regions?.[regionName] || {};
        const priceMap = {};
        for (const [unit, info] of Object.entries(regionData)) priceMap[unit] = parseFloat(info.price) || 0;
        pricingCache[cacheKey] = priceMap;
        result.__ec2 = priceMap;
      } catch { result.__ec2 = {}; }
    }
  }

  if (columnFormIPMDef) {
    const ondemandName = columnFormIPMDef.replace(/-calc$/, "-ondemand");
    const ondemandUrl = mappingUrls[ondemandName];
    if (ondemandUrl && !result[ondemandName]) {
      const cacheKey = `${ondemandName}__${regionName}`;
      if (pricingCache[cacheKey]) { result[ondemandName] = pricingCache[cacheKey]; }
      else {
        try {
          const data = await fetchJSON(ondemandUrl);
          const regionData = data.regions?.[regionName] || {};
          const priceMap = {};
          for (const [unit, info] of Object.entries(regionData)) {
            priceMap[unit] = parseFloat(info.price) || 0;
            if (info["Instance Type"]) priceMap[`__attr__${unit}`] = info;
          }
          pricingCache[cacheKey] = priceMap;
          result[ondemandName] = priceMap;
        } catch { result[ondemandName] = {}; }
      }
    }
  }

  return result;
}

function evalDisplayIf(condition, context, pricingByDef) {
  if (!condition) return true;
  if (condition.exists) {
    const e = condition.exists;
    if (e.type === "meteredUnit" && e.mappingDefinitionName) {
      const priceMap = pricingByDef[e.mappingDefinitionName] || {};
      return (priceMap[e.meteredUnit] ?? undefined) !== undefined;
    }
    return true;
  }
  if (condition.and) return condition.and.every(c => evalDisplayIf(c, context, pricingByDef));
  if (condition.or) return condition.or.some(c => evalDisplayIf(c, context, pricingByDef));
  if (condition.not) return !evalDisplayIf(condition.not, context, pricingByDef);
  if (condition["=="]) {
    const parts = condition["=="];
    if (Array.isArray(parts) && parts.length === 2) {
      const left = parts[0]?.type === "component" ? context[parts[0].id] : parts[0];
      return String(left) === String(parts[1]);
    }
  }
  for (const op of [">", "<", ">=", "<="]) {
    if (condition[op]) {
      const parts = condition[op];
      if (Array.isArray(parts) && parts.length === 2) {
        const left = Number(parts[0]?.type === "component" ? context[parts[0].id] : parts[0]) || 0;
        const right = Number(parts[1]) || 0;
        if (op === ">") return left > right;
        if (op === "<") return left < right;
        if (op === ">=") return left >= right;
        if (op === "<=") return left <= right;
      }
    }
  }
  return true;
}

function resolveAllComponents(def, pricingByDef, calculationComponents, templateId = null) {
  const ctx = {};
  for (const [id, raw] of Object.entries(calculationComponents)) ctx[id] = raw;

  const pricingComps = [];
  function walkPricing(comps) {
    for (const c of comps || []) {
      if (c.type === "pricing" || c.subType === "replace" || c.subType === "singlePricePoint" ||
          c.subType === "pricingComboV2" || c.subType === "tieredPricing" ||
          c.subType === "ec2PriceFetcher" || c.subType === "priceSelector" ||
          c.subType === "columnFormIPM" || c.subType === "concatenate" ||
          c.subType === "dataTransferV2") {
        pricingComps.push(c);
      }
      if (c.components) walkPricing(c.components);
    }
  }
  const templates = templateId ? (def.templates || []).filter((t) => t.id === templateId) : (def.templates || []);
  for (const tmpl of templates) {
    for (const card of tmpl.cards || []) walkPricing(card.inputSection?.components);
  }

  const inputDefs = {};
  function walkInputDefs(comps) {
    for (const c of comps || []) { if (c.id) inputDefs[c.id] = c; if (c.components) walkInputDefs(c.components); }
  }
  for (const tmpl of templates) {
    for (const card of tmpl.cards || []) walkInputDefs(card.inputSection?.components);
  }

  for (const [id, raw] of Object.entries(calculationComponents)) {
    const inputDef = inputDefs[id];
    const subType = inputDef?.subType || inputDef?.type || "";
    if (subType === "columnFormIPM" || subType === "pricingStrategy") { ctx[id] = raw; }
    else {
      let resolved = raw;
      if (subType === "frequency" && inputDef?.options && typeof raw === "object" && raw !== null && "unit" in raw) {
        const unitMatch = inputDef.options.find(o => o.label === raw.unit || o.id === raw.unit);
        if (unitMatch && unitMatch.id !== raw.unit) resolved = { ...raw, unit: unitMatch.id };
      }
      ctx[id] = normalizeValue(subType, resolved);
    }
  }

  for (const [id, inputDef] of Object.entries(inputDefs)) {
    if (inputDef.displayIf && id in ctx) {
      if (!evalDisplayIf(inputDef.displayIf, ctx, pricingByDef)) {
        if (typeof ctx[id] === "number") ctx[id] = 0;
      }
    }
  }

  // Resolve columnFormIPM (exports values needed by replace/concatenate)
  for (const c of pricingComps) {
    if (c.subType === "columnFormIPM" && c.id) {
      const rawInput = ctx[c.id];
      const ipmInput = (rawInput && typeof rawInput === "object" && "value" in rawInput && typeof rawInput.value === "object") ? rawInput.value : rawInput;
      const calcId = c.calculationId || {};
      const ondemandName = (c.mappingDefinitionName || "").replace(/-calc$/, "-ondemand");
      const ondemandMap = pricingByDef[ondemandName] || {};
      const instanceType = ipmInput?.["Instance Type"] || ctx.instanceType || "";
      const deployment = ipmInput?.["Deployment Option"] || ctx.deploymentStrategy || "Single-AZ";
      const termType = ipmInput?.["TermType"] || ctx.pricingModel || "OnDemand";
      const nodes = Number(ipmInput?.["Number of Nodes"] || ctx.count || 1);
      for (const row of c.row || []) {
        if (row.exportValueAs && ipmInput?.[row.selectorId] != null) ctx[row.exportValueAs] = ipmInput[row.selectorId];
      }
      if (!ctx.count) ctx.count = nodes;
      if (!ctx.deploymentStrategy) ctx.deploymentStrategy = deployment;
      if (termType === "OnDemand") {
        let hourlyPrice = 0;
        const instLower = instanceType.toLowerCase().replace(".", " ");
        const deplLower = deployment.toLowerCase();
        for (const [key, price] of Object.entries(ondemandMap)) {
          if (key.startsWith("__attr__")) continue;
          const keyLower = key.toLowerCase();
          if (keyLower.includes(instLower) && keyLower.includes(deplLower)) { hourlyPrice = price; break; }
        }
        ctx[calcId.monthly || "monthly_ipm"] = hourlyPrice * 730 * nodes;
        ctx[calcId.upfront || "upfront_ipm"] = 0;
      }
    }
  }

  // Resolve concatenate and replace (two passes for both dependency orders)
  for (let pass = 0; pass < 2; pass++) {
    for (const c of pricingComps) {
      if (c.subType === "concatenate" && c.id) {
        let result = "";
        for (const op of c.operands || []) {
          if ("constant" in op) result += String(op.constant);
          else if (op.variableId) result += String(ctx[op.variableId] ?? "");
        }
        ctx[c.id] = result;
      }
    }
    for (const c of pricingComps) {
      if (c.subType === "replace" && c.id) {
        const inputVal = String(ctx[c.originalId] ?? "");
        let resolved = "";
        for (const r of c.replacements || []) {
          if (String(r.originalString) === inputVal) { resolved = r.replaceString; break; }
        }
        ctx[c.id] = resolved;
      }
    }
  }

  // Resolve dataTransferV2 (tiered outbound pricing)
  for (const c of pricingComps) {
    if (c.subType === "dataTransferV2" && c.id) {
      const priceMap = pricingByDef[c.mappingDefinitionName] || {};
      const rawInput = ctx[c.id];
      const outboundGB = typeof rawInput === "number" ? rawInput :
        (typeof rawInput === "object" && rawInput !== null ? Number(rawInput.outbound || rawInput.value || 0) : Number(rawInput) || 0);
      const tiers = Object.entries(priceMap)
        .filter(([k]) => k.toLowerCase().includes("external outbound") || k.toLowerCase().includes("outbound next") || k.toLowerCase().includes("outbound greater"))
        .sort((a, b) => b[1] - a[1]);
      let cost = 0;
      if (tiers.length > 0) {
        const tierSizes = [10 * 1024, 40 * 1024, 100 * 1024, Infinity];
        let remaining = outboundGB;
        for (let i = 0; i < tiers.length && remaining > 0; i++) {
          const qty = Math.min(remaining, tierSizes[i] || Infinity);
          cost += qty * tiers[i][1]; remaining -= qty;
        }
      }
      ctx[c.id] = cost;
    }
  }

  // Resolve EC2 priceSelector
  const ec2PriceMap = pricingByDef.__ec2 || {};
  for (const c of pricingComps) {
    if (c.subType === "priceSelector" && c.id) {
      const generateFor = c.pricing?.generatePriceFor || [];
      const pricingStrategy = ctx.pricingStrategy;
      const model = typeof pricingStrategy === "object" ? pricingStrategy?.model : pricingStrategy;
      if (generateFor.includes(model) || generateFor.includes("ondemand")) {
        const instanceType = ctx.instanceType;
        const os = ctx.selectedOS || "Linux";
        if (generateFor.includes("ondemand") && model === "ondemand") {
          const key = `OnDemand ${os}-instancetype-${instanceType}`;
          let price = ec2PriceMap[key];
          if (price == null) {
            const keyLower = key.toLowerCase();
            for (const [k, v] of Object.entries(ec2PriceMap)) {
              if (k.toLowerCase() === keyLower) { price = v; break; }
            }
          }
          ctx[c.id] = price ?? 0;
        } else if (!generateFor.includes("ondemand")) { ctx[c.id] = 0; }
      } else { ctx[c.id] = 0; }
    }
  }

  // Resolve pricing lookups
  for (const c of pricingComps) {
    const defName = c.mappingDefinitionName;
    const priceMap = pricingByDef[defName] || {};
    if (c.subType === "singlePricePoint" && c.id) {
      ctx[c.id] = priceMap[c.meteredUnit?.allRegions || ""] ?? 0;
    } else if (c.subType === "pricingComboV2" && c.id) {
      const refId = c.refers?.[0]?.variableId;
      const unit = refId ? (ctx[refId] ?? "") : "";
      ctx[c.id] = typeof unit === "string" ? (priceMap[unit] ?? 0) : 0;
    } else if (c.subType === "tieredPricing" && c.id) {
      const tiers = c.tiers?.allRegions || [];
      const allExactMatch = tiers.every(t => (priceMap[t.meteredUnit] ?? undefined) !== undefined);
      let fallbackPrices = null;
      if (!allExactMatch && Object.keys(priceMap).length > 0) {
        const firstTierName = tiers[0]?.meteredUnit || "";
        const words = firstTierName.replace(/\d+/g, "").trim().split(/\s+/);
        const keyword = words[words.length - 1]?.toLowerCase() || "";
        if (keyword) {
          fallbackPrices = Object.entries(priceMap)
            .filter(([k]) => k.toLowerCase().includes(keyword) && k.toLowerCase().includes("per") && k.toLowerCase().includes("mo"))
            .sort((a, b) => b[1] - a[1]);
        }
      }
      const resolvedTiers = tiers.map((t, i) => ({
        start: t.startOfTier, end: t.endOfTier,
        price: priceMap[t.meteredUnit] ?? (fallbackPrices?.[i]?.[1] ?? 0),
      }));
      ctx[`__tiers__${c.id}`] = resolvedTiers;
    }
  }

  // Auto-resolve request pricing for numeric inputs matching pricing entries
  for (const [id, inputDef] of Object.entries(inputDefs)) {
    if (inputDef.subType !== "numericInput" || !inputDef.label) continue;
    const label = inputDef.label.toLowerCase();
    if (!label.includes("request")) continue;
    for (const [defName, priceMap] of Object.entries(pricingByDef)) {
      if (defName.startsWith("__")) continue;
      for (const [key, price] of Object.entries(priceMap)) {
        if (!key.toLowerCase().includes("request")) continue;
        const inputFirstWord = label.split(/[\s/]/)[0];
        const keyFirstWord = key.split(/[\s/]/)[0];
        if (inputFirstWord === keyFirstWord.toLowerCase()) {
          ctx[`__requestCost__${id}`] = (Number(ctx[id]) || 0) * price;
          break;
        }
      }
    }
  }

  return ctx;
}

// ─── Math Execution ──────────────────────────────────────────────────────────

function executeMathsSection(mathsOps, context, pricingByDef) {
  const priceDisplays = [];
  function getVal(operand) {
    if (operand == null) return 0;
    if (typeof operand === "number") return operand;
    if ("constant" in operand) return Number(operand.constant) || 0;
    if (operand.variableId) return Number(context[operand.variableId]) || 0;
    if (operand.refer) return Number(context[operand.refer]) || 0;
    if (operand.value != null) return Number(operand.value) || 0;
    return 0;
  }
  for (const op of mathsOps || []) {
    for (const comp of op.components || []) {
      if (comp.displayIf && !evalDisplayIf(comp.displayIf, context, pricingByDef)) continue;
      const st = comp.subType || comp.type;
      if (st === "display" || st === "conversionDisplay") continue;
      if (st === "priceDisplay") {
        if (comp.subTotalRefer) priceDisplays.push({ costType: comp.costType || "Monthly", value: Number(context[comp.subTotalRefer]) || 0 });
        continue;
      }
      if (st === "basicMaths" && comp.id) {
        const operands = (comp.operands || []).map(getVal);
        let result = operands[0] ?? 0;
        for (let i = 1; i < operands.length; i++) {
          if (comp.operation === "multiplication") result *= operands[i];
          else if (comp.operation === "addition") result += operands[i];
          else if (comp.operation === "subtraction") result -= operands[i];
          else if (comp.operation === "division") result = operands[i] !== 0 ? result / operands[i] : 0;
          else if (comp.operation === "exponent") { result = Math.pow(result, operands[i]); break; }
        }
        context[comp.id] = result;
      } else if (st === "maxMin" && comp.id) {
        const operands = (comp.operands || []).map(getVal);
        context[comp.id] = comp.operation === "Maximum" ? Math.max(...operands) : Math.min(...operands);
      } else if (st === "rounding" && comp.id) {
        const val = getVal(comp.operands?.[0]);
        const factor = Number(comp.factor) || 1;
        if (comp.method === "roundUp") context[comp.id] = Math.ceil(val / factor) * factor;
        else if (comp.method === "roundDown") context[comp.id] = Math.floor(val / factor) * factor;
        else if (comp.method === "standard") context[comp.id] = Math.round(val / factor) * factor;
        else context[comp.id] = val;
      } else if (st === "tieredPricingMath" && comp.id) {
        const inputVal = Number(context[comp.inputRefer]) || 0;
        const tiers = context[`__tiers__${comp.tieredPricingRefer}`] || [];
        let total = 0, remaining = inputVal;
        for (const tier of tiers) {
          if (remaining <= 0) break;
          const tierSize = tier.end === -1 ? Infinity : tier.end - tier.start;
          total += Math.min(remaining, tierSize) * tier.price;
          remaining -= tierSize;
        }
        context[comp.id] = total;
      } else if (st === "variable" && comp.id) {
        if (comp.refer) context[comp.id] = Number(context[comp.refer]) || 0;
        else if (comp.operands?.length) context[comp.id] = getVal(comp.operands[0]);
      } else if (st === "snapShotMaths" && comp.id) {
        const ops = comp.operands || [];
        const storage = getVal(ops.find(o => o.operand === "ebsStorage"));
        const changed = getVal(ops.find(o => o.operand === "amountSnapShotChanged"));
        const freq = getVal(ops.find(o => o.operand === "snapShotFrequency"));
        const price = getVal(ops.find(o => o.operand === "snapShotPricing"));
        context[comp.id] = (storage + changed * freq) * price;
      }
    }
  }
  return priceDisplays;
}

// ─── Cost Calculation Orchestrators ──────────────────────────────────────────

function computeCostFromPreparedDefinition(def, regionName, userInputs = {}, templateId = null, pricingByDefOverride = null) {
  const inputs = extractInputs(def, templateId);
  const cc = buildCalcComponents(inputs, userInputs);
  const pricingByDef = pricingByDefOverride || {};
  const ctx = resolveAllComponents(def, pricingByDef, cc, templateId);

  let monthly = 0, upfront = 0;
  const tmpl = templateId
    ? (def.templates || []).find((t) => t.id === templateId)
    : (def.templates || [])[0];

  if (tmpl) {
    for (const card of tmpl.cards || []) {
      if (!card.mathsSection) continue;
      if (card.displayIf && !evalDisplayIf(card.displayIf, ctx, pricingByDef)) continue;
      const displays = executeMathsSection(card.mathsSection, ctx, pricingByDef);
      for (const dp of displays) {
        if (dp.costType === "Upfront") upfront += dp.value; else monthly += dp.value;
      }
    }
  }

  for (const [key, val] of Object.entries(ctx)) {
    if (key.startsWith("__requestCost__") && typeof val === "number") monthly += val;
  }

  return { monthly: Math.max(0, monthly), upfront: Math.max(0, upfront), calculationComponents: cc };
}

async function calculateServiceCost(serviceCode, region, userInputs, templateId = null) {
  try {
    const def = await fetchJSON(API.serviceDef(serviceCode));
    const regionName = REGION_NAMES[region] || "US East (N. Virginia)";
    const defs = [];

    if (def.subServices?.length) {
      for (const sub of def.subServices) {
        try { defs.push(await fetchJSON(API.serviceDef(sub.serviceCode))); } catch {}
      }
    }
    if (def.layout === "loader" && Array.isArray(def.templates) && typeof def.templates[0] === "string") {
      const loaderTemplates = templateId ? [templateId] : (def.defaultTemplates || def.templates);
      for (const tmplCode of loaderTemplates) {
        try { defs.push(await fetchJSON(API.serviceDef(tmplCode))); } catch {}
      }
    } else { defs.push(def); }

    let monthly = 0, upfront = 0, rootCC = {};
    for (const d of defs) {
      const subTemplateId = (d.serviceCode === def.serviceCode) ? templateId : null;
      const pricingByDef = await fetchPricingForService(d, regionName, subTemplateId);
      const result = computeCostFromPreparedDefinition(d, regionName, userInputs, subTemplateId, pricingByDef);
      if (Object.keys(rootCC).length === 0) rootCC = result.calculationComponents;
      monthly += result.monthly; upfront += result.upfront;
    }

    return { monthly: Math.max(0, monthly), upfront: Math.max(0, upfront), calculationComponents: rootCC };
  } catch { return null; }
}

// ─── MCP Server & Tools ──────────────────────────────────────────────────────

const server = new McpServer({ name: "aws-calculator-assistant", version: "1.0.0" });

server.tool(
  "search_services",
  "Search AWS services available in the pricing calculator by keyword. Returns service codes needed for other tools.",
  { query: z.string().describe("Search keyword (e.g. 'EC2', 'Lambda', 'CloudFront')") },
  async ({ query }) => {
    const manifest = await getManifest();
    const q = query.toLowerCase();
    const matches = manifest.awsServices
      .filter((s) => `${s.name} ${s.serviceCode} ${(s.searchKeywords || []).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 15)
      .map((s) => ({ name: s.name.trim(), serviceCode: s.serviceCode, slug: s.slug || null, regions: s.regions?.length || 0 }));
    return { content: [{ type: "text", text: JSON.stringify(matches, null, 2) }] };
  }
);

server.tool(
  "get_service_schema",
  `Get the input schema for a specific AWS service. Returns fields you can set when configuring an estimate.
Use the serviceCode from search_services. For dropdown fields, use the 'value' property from options (not the 'label').
For frequency/fileSize fields, provide { value: number, unit: "unitString" }.`,
  { serviceCode: z.string().describe("Service code (e.g. 'amazonCloudFront', 'eC2Next')") },
  async ({ serviceCode }) => {
    const def = await fetchJSON(API.serviceDef(serviceCode));
    let inputs = extractInputs(def);
    const result = { serviceName: def.serviceName, serviceCode: def.serviceCode, version: def.version, layout: def.layout, templates: [], subServices: [], inputs };

    if (def.layout === "loader" && Array.isArray(def.templates) && typeof def.templates[0] === "string") {
      result.templates = def.templates.map(id => ({ id, title: id }));
      result.loaderTemplates = [];
      for (const tmplCode of def.templates) {
        try {
          const tmplDef = await fetchJSON(API.serviceDef(tmplCode));
          result.loaderTemplates.push({ serviceCode: tmplCode, serviceName: tmplDef.serviceName, inputs: extractInputs(tmplDef) });
        } catch {}
      }
      if (inputs.length === 0 && result.loaderTemplates.length > 0) {
        const defaultCode = def.defaultTemplates?.[0];
        result.inputs = (result.loaderTemplates.find(t => t.serviceCode === defaultCode) || result.loaderTemplates[0]).inputs;
      }
    } else {
      result.templates = (def.templates || []).map(t => ({ id: t.id, title: t.title }));
    }

    if (def.layout === "loader" && result.inputs.length === 0) {
      result.note = "This service uses dynamic loading. calculationComponents cannot be auto-populated.";
    }

    if (def.subServices?.length) {
      for (const sub of def.subServices) {
        try {
          const subDef = await fetchJSON(API.serviceDef(sub.serviceCode));
          result.subServices.push({ serviceCode: sub.serviceCode, serviceName: subDef.serviceName, version: subDef.version, inputs: extractInputs(subDef) });
        } catch {
          result.subServices.push({ serviceCode: sub.serviceCode, serviceName: sub.serviceCode, version: "0.0.1", inputs: [] });
        }
      }
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "configure_service",
  `Configure an AWS service with specific parameters and get the calculated monthly cost.
Fetches real-time AWS pricing data. Pass input field values from get_service_schema as 'inputs'.
Returns calculated costs and formatted calculationComponents ready for create_estimate.`,
  {
    serviceCode: z.string().describe("Service code from search_services"),
    region: z.string().default("us-east-1").describe("AWS region code"),
    templateId: z.string().optional().describe("Optional template ID for services with multiple templates"),
    inputs: z.record(z.any()).default({}).describe("Input field values keyed by field ID from get_service_schema"),
  },
  async ({ serviceCode, region, templateId, inputs }) => {
    const def = await fetchJSON(API.serviceDef(serviceCode));
    let activeTemplateId = templateId || def.templates?.[0]?.id || null;
    let allInputs = extractInputs(def, activeTemplateId);

    if (def.layout === "loader" && Array.isArray(def.templates) && typeof def.templates[0] === "string") {
      const tmplCode = templateId || def.defaultTemplates?.[0] || def.templates[0];
      activeTemplateId = tmplCode;
      try { allInputs = extractInputs(await fetchJSON(API.serviceDef(tmplCode))); } catch {}
    }

    const cc = buildCalcComponents(allInputs, inputs);
    const result = await calculateServiceCost(serviceCode, region, inputs, activeTemplateId);

    const response = {
      serviceName: def.serviceName, serviceCode: def.serviceCode, region,
      monthlyCost: result?.monthly ?? 0, upfrontCost: result?.upfront ?? 0,
      calculationComponents: result?.calculationComponents || cc,
      summary: `${def.serviceName} (${REGION_NAMES[region] || region}): $${(result?.monthly ?? 0).toFixed(2)}/mo`,
    };
    if (activeTemplateId) response.templateId = activeTemplateId;

    return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
  }
);

server.tool(
  "create_estimate",
  `Create an AWS Pricing Calculator estimate and return a shareable, editable link.
Each service needs: serviceCode, region, serviceName. monthlyCost is auto-calculated if 0.
Provide calculationComponents for editable estimates. Use 'group' to organize services.`,
  {
    name: z.string().describe("Estimate name"),
    services: z.array(z.object({
      serviceCode: z.string().describe("Service code from search_services"),
      region: z.string().default("us-east-1").describe("AWS region code"),
      regionName: z.string().optional().describe("Human-readable region name"),
      serviceName: z.string().describe("Display name (e.g. 'Amazon EC2')"),
      description: z.string().optional().describe("Service description/notes"),
      monthlyCost: z.number().default(0).describe("Monthly cost in USD (auto-calculated if 0)"),
      upfrontCost: z.number().default(0).describe("Upfront cost in USD"),
      configSummary: z.string().optional().describe("Brief config summary"),
      calculationComponents: z.record(z.any()).optional().describe("Input params from get_service_schema"),
      templateId: z.string().optional().describe("Template ID for the service"),
      group: z.union([z.string(), z.array(z.string())]).optional().describe("Group name or nested path array"),
    })).describe("Array of services to include"),
  },
  async ({ name, services }) => {
    const svcMap = {};
    const groupedSvcs = [];
    let totalMonthly = 0, totalUpfront = 0;

    for (const svc of services) {
      const key = `${svc.serviceCode}-${crypto.randomUUID()}`;
      let cc = {};
      let serviceCode = svc.serviceCode;
      const redirectedCode = SERVICE_REDIRECTS[serviceCode];
      if (redirectedCode) serviceCode = redirectedCode;
      let version = "0.0.1", estimateFor = serviceCode, subServices = undefined;
      let templateHint = svc.templateId || null;
      let templateId = null;
      let inputs = [];

      try {
        const def = await fetchJSON(API.serviceDef(serviceCode));
        version = def.version || version;
        if (def.layout === "loader" && def.templates?.length > 0 && typeof def.templates[0] === "string") {
          const subCode = templateHint || def.defaultTemplates?.[0] || def.templates[0];
          try {
            const subDef = await fetchJSON(API.serviceDef(subCode));
            templateId = subDef.templates?.[0]?.id || null;
            serviceCode = subCode; version = subDef.version || version;
          } catch { templateId = null; }
        } else if (def.templates?.length > 0) {
          const match = templateHint && def.templates.find(t => t.id === templateHint);
          templateId = match ? match.id : def.templates[0].id || null;
        }
        estimateFor = templateId || serviceCode;
        inputs = extractInputs(def, templateId);
        if (inputs.length === 0 && def.layout === "loader" && serviceCode !== svc.serviceCode) {
          try { inputs = extractInputs(await fetchJSON(API.serviceDef(serviceCode)), templateId); } catch {}
        }

        if (def.subServices?.length) {
          subServices = [];
          for (const sub of def.subServices) {
            try {
              const subDef = await fetchJSON(API.serviceDef(sub.serviceCode));
              const subTemplateId = subDef.templates?.[0]?.id || null;
              subServices.push({
                serviceCode: sub.serviceCode, region: svc.region, estimateFor: subTemplateId || sub.serviceCode,
                version: subDef.version || "0.0.1", description: null,
                calculationComponents: buildCalcComponents(extractInputs(subDef)),
                serviceCost: { monthly: 0, upfront: 0 },
              });
            } catch {
              subServices.push({
                serviceCode: sub.serviceCode, region: svc.region, estimateFor: sub.serviceCode,
                version: "0.0.1", description: null, calculationComponents: {},
                serviceCost: { monthly: 0, upfront: 0 },
              });
            }
          }
        }
        cc = buildCalcComponents(inputs, svc.calculationComponents || {});
      } catch {
        if (svc.calculationComponents) {
          for (const [k, v] of Object.entries(svc.calculationComponents)) {
            cc[k] = typeof v === "object" && v !== null && "value" in v ? v : { value: v };
          }
        }
      }

      let monthlyCost = svc.monthlyCost || 0;
      let upfrontCost = svc.upfrontCost || 0;
      if (monthlyCost === 0) {
        const calcResult = await calculateServiceCost(svc.serviceCode, svc.region, svc.calculationComponents || {}, svc.templateId || templateHint);
        if (calcResult) { monthlyCost = calcResult.monthly; upfrontCost = upfrontCost || calcResult.upfront; }
      }

      const entry = {
        version, serviceCode, estimateFor, region: svc.region,
        description: svc.description || null, calculationComponents: cc,
        serviceCost: { monthly: monthlyCost, upfront: upfrontCost },
        serviceName: svc.serviceName,
        regionName: svc.regionName || REGION_NAMES[svc.region] || svc.region,
        configSummary: svc.configSummary || "",
      };
      if (templateId) entry.templateId = templateId;
      if (subServices) entry.subServices = subServices;
      totalMonthly += monthlyCost; totalUpfront += upfrontCost;

      const path = normalizeGroupPath(svc.group);
      if (path.length > 0) groupedSvcs.push({ key, entry, path });
      else svcMap[key] = entry;
    }

    const groupsObj = buildGroupTree(groupedSvcs);

    const payload = {
      name, services: svcMap, groups: groupsObj,
      groupSubtotal: { monthly: totalMonthly, upfront: totalUpfront },
      totalCost: { monthly: totalMonthly, upfront: totalUpfront },
      support: {},
      metaData: { locale: "en_US", currency: "USD", createdOn: new Date().toISOString(), source: "calculator-platform" },
    };

    // Save with fallback: strip calculationComponents if API rejects them
    let resp = await fetch(API.save, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    let respText = await resp.text();
    let warnings = [];

    if (!resp.ok) {
      const stripSvc = (svc) => { svc.calculationComponents = {}; if (svc.subServices) for (const sub of svc.subServices) sub.calculationComponents = {}; };
      const stripNode = (node) => { for (const svc of Object.values(node.services || {})) stripSvc(svc); for (const child of Object.values(node.groups || {})) stripNode(child); };
      for (const svc of Object.values(payload.services)) stripSvc(svc);
      for (const node of Object.values(payload.groups || {})) stripNode(node);

      const retryResp = await fetch(API.save, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const retryText = await retryResp.text();
      if (!retryResp.ok) throw new Error(`Failed to save estimate: ${resp.status} ${respText}. Retry: ${retryResp.status} ${retryText}`);
      warnings.push("calculationComponents were stripped (API rejected them). Estimate saved but not fully editable.");
      resp = retryResp; respText = retryText;
    }

    const result = JSON.parse(respText);
    if (result.statusCode !== 201 || !result.body) throw new Error(`Unexpected response: ${respText}`);
    const body = JSON.parse(result.body);
    if (!body.savedKey) throw new Error(`No savedKey: ${JSON.stringify(body)}`);

    const url = `https://calculator.aws/#/estimate?id=${body.savedKey}`;
    const output = [
      `Estimate "${name}" saved.`, `Link: ${url}`,
      `Monthly: $${totalMonthly.toFixed(2)} | Upfront: $${totalUpfront.toFixed(2)} | 12-month: $${(totalMonthly * 12 + totalUpfront).toFixed(2)}`,
      `Services: ${services.length}`,
    ];
    if (Object.keys(groupsObj).length > 0) {
      const listGroups = (nodes, prefix = "") => {
        const lines = [];
        for (const g of Object.values(nodes)) { lines.push(`${prefix}${g.name} ($${g.groupSubtotal.monthly.toFixed(2)}/mo)`); lines.push(...listGroups(g.groups || {}, prefix + "  ")); }
        return lines;
      };
      output.push("", "Groups:", ...listGroups(groupsObj, "  "));
    }
    if (warnings.length > 0) output.push("", ...warnings);

    return { content: [{ type: "text", text: output.join("\n") }] };
  }
);

server.tool(
  "load_estimate",
  "Load an existing AWS Pricing Calculator estimate from a shareable link or estimate ID.",
  { estimateId: z.string().describe("Estimate ID or full URL") },
  async ({ estimateId }) => {
    const match = estimateId.match(/id=([a-zA-Z0-9-]+)/);
    const id = match ? match[1] : estimateId;
    let data;
    try {
      const resp = await fetch(`${API.load}/${id}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (text.trim().startsWith('<')) throw new Error('Estimate not found or access denied');
      data = JSON.parse(text);
    } catch (e) { throw new Error(`Failed to load estimate '${id}': ${e.message}`); }

    const services = Object.values(data.services || {}).map((s) => ({
      serviceName: s.serviceName, serviceCode: s.serviceCode, region: s.region,
      monthlyCost: s.serviceCost?.monthly || 0, hasComponents: Object.keys(s.calculationComponents || {}).length > 0,
    }));

    const summary = [
      `Estimate: ${data.name}`,
      `Monthly: $${data.totalCost?.monthly?.toFixed(2)} | Upfront: $${data.totalCost?.upfront?.toFixed(2)}`,
      `Created: ${data.metaData?.createdOn}`, "",
      "Services:",
      ...services.map((s) => `  ${s.serviceName} (${s.region}): $${s.monthlyCost.toFixed(2)}/mo [${s.hasComponents ? "editable" : "no config data"}]`),
    ].join("\n");

    return { content: [{ type: "text", text: summary }, { type: "text", text: "\nFull data:\n" + JSON.stringify(data, null, 2) }] };
  }
);

// ─── Exports for direct use & testing ────────────────────────────────────────

export {
  extractInputs, buildCalcComponents, normalizeValue, evalDisplayIf,
  executeMathsSection, calculateServiceCost, buildGroupTree, normalizeGroupPath,
  API, REGION_NAMES,
};

// ─── Start server when run directly ──────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
