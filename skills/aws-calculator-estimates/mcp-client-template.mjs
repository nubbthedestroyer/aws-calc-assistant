#!/usr/bin/env node
// Reusable MCP client for the AWS Calculator Assistant server.
// Usage: Import createMCPClient() or run directly to test connection.
//
// IMPORTANT: On macOS, use /private/tmp/ not /tmp/ for server paths.
// The import.meta.url guard in index.js fails with symlinked /tmp paths.

import { spawn } from 'child_process';
import { realpath } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SERVER_PATH = join(__dirname, '..', '..', 'server', 'index.js');
const SAVE_API = 'https://dnd5zrqcec4or.cloudfront.net/Prod/v2/saveAs';
const SERVICE_DEF_API = (code) => `https://d1qsjq9pzbk1k6.cloudfront.net/data/${code}/en_US.json`;

const REGION_NAMES = {
  'us-east-1': 'US East (N. Virginia)', 'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)', 'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'EU (Ireland)', 'eu-central-1': 'EU (Frankfurt)',
};

export function createMCPClient(serverPath) {
  const proc = spawn('node', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  let nextId = 1;
  const pending = new Map();

  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {}
    }
  });
  proc.stderr.on('data', () => {});

  function call(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (msg) => {
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`Timeout for ${method} (id=${id})`)); }
      }, 120000);
    });
  }

  async function init() {
    await call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'aws-calc-client', version: '1.0.0' },
    });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  }

  async function callTool(name, args) {
    const result = await call('tools/call', { name, arguments: args });
    return (result.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  }

  function close() { proc.kill(); }
  return { init, callTool, close };
}

export async function configureService(client, serviceCode, inputs, templateId, region = 'us-east-1') {
  const args = { serviceCode, region, inputs };
  if (templateId) args.templateId = templateId;
  return JSON.parse(await client.callTool('configure_service', args));
}

export async function buildServiceEntry(client, serviceCode, inputs, description, configSummary, templateId, region = 'us-east-1') {
  const cfg = await configureService(client, serviceCode, inputs, templateId, region);
  const defResp = await fetch(SERVICE_DEF_API(serviceCode));
  const def = await defResp.json();
  let resolvedCode = serviceCode;
  let version = def.version || '0.0.1';
  let estimateFor = cfg.templateId || serviceCode;

  if (def.layout === 'loader' && Array.isArray(def.templates) && typeof def.templates[0] === 'string') {
    const subCode = templateId || def.defaultTemplates?.[0] || def.templates[0];
    try {
      const subDef = await (await fetch(SERVICE_DEF_API(subCode))).json();
      resolvedCode = subCode;
      version = subDef.version || version;
      estimateFor = subDef.templates?.[0]?.id || subCode;
    } catch {}
  } else if (def.templates?.length > 0) {
    estimateFor = cfg.templateId || def.templates[0].id || serviceCode;
  }

  return {
    entry: {
      calculationComponents: cfg.calculationComponents || {},
      serviceCode: resolvedCode, region, estimateFor, version, description,
      serviceCost: { monthly: cfg.monthlyCost || 0, upfront: cfg.upfrontCost || 0 },
      serviceName: cfg.serviceName || def.serviceName || serviceCode,
      regionName: REGION_NAMES[region] || region,
      configSummary: configSummary || '',
    },
    monthlyCost: cfg.monthlyCost || 0,
  };
}

export function buildGroupedPayload(name, groups) {
  const groupsObj = {};
  let grandTotal = 0;
  for (const [groupName, groupData] of Object.entries(groups)) {
    const groupId = `${groupName}-${crypto.randomUUID()}`;
    let groupTotal = 0;
    for (const svc of Object.values(groupData.services)) groupTotal += svc.serviceCost?.monthly || 0;
    groupsObj[groupId] = {
      name: groupName, services: groupData.services, groups: {},
      groupSubtotal: { monthly: groupTotal, upfront: 0 },
      totalCost: { monthly: groupTotal, upfront: 0 },
    };
    grandTotal += groupTotal;
  }
  return {
    name, services: {}, groups: groupsObj,
    groupSubtotal: { monthly: grandTotal, upfront: 0 },
    totalCost: { monthly: grandTotal, upfront: 0 },
    support: {},
    metaData: { locale: 'en_US', currency: 'USD', createdOn: new Date().toISOString(), source: 'calculator-platform' },
  };
}

export async function saveEstimate(payload) {
  let resp = await fetch(SAVE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let text = await resp.text();
  if (!resp.ok) {
    const strip = (services) => { for (const s of Object.values(services)) s.calculationComponents = {}; };
    if (payload.services) strip(payload.services);
    for (const g of Object.values(payload.groups || {})) { if (g.services) strip(g.services); }
    resp = await fetch(SAVE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    text = await resp.text();
    if (!resp.ok) throw new Error(`Save failed: ${resp.status} ${text}`);
  }
  const result = JSON.parse(text);
  const body = JSON.parse(result.body);
  return `https://calculator.aws/#/estimate?id=${body.savedKey}`;
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const resolved = await realpath(DEFAULT_SERVER_PATH);
  console.log(`Connecting to MCP server at ${resolved}...`);
  const client = createMCPClient(resolved);
  await client.init();
  console.log('Connected.');
  const cfg = await configureService(client, 'eC2Next', {
    instanceType: 't3.medium', selectedOS: 'linux', quantity: 1,
    pricingStrategy: { model: 'ondemand' },
  }, 'quickEstimate');
  console.log(`t3.medium: $${cfg.monthlyCost?.toFixed(2)}/mo`);
  client.close();
  console.log('Self-test passed.');
}
