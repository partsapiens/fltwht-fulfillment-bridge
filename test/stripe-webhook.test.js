import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeStripeSignature, verifyStripeSignature } from '../src/lib/stripe-signature.js';
import { transformCheckoutSessionForTest } from '../src/adapters/stripe.js';
import { normalizeOrder } from '../src/lib/order-normalizer.js';

const payload = fs.readFileSync(new URL('../samples/stripe-checkout-session-completed.json', import.meta.url), 'utf8');
const event = JSON.parse(payload);
const secret = 'whsec_test_secret_123';
const timestamp = 1783560600;
const signature = computeStripeSignature({ payload, timestamp, secret });
const signatureHeader = `t=${timestamp},v1=${signature}`;

test('verifies Stripe signature', () => {
  const result = verifyStripeSignature({ payload, signatureHeader, secret, toleranceSeconds: 999999999, nowMs: timestamp * 1000 });
  assert.equal(result.ok, true);
});

test('transforms checkout.session.completed into normalized internal order', () => {
  const raw = transformCheckoutSessionForTest(event.data.object);
  const normalized = normalizeOrder({ source: 'stripe', raw });
  assert.equal(normalized.externalOrderId, 'cs_test_a1b2c3');
  assert.equal(normalized.customer.email, 'buyer@example.com');
  assert.equal(normalized.items.length, 2);
  assert.equal(normalized.items[0].sku, 'FLT-NSR-STD-TEE');
  assert.equal(normalized.shippingAddress.postalCode, '90001');
});
