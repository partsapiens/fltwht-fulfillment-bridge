import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomCatOrderPayload,
  submitOrderToCustomCat,
} from '../src/adapters/customcat.js';

const skuMap = {
  'FW-BRR-TE-STD': {
    supplier: 'customcat',
    requiredIdField: 'productId',
    productId: '1049',
    productName: "BORDER RUN '89 — Tee (Standard)",
    shippingMethod: 'Economy',
    color: 'Black',
    catalogSkusBySize: {
      S: '48144',
      M: '48145',
      L: '48146',
      XL: '48147',
    },
    designUrl: 'https://fltwht.com/designs/border-run-89-upload.jpg',
  },
};

function sampleOrder(overrides = {}) {
  return {
    source: 'stripe',
    externalOrderId: 'cs_test_123',
    customer: { email: 'buyer@example.com', name: 'Buyer Example' },
    shippingAddress: {
      name: 'Buyer Example',
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
      phone: '+1-555-111-2222',
    },
    items: [
      {
        sku: 'FW-BRR-TE-STD',
        title: "BORDER RUN '89 — Tee (Standard)",
        quantity: 2,
        size: 'L',
      },
    ],
    ...overrides,
  };
}

test('buildCustomCatOrderPayload maps catalog_sku, design_url, shipping, sandbox', () => {
  const order = sampleOrder();
  const mappedItems = [
    {
      ...order.items[0],
      catalogSku: '48146',
      designUrl: 'https://fltwht.com/designs/border-run-89-upload.jpg',
      customcat: skuMap['FW-BRR-TE-STD'],
    },
  ];
  const payload = buildCustomCatOrderPayload(order, mappedItems, { dryRun: true });
  assert.equal(payload.sandbox, '1');
  assert.equal(payload.shipping_first_name, 'Buyer');
  assert.equal(payload.shipping_last_name, 'Example');
  assert.equal(payload.shipping_address1, '123 Main St');
  assert.equal(payload.shipping_zip, '90001');
  assert.equal(payload.shipping_method, 'Economy');
  assert.equal(payload.items.length, 1);
  assert.deepEqual(payload.items[0], {
    catalog_sku: '48146',
    design_url: 'https://fltwht.com/designs/border-run-89-upload.jpg',
    quantity: 2,
  });
  assert.equal('api_key' in payload, false);
});

test('dryRun submit does not POST and returns payload preview', async () => {
  let fetchCalled = false;
  const result = await submitOrderToCustomCat(sampleOrder(), {
    dryRun: true,
    skuMap,
    fetch: async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(result.accepted, true);
  assert.equal(result.mode, 'dry_run');
  assert.equal(result.dryRun, true);
  assert.equal(result.customCatPayload.items[0].catalog_sku, '48146');
  assert.equal('api_key' in result.customCatPayload, false);
});

test('live submit POSTs when configured and fields present', async () => {
  const prev = {
    DRY_RUN: process.env.DRY_RUN,
    CUSTOMCAT_API_KEY: process.env.CUSTOMCAT_API_KEY,
    CUSTOMCAT_API_BASE: process.env.CUSTOMCAT_API_BASE,
    CUSTOMCAT_SANDBOX: process.env.CUSTOMCAT_SANDBOX,
  };
  process.env.DRY_RUN = '0';
  process.env.CUSTOMCAT_API_KEY = 'test-key-not-real';
  process.env.CUSTOMCAT_API_BASE = 'https://customcat-beta.mylocker.net/api/v1';
  process.env.CUSTOMCAT_SANDBOX = '1';

  let seen = null;
  try {
    const result = await submitOrderToCustomCat(sampleOrder(), {
      dryRun: false,
      skuMap,
      fetch: async (url, init) => {
        seen = { url: String(url), method: init.method, body: JSON.parse(init.body) };
        return new Response(JSON.stringify({ ORDER_ID: 'CC-9', ORDER_STATUS: 'pending' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    assert.equal(result.accepted, true);
    assert.equal(result.mode, 'api_submitted');
    assert.equal(seen.method, 'POST');
    assert.equal(seen.url, 'https://customcat-beta.mylocker.net/api/v1/order/cs_test_123');
    assert.equal(seen.body.api_key, 'test-key-not-real');
    assert.equal(seen.body.sandbox, '1');
    assert.equal(seen.body.items[0].catalog_sku, '48146');
    assert.equal(seen.body.items[0].design_url, 'https://fltwht.com/designs/border-run-89-upload.jpg');
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('live submit without designUrl returns api_pending_fields and does not POST', async () => {
  const mapNoDesign = {
    'FW-BRR-TE-STD': { ...skuMap['FW-BRR-TE-STD'], designUrl: undefined },
  };
  const prev = {
    DRY_RUN: process.env.DRY_RUN,
    CUSTOMCAT_API_KEY: process.env.CUSTOMCAT_API_KEY,
    CUSTOMCAT_API_BASE: process.env.CUSTOMCAT_API_BASE,
  };
  process.env.DRY_RUN = '0';
  process.env.CUSTOMCAT_API_KEY = 'test-key-not-real';
  process.env.CUSTOMCAT_API_BASE = 'https://customcat-beta.mylocker.net/api/v1';

  let fetchCalled = false;
  try {
    const result = await submitOrderToCustomCat(sampleOrder(), {
      dryRun: false,
      skuMap: mapNoDesign,
      fetch: async () => {
        fetchCalled = true;
        return new Response('{}', { status: 200 });
      },
    });
    assert.equal(fetchCalled, false);
    assert.equal(result.accepted, false);
    assert.equal(result.mode, 'api_pending_fields');
    assert.deepEqual(result.missingDesigns, ['FW-BRR-TE-STD']);
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
