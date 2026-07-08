import { getConfig } from '../lib/config.js';
import { verifyStripeSignature } from '../lib/stripe-signature.js';

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function checkoutSessionToInternalRaw(session) {
  const shipping = session?.shipping_details?.address || session?.customer_details?.address || {};
  const customer = session?.customer_details || {};
  const metadata = session?.metadata || {};
  const items = metadata.items ? JSON.parse(metadata.items) : [];
  return {
    id: session?.id,
    orderId: session?.id,
    checkout_session_id: session?.id,
    payment_intent: session?.payment_intent || null,
    currency: session?.currency?.toUpperCase?.() || 'USD',
    customer: { email: customer?.email || '', name: customer?.name || '' },
    shippingAddress: {
      name: session?.shipping_details?.name || customer?.name || '',
      line1: shipping?.line1 || '', line2: shipping?.line2 || '', city: shipping?.city || '', state: shipping?.state || '', postalCode: shipping?.postal_code || '', country: shipping?.country || '', phone: customer?.phone || ''
    },
    items,
    notes: metadata.notes || '',
    metadata,
  };
}

export async function parseStripeWebhook(req) {
  const rawBody = await readRawBody(req);
  const config = getConfig();
  const signatureHeader = req.headers['stripe-signature'] || '';
  if (!config.stripeWebhookSecret) throw new Error('missing_STRIPE_WEBHOOK_SECRET');
  verifyStripeSignature({ payload: rawBody, signatureHeader, secret: config.stripeWebhookSecret });
  const event = rawBody ? JSON.parse(rawBody) : {};
  if (event?.type === 'checkout.session.completed') event.internalOrderRaw = checkoutSessionToInternalRaw(event.data?.object || {});
  return event;
}

export function transformCheckoutSessionForTest(session) {
  return checkoutSessionToInternalRaw(session);
}
