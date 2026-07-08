import { parseStripeWebhook } from '../../adapters/stripe.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { submitOrderToCustomCat } from '../../adapters/customcat.js';

export async function handleStripeWebhook(req, res) {
  const event = await parseStripeWebhook(req);
  const normalized = normalizeOrder({ source: 'stripe', raw: event });
  const result = await submitOrderToCustomCat(normalized);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ received: true, result }));
}
