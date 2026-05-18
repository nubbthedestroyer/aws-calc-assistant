import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeValue, buildCalcComponents, buildGroupTree, normalizeGroupPath, REGION_NAMES } from './index.js';

// ─── normalizeValue ───────────────────────────────────────────────────────────

test('normalizeValue: plain number passthrough', () => {
  assert.equal(normalizeValue('number', 42), 42);
});

test('normalizeValue: fileSize GB passthrough', () => {
  assert.equal(normalizeValue('fileSize', { value: 1, unit: 'GB' }), 1);
});

test('normalizeValue: fileSize TB to GB', () => {
  assert.equal(normalizeValue('fileSize', { value: 1, unit: 'TB' }), 1024);
});

test('normalizeValue: frequency per month', () => {
  assert.equal(normalizeValue('frequency', { value: 1, unit: 'per month' }), 1);
});

test('normalizeValue: frequency per year', () => {
  assert.ok(Math.abs(normalizeValue('frequency', { value: 12, unit: 'per year' }) - 1) < 0.01);
});

test('normalizeValue: utilization 100% = 730 hours', () => {
  assert.equal(normalizeValue('utilization', 100), 730);
});

test('normalizeValue: null returns 0', () => {
  assert.equal(normalizeValue('number', null), 0);
});

// ─── normalizeGroupPath ───────────────────────────────────────────────────────

test('normalizeGroupPath: string becomes single-element array', () => {
  assert.deepEqual(normalizeGroupPath('Production'), ['Production']);
});

test('normalizeGroupPath: array passthrough', () => {
  assert.deepEqual(normalizeGroupPath(['Production', 'us-east-1']), ['Production', 'us-east-1']);
});

test('normalizeGroupPath: null returns empty array', () => {
  assert.deepEqual(normalizeGroupPath(null), []);
});

test('normalizeGroupPath: filters empty strings', () => {
  assert.deepEqual(normalizeGroupPath(['Production', '']), ['Production']);
});

// ─── buildCalcComponents ─────────────────────────────────────────────────────

test('buildCalcComponents: applies defaults when no user inputs', () => {
  const inputs = [{ id: 'quantity', type: 'number', default: 1 }];
  const cc = buildCalcComponents(inputs, {});
  assert.deepEqual(cc.quantity, { value: 1 });
});

test('buildCalcComponents: user input overrides default', () => {
  const inputs = [{ id: 'quantity', type: 'number', default: 1 }];
  const cc = buildCalcComponents(inputs, { quantity: 4 });
  assert.deepEqual(cc.quantity, { value: 4 });
});

test('buildCalcComponents: wraps plain value in { value }', () => {
  const inputs = [{ id: 'selectedOS', type: 'dropdown', default: 'linux' }];
  const cc = buildCalcComponents(inputs, { selectedOS: 'windows' });
  assert.deepEqual(cc.selectedOS, { value: 'windows' });
});

test('buildCalcComponents: passes through { value, unit } objects', () => {
  const inputs = [{ id: 'storageAmount', type: 'fileSize', defaultUnit: 'GB', default: 30 }];
  const cc = buildCalcComponents(inputs, { storageAmount: { value: 500, unit: 'GB' } });
  assert.equal(cc.storageAmount.value, 500);
  assert.equal(cc.storageAmount.unit, 'GB');
});

// ─── buildGroupTree ───────────────────────────────────────────────────────────

test('buildGroupTree: creates group with service', () => {
  const entry = { serviceCost: { monthly: 100, upfront: 0 } };
  const groups = buildGroupTree([{ key: 'svc-1', entry, path: ['Production'] }]);
  const prod = Object.values(groups).find(g => g.name === 'Production');
  assert.ok(prod);
  assert.equal(prod.groupSubtotal.monthly, 100);
});

test('buildGroupTree: rolls up costs across services', () => {
  const e1 = { serviceCost: { monthly: 100, upfront: 0 } };
  const e2 = { serviceCost: { monthly: 200, upfront: 0 } };
  const groups = buildGroupTree([
    { key: 'svc-1', entry: e1, path: ['Production'] },
    { key: 'svc-2', entry: e2, path: ['Production'] },
  ]);
  const prod = Object.values(groups).find(g => g.name === 'Production');
  assert.equal(prod.groupSubtotal.monthly, 300);
});

test('buildGroupTree: creates nested groups', () => {
  const entry = { serviceCost: { monthly: 50, upfront: 0 } };
  const groups = buildGroupTree([{ key: 'svc-1', entry, path: ['Production', 'us-east-1'] }]);
  const prod = Object.values(groups).find(g => g.name === 'Production');
  assert.ok(prod);
  const region = Object.values(prod.groups).find(g => g.name === 'us-east-1');
  assert.ok(region);
  assert.equal(region.groupSubtotal.monthly, 50);
});

// ─── REGION_NAMES ─────────────────────────────────────────────────────────────

test('REGION_NAMES: us-east-1 maps correctly', () => {
  assert.equal(REGION_NAMES['us-east-1'], 'US East (N. Virginia)');
});

test('REGION_NAMES: eu-west-1 maps correctly', () => {
  assert.equal(REGION_NAMES['eu-west-1'], 'EU (Ireland)');
});
