import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFwSkuKey, resolveSkuMapping, resolveCustomCatSku } from '../src/lib/sku-map.js';

const aliases = {
  'neon-street-racer': { standard: 'FW-NSR-TE-STD', signature: 'FW-NSR-TE-SIG' },
};
const skuMap = {
  'FW-NSR-TE-STD': {
    supplier: 'customcat',
    requiredIdField: 'productId',
    productId: 'TBD',
    productName: 'Neon Street Racer — Tee (Standard)',
  },
};

test('FW codes pass through', () => {
  assert.equal(resolveFwSkuKey({ sku: 'FW-NSR-TE-STD' }, aliases), 'FW-NSR-TE-STD');
});

test('storefront slug resolves to standard FW code', () => {
  assert.equal(resolveFwSkuKey({ sku: 'neon-street-racer' }, aliases), 'FW-NSR-TE-STD');
});

test('premium tier resolves to signature FW code', () => {
  assert.equal(resolveFwSkuKey({ sku: 'neon-street-racer', tier: 'premium' }, aliases), 'FW-NSR-TE-SIG');
});

test('slug maps into sku-map customcat row', () => {
  const mapping = resolveSkuMapping({ sku: 'neon-street-racer' }, skuMap, aliases);
  assert.equal(mapping.supplier, 'customcat');
  assert.equal(mapping.productId, 'TBD');
  const cc = resolveCustomCatSku({ sku: 'neon-street-racer' }, skuMap, aliases);
  assert.equal(cc.productName.includes('Neon Street Racer'), true);
});

test('unknown slug returns null', () => {
  assert.equal(resolveFwSkuKey({ sku: 'aircooled-heritage' }, aliases), null);
});
