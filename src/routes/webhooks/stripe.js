import { parseStripeWebhook } from '../../adapters/stripe.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { submitOrderToCustomCat } from '../../adapters/customcat.js';
import { sendJson } from '../../lib/http.js';

export async function handleStripeWebhook(req, res) {
  const event = await parseStripeWebhook(req);
  const object = event?.data?.object || event;
  const normalized = normalizeOrder({ source: 'stripe', raw: object });
  const result = await submitOrderToCustomCat(normalized);
  sendJson(res, 200, { received: true, type: event?.type || 'unknown', result });
}
