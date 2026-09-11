/**
 * FLTWHT Fulfillment Bridge — Cloudflare Worker
 * =============================================
 * Single-file ES module Worker. No imports, no node builtins, no build step —
 * this file is meant to be pasted directly into the Cloudflare Workers
 * dashboard editor (Workers & Pages -> Create Worker -> paste), or deployed
 * with the sibling `wrangler.toml` (`main = "worker/bridge.worker.js"`).
 *
 * This is a from-scratch Web-standard-API port of the logic that already
 * exists in the Node scaffold at src/lib/stripe-signature.js,
 * src/lib/order-normalizer.js, src/lib/supplier-router.js,
 * src/adapters/stripe.js, src/adapters/customcat.js and data/sku-map.json.
 * Node's `node:crypto` / `node:http` are NOT used anywhere in this file —
 * signature verification uses Web Crypto (`crypto.subtle`), and HTTP is
 * handled with the standard `Request` / `Response` objects.
 *
 * Routes:
 *   GET  /health              - which required env vars/secrets are present (booleans only, never values)
 *   POST /webhooks/stripe     - verify Stripe-Signature, parse `checkout.session.completed`,
 *                                normalize the order (incl. the "Size" custom field + shipping address),
 *                                route line items by SKU to CustomCat / Apliiq, and dispatch
 *   GET  /jobs/poll-tracking  - manually trigger the tracking-sync stub (same logic as scheduled())
 *
 * scheduled(event, env, ctx)  - cron entrypoint; runs the same tracking-sync stub as GET /jobs/poll-tracking
 *
 * SAFETY / DRY_RUN:
 *   - env.DRY_RUN defaults to "1" whenever unset or anything other than the literal string "0".
 *     Only DRY_RUN === "0" allows the CustomCat live-submit branch to run, and even then it also
 *     requires env.CUSTOMCAT_API_KEY to be set.
 *   - In dry-run (the default), no outbound fetch() calls are made to CustomCat, Apliiq, Stripe, or
 *     any email/tracking API. The exact payload that *would* be sent is console.log'd and returned
 *     in the JSON response instead.
 *   - Apliiq has no confirmed simple order-creation API (see runbooks/etsy-apliiq-connect.md and
 *     repo/HANDOFF.md in the source repo). Apliiq lines are therefore ALWAYS normalized and
 *     logged/queued for manual or CSV dispatch — there is no live-send code path for Apliiq in this
 *     file at all, regardless of DRY_RUN.
 *   - GET /jobs/poll-tracking and scheduled() are stubs only. They document the real request shape
 *     in comments and in the returned JSON, but never perform a live fetch() — this is intentional
 *     per the current build phase (no confirmed CustomCat "list shipped orders" endpoint or chosen
 *     email API yet). See the runTrackingPoll() comment block below before wiring this up live.
 *
 * SKU_MAP below mirrors data/sku-map.json in the source repo, inlined because a single-file Worker
 * cannot `import` a JSON file without a bundler/build step. If data/sku-map.json changes, regenerate
 * this block (see worker/DEPLOY.md "Keeping SKU_MAP in sync").
 */

// ---------------------------------------------------------------------------
// SKU -> supplier map (mirrors data/sku-map.json — keep in sync manually)
// ---------------------------------------------------------------------------
const SKU_MAP = {
  "FW-BRR-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 }, "productName": "BORDER RUN '89 — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/border-run-89-upload.jpg", "presetId": 2 },
  "FW-BRR-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "BORDER RUN '89 | Gildan 5000 | DTF", "apliiqProductId": "5969563", "apliiqProductUrl": "https://www.apliiq.com/product/5969563/BORDER-RUN-89", "productName": "BORDER RUN '89 — Tee (Signature)", "blank": "Gildan 5000", "printMethod": "DTF" },
  "FW-NSR-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 , "designUrl": "https://fltwht.com/designs/neon-street-racer-print.jpg", "designSource": "NEO_ANIME_MAIN_UPSCALE" }, "productName": "Neon Street Racer — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/neon-street-racer-print.png", "designSource": "EXTRACTED_FROM_MOCKUP" },
  "FW-NSR-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Neon Street Racer — Tee (Signature)" },
  "FW-UGG-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 }, "productName": "Umbrella Glow Girl — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/umbrella-glow-girl-print.png", "designSource": "EXTRACTED_FROM_MOCKUP" },
  "FW-UGG-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Umbrella Glow Girl — Tee (Signature)" },
  "FW-TBL-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 }, "productName": "Turbo Legend — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/turbo-legend-print.png", "designSource": "EXTRACTED_FROM_MOCKUP" },
  "FW-TBL-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Turbo Legend — Tee (Signature)" },
  "FW-DKG-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 }, "productName": "Drift King — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/drift-king-print.png", "designSource": "EXTRACTED_FROM_MOCKUP" },
  "FW-DKG-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Drift King — Tee (Signature)" },
  "FW-STB-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Street Beast — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-STB-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Street Beast — Tee (Signature)" },
  "FW-MRD-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Midnight Roadster — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-MRD-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Midnight Roadster — Tee (Signature)" },
  "FW-BJL-TE-STD": { "supplier": "customcat", "requiredIdField": "catalogSku", "catalogProductId": 1049, "catalogSkuBySize": { "S": 48144, "M": 48145, "L": 48146, "XL": 48147, "2XL": 48148, "3XL": 48149, "4XL": 48150, "5XL": 48151 }, "productName": "Black JDM Legend — Tee (Standard)", "shippingMethod": "Economy", "color": "Black", "designUrl": "https://fltwht.com/designs/black-jdm-legend-print.png", "designSource": "EXTRACTED_FROM_MOCKUP" },
  "FW-BJL-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Black JDM Legend — Tee (Signature)" },
  "FW-STL-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Street Legend — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-STL-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Street Legend — Tee (Signature)" },
  "FW-NVC-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Neon Voltage Coupe — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-NVC-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Neon Voltage Coupe — Tee (Signature)" },
  "FW-NON-CR-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Neon Osaka Nightrunner — Crop Hoodie (Standard)", "shippingMethod": "Economy" },
  "FW-NON-CR-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Neon Osaka Nightrunner — Crop Hoodie (Signature)" },
  "FW-NON-WO-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Neon Osaka Nightrunner — Women's Relaxed Tee (Standard)", "shippingMethod": "Economy" },
  "FW-NON-WO-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Neon Osaka Nightrunner — Women's Relaxed Tee (Signature)" },
  "FW-RCP-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Retro Coupe — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-RCP-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Retro Coupe — Tee (Signature)" },
  "FW-AMU-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "American Muscle — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-AMU-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "American Muscle — Tee (Signature)" },
  "FW-RRB-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Retro Roundback — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-RRB-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Retro Roundback — Tee (Signature)" },
  "FW-N4X-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Night Offroad 4x4 — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-N4X-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Night Offroad 4x4 — Tee (Signature)" },
  "FW-MSS-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "Midnight Sport Saloon — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-MSS-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "Midnight Sport Saloon — Tee (Signature)" },
  "FW-W123-TE-STD": { "supplier": "customcat", "requiredIdField": "productId", "productId": "TBD", "productName": "W123 Heritage Eco — Tee (Standard)", "shippingMethod": "Economy" },
  "FW-W123-TE-SIG": { "supplier": "apliiq", "requiredIdField": "apliiqProductRef", "apliiqProductRef": "TBD", "productName": "W123 Heritage Eco — Tee (Signature)" }
};

// ---------------------------------------------------------------------------
// Env / config helpers
// ---------------------------------------------------------------------------

const REQUIRED_ENV_VARS = ['STRIPE_WEBHOOK_SECRET', 'CUSTOMCAT_API_KEY', 'CUSTOMCAT_API_BASE'];
const OPTIONAL_ENV_VARS = ['TRACKING_EMAIL_API_KEY', 'TRACKING_EMAIL_FROM', 'TRACKING_EMAIL_REPLY_TO', 'APLIIQ_NOTIFY_EMAIL_API_KEY', 'APLIIQ_API_URL', 'APLIIQ_API_KEY'];

export function isDryRun(env) {
  // Default-safe: anything other than the literal string "0" is treated as dry-run.
  return String(env?.DRY_RUN ?? '1') !== '0';
}

export function healthPayload(env) {
  const presence = (keys) => Object.fromEntries(keys.map((key) => [key, Boolean(env?.[key])]));
  return {
    ok: true,
    service: 'fltwht-bridge',
    dryRun: isDryRun(env),
    required: presence(REQUIRED_ENV_VARS),
    optional: presence(OPTIONAL_ENV_VARS),
    bindings: {
      ORDER_STATE: Boolean(env?.ORDER_STATE),
    },
  };
}

// ---------------------------------------------------------------------------
// Stripe webhook signature verification (Web Crypto only — no node:crypto)
// ---------------------------------------------------------------------------

export function parseStripeSignatureHeader(header = '') {
  const entries = header.split(',').map((part) => part.trim()).filter(Boolean);
  const parsed = { timestamp: null, signatures: [] };
  for (const entry of entries) {
    const [key, value] = entry.split('=');
    if (key === 't') parsed.timestamp = Number(value);
    if (key === 'v1' && value) parsed.signatures.push(value);
  }
  return parsed;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signature));
}

// Manual constant-time compare (portable to both workerd and node --test; Cloudflare's
// non-standard `crypto.subtle.timingSafeEqual` is intentionally NOT used so this file's
// tests can run under plain Node as well as on Workers).
function timingSafeEqualHex(a = '', b = '') {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function computeStripeSignature({ payload, timestamp, secret }) {
  return hmacSha256Hex(secret, `${timestamp}.${payload}`);
}

export async function verifyStripeSignature({ payload, signatureHeader, secret, toleranceSeconds = 300, nowMs = Date.now() }) {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error('invalid_stripe_signature_header');
  }
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new Error('stripe_signature_timestamp_out_of_tolerance');
  }
  const expected = await computeStripeSignature({ payload, timestamp: parsed.timestamp, secret });
  const matches = parsed.signatures.some((candidate) => timingSafeEqualHex(candidate, expected));
  if (!matches) {
    throw new Error('stripe_signature_verification_failed');
  }
  return { ok: true, timestamp: parsed.timestamp };
}

// ---------------------------------------------------------------------------
// Order normalization (ported from src/lib/order-normalizer.js + src/adapters/stripe.js)
// ---------------------------------------------------------------------------

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseMaybeJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeVehicleTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const parsed = parseMaybeJson(value, null);
    if (Array.isArray(parsed)) return parsed.map((tag) => String(tag || '').trim()).filter(Boolean);
    return value.split(/[|,]/).map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  return [];
}

function normalizeQualityTier(value = '', sku = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'custom' || raw === 'ai' || raw === 'custom_ai') return 'custom';
  if (raw === 'premium' || raw === 'signature' || raw === 'sig') return 'premium';
  if (raw === 'standard' || raw === 'std') return 'standard';
  if (/-SIG$/i.test(sku || '')) return 'premium';
  if (/-STD$/i.test(sku || '')) return 'standard';
  return '';
}

function buildLineItemMetadata(item = {}, metadata = {}) {
  return {
    ...(isObject(metadata) ? metadata : {}),
    ...(isObject(item?.metadata) ? item.metadata : {}),
  };
}

function normalizeLineItem(item = {}) {
  const metadata = buildLineItemMetadata(item, item?.metadata || {});
  const sku = item.sku || item.SKU || item.customSku || null;
  const printAssetUrl = item.printAssetUrl || item.aiAssetUrl || item.customDesignUrl || metadata.printAssetUrl || metadata.aiAssetUrl || metadata.customDesignUrl || metadata.custom_design_url || '';
  const printAssetUrlBack = item.printAssetUrlBack || item.aiAssetUrlBack || metadata.printAssetUrlBack || metadata.aiAssetUrlBack || metadata.print_asset_url_back || '';
  const customPayload = parseMaybeJson(item.customPayload || metadata.customPayload || metadata.custom_payload || '', {});
  const vehicleTags = normalizeVehicleTags(item.vehicleTags || metadata.vehicleTags || metadata.vehicle_tags || customPayload?.vehicleTags || '');
  const qualityTier = normalizeQualityTier(item.qualityTier || item.qualityFlag || metadata.qualityTier || metadata.qualityFlag || metadata.quality || customPayload?.qualityTier || '', sku || '');
  const customizationMode = String(item.customizationMode || metadata.customizationMode || metadata.customization_mode || customPayload?.mode || (qualityTier === 'custom' ? 'ai' : '') || '');

  return {
    sku,
    title: item.title || item.name || item.description || '',
    quantity: Number(item.quantity || item.qty || 1),
    unitPrice: Number(item.unitPrice || item.price || 0),
    color: item.color || item.variantColor || '',
    size: item.size || item.variantSize || '',
    printAssetUrl,
    printAssetUrlBack,
    qualityTier,
    qualityFlag: qualityTier,
    vehicleTags,
    customizationMode,
    customPayload: isObject(customPayload) ? customPayload : {},
    metadata,
  };
}

function normalizeAddress(address = {}) {
  return {
    name: address.name || '',
    line1: address.line1 || address.address1 || '',
    line2: address.line2 || address.address2 || '',
    city: address.city || '',
    state: address.state || address.province || '',
    postalCode: address.postalCode || address.zip || '',
    country: address.country || address.countryCode || '',
    phone: address.phone || '',
  };
}

export function normalizeOrder({ source, raw }) {
  const items = (raw?.items || raw?.line_items || raw?.lineItems || []).map(normalizeLineItem);
  return {
    source,
    externalOrderId: raw?.id || raw?.orderId || raw?.payment_intent || raw?.checkout_session_id || null,
    orderNumber: raw?.orderNumber || raw?.number || raw?.name || null,
    customer: raw?.customer || {
      email: raw?.customer_email || raw?.buyerEmail || '',
      name: raw?.customer_name || raw?.buyerName || '',
    },
    items,
    currency: raw?.currency || raw?.currencyCode || 'USD',
    shippingAddress: normalizeAddress(raw?.shippingAddress || raw?.shipping_address || raw?.recipient || {}),
    customFields: raw?.customFields || {},
    metadata: isObject(raw?.metadata) ? raw.metadata : {},
    notes: raw?.notes || '',
    raw,
  };
}

// Stripe Checkout Sessions (and Payment Links) support a "custom_fields" array so a buyer
// can be asked for e.g. a Size dropdown at checkout without a separate Price per size. This
// looks for a field whose key or custom label mentions "size" (case-insensitive) and returns
// its selected value uppercased (e.g. "l" -> "L"), or '' if none is present.
export function extractSizeCustomField(session) {
  const fields = Array.isArray(session?.custom_fields) ? session.custom_fields : [];
  for (const field of fields) {
    const key = String(field?.key || '');
    const label = String(field?.label?.custom || field?.label?.text || '');
    if (!/size/i.test(key) && !/size/i.test(label)) continue;
    const value = field?.dropdown?.value ?? field?.text?.value ?? field?.numeric?.value ?? '';
    if (value !== '' && value != null) return String(value).toUpperCase();
  }
  return '';
}

function buildStripeOrderDefaults(metadata = {}) {
  const customPayload = parseMaybeJson(metadata.customPayload || metadata.custom_payload || '', {});
  return {
    printAssetUrl: metadata.printAssetUrl || metadata.aiAssetUrl || metadata.customDesignUrl || metadata.custom_design_url || customPayload?.designAssetUrl || '',
    printAssetUrlBack: metadata.printAssetUrlBack || metadata.aiAssetUrlBack || metadata.custom_design_url_back || customPayload?.designAssetUrlBack || '',
    qualityTier: normalizeQualityTier(metadata.qualityTier || metadata.qualityFlag || metadata.quality || customPayload?.qualityTier || '', metadata.sku || ''),
    vehicleTags: normalizeVehicleTags(metadata.vehicleTags || metadata.vehicle_tags || customPayload?.vehicleTags || ''),
    customizationMode: String(metadata.customizationMode || metadata.customization_mode || customPayload?.mode || ''),
    customPayload: isObject(customPayload) ? customPayload : {},
  };
}

function withStripeOrderDefaults(items = [], defaults = {}, customSize = '') {
  return items.map((item) => ({
    ...item,
    size: item.size || customSize || '',
    printAssetUrl: item.printAssetUrl || defaults.printAssetUrl || '',
    printAssetUrlBack: item.printAssetUrlBack || defaults.printAssetUrlBack || '',
    qualityTier: normalizeQualityTier(item.qualityTier || item.qualityFlag || defaults.qualityTier || '', item.sku || ''),
    vehicleTags: normalizeVehicleTags(item.vehicleTags || defaults.vehicleTags || ''),
    customizationMode: String(item.customizationMode || defaults.customizationMode || ''),
    customPayload: isObject(item.customPayload) ? item.customPayload : (isObject(defaults.customPayload) ? defaults.customPayload : {}),
    metadata: {
      ...(isObject(item.metadata) ? item.metadata : {}),
      qualityTier: item.qualityTier || defaults.qualityTier || '',
      vehicleTags: normalizeVehicleTags(item.vehicleTags || defaults.vehicleTags || ''),
    },
  }));
}

// Converts a Stripe checkout.session.completed `session` object into this bridge's internal
// raw-order shape. Two line-item sources are supported:
//   1. session.metadata.items — a JSON-encoded array of {sku,title,quantity,size,color,...}.
//      This is the existing convention already covered by the Node scaffold's tests/samples,
//      used for multi-item carts built by a custom checkout-session-creation flow.
//   2. session.metadata.sku — a single SKU string. This is the realistic shape for a Stripe
//      Payment Link selling one product (e.g. the live "BORDER RUN '89 Signature" link), where
//      the buyer picks their size via the custom_fields "Size" dropdown rather than metadata.
// In both cases, a "Size" custom field (see extractSizeCustomField) backfills any item missing
// a size, and is always recorded on the normalized order at customFields.size.
export function sessionToInternalOrder(session = {}) {
  const shippingSource = session?.shipping_details?.address || session?.customer_details?.address || {};
  const customer = session?.customer_details || {};
  const metadata = session?.metadata || {};
  const customSize = extractSizeCustomField(session);
  const defaults = buildStripeOrderDefaults(metadata);

  let items;
  if (metadata.items) {
    const parsedItems = parseMaybeJson(metadata.items, []);
    items = Array.isArray(parsedItems) ? parsedItems : [];
  } else if (metadata.sku) {
    items = [{
      sku: metadata.sku,
      title: metadata.title || metadata.productName || '',
      quantity: Number(metadata.quantity || 1),
      size: metadata.size || '',
      color: metadata.color || '',
      printAssetUrl: defaults.printAssetUrl,
      printAssetUrlBack: defaults.printAssetUrlBack,
      qualityTier: defaults.qualityTier,
      vehicleTags: defaults.vehicleTags,
      customizationMode: defaults.customizationMode,
      customPayload: defaults.customPayload,
      metadata: { ...metadata },
    }];
  } else {
    items = [];
  }

  items = withStripeOrderDefaults(items, defaults, customSize);

  return {
    id: session?.id,
    orderId: session?.id,
    checkout_session_id: session?.id,
    payment_intent: session?.payment_intent || null,
    currency: session?.currency?.toUpperCase?.() || 'USD',
    customer: { email: customer?.email || '', name: customer?.name || '' },
    shippingAddress: {
      name: session?.shipping_details?.name || customer?.name || '',
      line1: shippingSource?.line1 || '',
      line2: shippingSource?.line2 || '',
      city: shippingSource?.city || '',
      state: shippingSource?.state || '',
      postalCode: shippingSource?.postal_code || '',
      country: shippingSource?.country || '',
      phone: customer?.phone || '',
    },
    items,
    customFields: {
      size: customSize || '',
      qualityTier: defaults.qualityTier || '',
      customizationMode: defaults.customizationMode || '',
      vehicleTags: defaults.vehicleTags,
    },
    notes: metadata.notes || '',
    metadata,
  };
}

// ---------------------------------------------------------------------------
// Supplier routing (ported from src/lib/supplier-router.js + src/lib/sku-map.js)
// ---------------------------------------------------------------------------

export function resolveSkuMapping(sku) {
  if (!sku) return null;
  return SKU_MAP[sku] || null;
}

function getPremiumSiblingSku(sku = '') {
  if (!sku || typeof sku !== 'string') return '';
  return sku.replace(/-STD$/i, '-SIG');
}

function isDirectApliiqCustomItem(item = {}) {
  const qualityTier = normalizeQualityTier(item.qualityTier || item.qualityFlag || '', item.sku || '');
  if (qualityTier === 'custom') return true;
  if (/ai/i.test(String(item.customizationMode || ''))) return true;
  return Boolean(item.printAssetUrl && (item.customPayload?.designAssetUrl || item.customPayload?.printSpec || item.metadata?.qualityTier === 'custom'));
}

// Rule from repo/GO-LIVE.md: *-STD -> CustomCat, *-SIG -> Apliiq. SKU_MAP is consulted first
// (it also carries the real product identifiers); the suffix pattern is a fallback so the
// routing rule still holds even for a SKU that hasn't been added to SKU_MAP yet.
export function supplierForSku(sku) {
  const mapping = resolveSkuMapping(sku);
  if (mapping?.supplier === 'customcat' || mapping?.supplier === 'apliiq') return mapping.supplier;
  if (typeof sku === 'string') {
    if (/-STD$/i.test(sku)) return 'customcat';
    if (/-SIG$/i.test(sku)) return 'apliiq';
  }
  return 'unmapped';
}

function resolveRoutingForItem(item = {}) {
  const baseMapping = resolveSkuMapping(item.sku);
  const customDirect = isDirectApliiqCustomItem(item);
  const overrideSku = customDirect ? getPremiumSiblingSku(item.sku || '') : '';
  const overrideMapping = overrideSku ? resolveSkuMapping(overrideSku) : null;
  const mapping = overrideMapping || baseMapping;
  const supplier = customDirect ? 'apliiq' : supplierForSku(item.sku);
  const supplierProductRef = mapping ? (resolveCatalogSkuForItem(mapping, item) || mapping.productId || mapping.apliiqProductRef || '') : '';
  const qualityTier = normalizeQualityTier(item.qualityTier || item.qualityFlag || '', customDirect && overrideSku ? overrideSku : item.sku || '') || (supplier === 'apliiq' ? 'premium' : 'standard');
  const routingStatus = supplier === 'unmapped'
    ? 'missing_mapping'
    : customDirect && overrideMapping
      ? 'routed_custom_to_apliiq'
      : customDirect && !overrideMapping
        ? 'routed_custom_by_suffix_no_sku_map_entry'
        : mapping
          ? 'routed'
          : 'routed_by_suffix_no_sku_map_entry';

  return {
    supplier,
    mapping,
    supplierProductRef,
    routingStatus,
    customDirect,
    resolvedSku: customDirect && overrideSku ? overrideSku : item.sku,
    qualityTier,
  };
}

export function routeOrderBySupplier(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const lineItems = items.map((item) => {
    const routing = resolveRoutingForItem(item);
    return {
      ...item,
      supplier: routing.supplier,
      mapping: routing.mapping,
      supplierProductRef: routing.supplierProductRef,
      routingStatus: routing.routingStatus,
      directApliiq: routing.customDirect,
      resolvedSku: routing.resolvedSku,
      qualityTier: routing.qualityTier,
      vehicleTags: normalizeVehicleTags(item.vehicleTags || []),
    };
  });
  const groups = {
    customcat: lineItems.filter((item) => item.supplier === 'customcat'),
    apliiq: lineItems.filter((item) => item.supplier === 'apliiq'),
  };
  const missingMappings = lineItems.filter((item) => item.supplier === 'unmapped').map((item) => item.sku).filter(Boolean);
  return {
    orderId: order?.externalOrderId || order?.orderNumber || '',
    lineItems,
    groups,
    missingMappings,
  };
}

// ---------------------------------------------------------------------------
// CustomCat adapter — real request shape, DRY_RUN gated
// ---------------------------------------------------------------------------

// CustomCat's verified external-design API flow uses variant-level `catalog_sku`
// plus a fully-qualified `design_url` (and optional `preset_id`) per line item.
// For app-created CustomCat products, order items use seller-facing `sku` values.
// The older `productId` fallback is intentionally left in place only for unmigrated
// local mappings that have not been moved to a verified `catalogSku` / `sku` model yet.
function normalizeApparelSizeKey(value = '') {
  const compact = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases = {
    S: 'S',
    SMALL: 'S',
    M: 'M',
    MEDIUM: 'M',
    L: 'L',
    LARGE: 'L',
    XL: 'XL',
    EXTRALARGE: 'XL',
    XXL: '2XL',
    '2XL': '2XL',
    XXXL: '3XL',
    '3XL': '3XL',
    XXXXL: '4XL',
    '4XL': '4XL',
    XXXXXL: '5XL',
    '5XL': '5XL',
    XXXXXXL: '6XL',
    '6XL': '6XL',
  };
  return aliases[compact] || compact;
}

function resolveCatalogSkuForItem(mapping = {}, item = {}) {
  if (mapping.catalogSku) return String(mapping.catalogSku);
  const bySize = mapping.catalogSkuBySize || mapping.catalogSkusBySize;
  if (!bySize || typeof bySize !== 'object') return '';
  const normalizedSize = normalizeApparelSizeKey(item.size || item?.metadata?.size || '');
  const exact = bySize[normalizedSize];
  return exact ? String(exact) : '';
}

function resolveCustomCatDesignUrl(mapping = {}, item = {}) {
  return item.printAssetUrl || item.customPayload?.designAssetUrl || mapping.designUrl || '';
}

function splitFullName(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function validateCustomCatPayload(payload = {}, items = []) {
  const errors = [];
  if (!Array.isArray(payload.items) || !payload.items.length) {
    errors.push('missing_customcat_items');
    return errors;
  }

  payload.items.forEach((line, index) => {
    const mapping = items[index]?.mapping || {};
    if (mapping.requiredIdField === 'catalogSku') {
      if (!line.catalog_sku) errors.push(`missing_catalog_sku_for_${items[index]?.sku || index}`);
      if (!line.design_url) errors.push(`missing_design_url_for_${items[index]?.sku || index}`);
    }
  });

  return errors;
}

export function buildCustomCatPayload(order, items, options = {}) {
  const fullName = order.shippingAddress?.name || order.customer?.name || '';
  const name = splitFullName(fullName);
  return {
    shipping_first_name: name.firstName,
    shipping_last_name: name.lastName,
    shipping_email: order.customer?.email || '',
    shipping_phone: order.shippingAddress?.phone || '',
    shipping_address1: order.shippingAddress?.line1 || '',
    shipping_address2: order.shippingAddress?.line2 || '',
    shipping_city: order.shippingAddress?.city || '',
    shipping_state: order.shippingAddress?.state || '',
    shipping_zip: order.shippingAddress?.postalCode || '',
    shipping_country: order.shippingAddress?.country || 'US',
    shipping_method: items[0]?.mapping?.shippingMethod || 'Economy',
    sandbox: options.dryRun === false ? '0' : '1',
    items: items.map((item) => {
      const mapping = item.mapping || {};
      const quantity = Number(item.quantity || 1);

      if (mapping.requiredIdField === 'catalogSku') {
        const line = {
          quantity,
          catalog_sku: resolveCatalogSkuForItem(mapping, item),
          design_url: resolveCustomCatDesignUrl(mapping, item),
        };
        if (item.printAssetUrlBack || item.customPayload?.designAssetUrlBack || mapping.designUrlBack) line.design_url_back = item.printAssetUrlBack || item.customPayload?.designAssetUrlBack || mapping.designUrlBack;
        if (item.customPayload?.mockupUrl || mapping.mockupUrl) line.mockup_url = item.customPayload?.mockupUrl || mapping.mockupUrl;
        if (item.customPayload?.mockupUrlBack || mapping.mockupUrlBack) line.mockup_url_back = item.customPayload?.mockupUrlBack || mapping.mockupUrlBack;
        if (mapping.presetId != null && mapping.presetId !== '') line.preset_id = Number(mapping.presetId);
        if (mapping.useEmbeddedDpi != null) line.use_embedded_dpi = Boolean(mapping.useEmbeddedDpi);
        return line;
      }

      const line = {
        quantity,
        color: item.color || mapping.color || '',
        size: item.size || mapping.size || '',
      };
      if (mapping.requiredIdField === 'sku' && mapping.sku) line.sku = mapping.sku;
      else line.product_id = mapping.productId || 'TBD';
      if (item.printAssetUrl) line.print_files = [item.printAssetUrl];
      if (item.printAssetUrlBack) line.print_files_back = [item.printAssetUrlBack];
      return line;
    }),
  };
}

export async function submitToCustomCat(order, items, env) {
  const dryRun = isDryRun(env);
  const payload = buildCustomCatPayload(order, items, { dryRun });
  const errors = validateCustomCatPayload(payload, items);
  const hasKey = Boolean(env?.CUSTOMCAT_API_KEY);
  const orderId = order.externalOrderId || order.orderNumber || '';
  const base = env.CUSTOMCAT_API_BASE || 'https://customcat-beta.mylocker.net/api/v1';
  const url = `${base}/order/${encodeURIComponent(orderId)}`;

  if (errors.length) {
    return { ok: false, dryRun, sent: false, error: 'invalid_customcat_payload', errors, url, payload };
  }

  if (dryRun || !hasKey) {
    console.log('[DRY_RUN][CustomCat] would POST order', JSON.stringify({ url, payload }));
    return { ok: true, dryRun: true, sent: false, mode: hasKey ? 'dry_run' : 'dry_run_no_api_key', url, payload };
  }

  // Live path — only reachable when env.DRY_RUN === "0" AND env.CUSTOMCAT_API_KEY is set.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      api_key: env.CUSTOMCAT_API_KEY,
    }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, dryRun: false, sent: true, status: response.status, body, url, payload };
}

// ---------------------------------------------------------------------------
// Apliiq adapter — no confirmed order-creation API; normalize + log/queue only
// ---------------------------------------------------------------------------

export function buildApliiqQueueEntry(order, items) {
  return {
    orderId: order.externalOrderId || order.orderNumber || '',
    source: order.source || 'stripe',
    customer: order.customer || {},
    shippingAddress: order.shippingAddress || {},
    dispatchMethod: 'manual_operator_queue',
    items: items.map((item) => ({
      sku: item.sku,
      resolvedSku: item.resolvedSku || item.sku,
      title: item.title,
      quantity: item.quantity,
      size: item.size || '',
      color: item.color || '',
      qualityTier: item.qualityTier || 'premium',
      vehicleTags: item.vehicleTags || [],
      customizationMode: item.customizationMode || '',
      printAssetUrl: item.printAssetUrl || '',
      printAssetUrlBack: item.printAssetUrlBack || '',
      apliiqProductRef: item.mapping?.apliiqProductRef || 'TBD',
      apliiqProductId: item.mapping?.apliiqProductId || '',
      printMethod: item.mapping?.printMethod || item.customPayload?.printMethod || '',
      blank: item.mapping?.blank || item.customPayload?.blank || '',
    })),
    queuedAt: new Date().toISOString(),
  };
}

export function buildApliiqDirectPayload(order, items) {
  const flattenedVehicleTags = [...new Set(items.flatMap((item) => normalizeVehicleTags(item.vehicleTags || [])))];
  return {
    orderId: order.externalOrderId || order.orderNumber || '',
    source: order.source || 'stripe',
    customer: order.customer || {},
    shippingAddress: order.shippingAddress || {},
    currency: order.currency || 'USD',
    qualityFlags: [...new Set(items.map((item) => item.qualityTier || 'custom'))],
    vehicleTags: flattenedVehicleTags,
    items: items.map((item) => ({
      sku: item.sku,
      resolvedSku: item.resolvedSku || item.sku,
      title: item.title,
      quantity: Number(item.quantity || 1),
      size: item.size || '',
      color: item.color || item.mapping?.color || '',
      qualityTier: item.qualityTier || 'custom',
      vehicleTags: normalizeVehicleTags(item.vehicleTags || []),
      customizationMode: item.customizationMode || 'ai',
      apliiqProductRef: item.mapping?.apliiqProductRef || '',
      apliiqProductId: item.mapping?.apliiqProductId || '',
      blank: item.customPayload?.blank || item.mapping?.blank || '',
      printMethod: item.customPayload?.printMethod || item.mapping?.printMethod || '',
      artwork: {
        front: item.printAssetUrl || item.customPayload?.designAssetUrl || '',
        back: item.printAssetUrlBack || item.customPayload?.designAssetUrlBack || '',
        mockup: item.customPayload?.mockupUrl || item.mapping?.mockupUrl || '',
        mockupBack: item.customPayload?.mockupUrlBack || item.mapping?.mockupUrlBack || '',
      },
      printSpec: {
        placement: item.customPayload?.placement || 'front',
        placements: item.customPayload?.placements || [],
        notes: item.customPayload?.notes || '',
        dimensions: item.customPayload?.dimensions || null,
      },
      metadata: item.metadata || {},
    })),
    submittedAt: new Date().toISOString(),
  };
}

function validateApliiqDirectPayload(payload = {}) {
  const errors = [];
  if (!Array.isArray(payload.items) || !payload.items.length) return ['missing_apliiq_items'];
  payload.items.forEach((item, index) => {
    if (!item.apliiqProductRef && !item.apliiqProductId) errors.push(`missing_apliiq_product_ref_for_${item.resolvedSku || index}`);
    if (!item.artwork?.front) errors.push(`missing_front_artwork_for_${item.resolvedSku || index}`);
    if (!item.printMethod) errors.push(`missing_print_method_for_${item.resolvedSku || index}`);
    if (!item.blank) errors.push(`missing_blank_for_${item.resolvedSku || index}`);
  });
  return errors;
}

export async function submitToApliiq(order, items, env) {
  const dryRun = isDryRun(env);
  const payload = buildApliiqDirectPayload(order, items);
  const errors = validateApliiqDirectPayload(payload);
  const url = env?.APLIIQ_API_URL || '';
  const hasKey = Boolean(env?.APLIIQ_API_KEY);

  if (errors.length) {
    return { ok: false, dryRun, sent: false, error: 'invalid_apliiq_payload', errors, url, payload };
  }

  if (dryRun || !url || !hasKey) {
    console.log('[DRY_RUN][APLIIQ] would POST order', JSON.stringify({ url, payload }));
    return {
      ok: true,
      dryRun: true,
      sent: false,
      mode: url && hasKey ? 'dry_run' : 'dry_run_no_api_config',
      url,
      payload,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.APLIIQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, dryRun: false, sent: true, status: response.status, body, url, payload };
}

export async function queueApliiqOrder(order, items) {
  const entry = buildApliiqQueueEntry(order, items);
  console.log('[APLIIQ_QUEUE] manual/CSV fulfillment needed', JSON.stringify(entry));
  return { ok: true, dryRun: true, sent: false, mode: 'manual_queue', entry };
}

// ---------------------------------------------------------------------------
// Tracking state + sync
// ---------------------------------------------------------------------------

function trackingRecordKey(orderId = '') {
  return `tracking_order:${orderId}`;
}

async function putTrackingRecord(env, record = {}) {
  if (!env?.ORDER_STATE || !record?.orderId) return false;
  const next = {
    version: 1,
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await env.ORDER_STATE.put(trackingRecordKey(record.orderId), JSON.stringify(next));
  return next;
}

async function getTrackingRecord(env, orderId = '') {
  if (!env?.ORDER_STATE || !orderId) return null;
  const raw = await env.ORDER_STATE.get(trackingRecordKey(orderId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function listTrackingRecords(env) {
  if (!env?.ORDER_STATE) return [];
  const records = [];
  let cursor;
  do {
    const page = await env.ORDER_STATE.list({ prefix: 'tracking_order:', cursor });
    for (const key of page.keys || []) {
      const record = await getTrackingRecord(env, String(key.name || '').replace(/^tracking_order:/, ''));
      if (record) records.push(record);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return records;
}

function buildTrackingRecord(order, routing, dispatch) {
  const customcat = dispatch?.customcat;
  if (!customcat?.ok || !customcat?.sent) return null;
  return {
    orderId: routing.orderId || order.externalOrderId || order.orderNumber || '',
    source: order.source || 'unknown',
    supplier: 'customcat',
    customer: order.customer || {},
    shippingAddress: order.shippingAddress || {},
    customcatOrderId: customcat.body?.CUSTOMCAT_ORDER_ID || '',
    sandbox: String(customcat.payload?.sandbox || '0') === '1',
    status: 'submitted',
    notifiedAt: '',
    emailNotification: {
      status: 'pending',
      attempts: 0,
      lastError: '',
    },
    tracking: {
      number: '',
      carrier: '',
      method: '',
      url: '',
    },
    items: (routing.groups?.customcat || []).map((item) => ({
      sku: item.sku,
      resolvedSku: item.resolvedSku || item.sku,
      quantity: Number(item.quantity || 1),
      size: item.size || '',
      color: item.color || '',
      supplierProductRef: item.supplierProductRef || '',
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customcatRequest: {
      url: customcat.url,
      payload: customcat.payload,
    },
  };
}

async function persistCustomCatTrackingRecord(env, order, routing, dispatch) {
  const record = buildTrackingRecord(order, routing, dispatch);
  if (!record) return null;
  return putTrackingRecord(env, record);
}

function isTrackingConfigured(env) {
  return Boolean(env?.TRACKING_EMAIL_API_KEY && env?.TRACKING_EMAIL_FROM);
}

async function fetchCustomCatOrderStatus(env, record = {}) {
  const base = env?.CUSTOMCAT_API_BASE || 'https://customcat-beta.mylocker.net/api/v1';
  const query = new URLSearchParams({ api_key: env?.CUSTOMCAT_API_KEY || '' });
  if (record.sandbox) query.set('sandbox', '1');
  const url = `${base}/order/status/${encodeURIComponent(record.orderId)}?${query.toString()}`;
  const response = await fetch(url, { method: 'GET' });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  // SECURITY: never surface CUSTOMCAT_API_KEY. Return a redacted URL (api_key query param stripped)
  // so it cannot leak through /jobs/poll-tracking JSON, logs, or the cron result.
  const safeUrl = `${base}/order/status/${encodeURIComponent(record.orderId)}${record.sandbox ? '?sandbox=1' : ''}`;
  return { ok: response.ok, status: response.status, url: safeUrl, body };
}

function extractTrackingDetails(statusBody = {}) {
  const shipments = Array.isArray(statusBody?.SHIPMENTS) ? statusBody.SHIPMENTS : [];
  const firstShipment = shipments[0] || {};
  return {
    orderStatus: String(statusBody?.ORDER_STATUS || ''),
    customcatOrderId: String(statusBody?.CUSTOMCAT_ORDER_ID || ''),
    tracking: {
      number: String(firstShipment?.TRACKING_ID || ''),
      carrier: String(firstShipment?.VENDOR || ''),
      method: String(firstShipment?.METHOD || ''),
      url: String(firstShipment?.TRACKING_URL || statusBody?.TRACKING_URL || ''),
    },
    shipments,
    raw: statusBody,
  };
}

function shouldSendTrackingNotification(record = {}, trackingUpdate = {}) {
  if (!record?.customer?.email) return false;
  if (!trackingUpdate?.tracking?.number) return false;
  if (String(trackingUpdate.orderStatus || '').toLowerCase() !== 'shipped') return false;
  if (record?.emailNotification?.status === 'sent') return false;
  return true;
}

function buildTrackingEmailMessage(record = {}, trackingUpdate = {}) {
  const orderLabel = record.orderId || 'your order';
  const tracking = trackingUpdate.tracking || {};
  const customerName = record.customer?.name || 'there';
  const subject = `Your FLTWHT order ${orderLabel} has shipped`;
  const trackingLine = tracking.url
    ? `Track it here: ${tracking.url}`
    : `Tracking number: ${tracking.number}`;
  const text = [
    `Hi ${customerName},`,
    '',
    `Your FLTWHT order ${orderLabel} has shipped.`,
    tracking.method || tracking.carrier ? `Carrier: ${tracking.method || tracking.carrier}` : '',
    trackingLine,
    '',
    'Thank you for shopping FLTWHT.',
  ].filter(Boolean).join('\n');
  const html = `<p>Hi ${customerName},</p><p>Your FLTWHT order <strong>${orderLabel}</strong> has shipped.</p><p>${tracking.method || tracking.carrier ? `Carrier: <strong>${tracking.method || tracking.carrier}</strong><br>` : ''}${tracking.url ? `Track it here: <a href="${tracking.url}">${tracking.url}</a>` : `Tracking number: <strong>${tracking.number}</strong>`}</p><p>Thank you for shopping FLTWHT.</p>`;
  return { subject, text, html };
}

async function sendTrackingEmail(env, record = {}, trackingUpdate = {}) {
  if (!isTrackingConfigured(env)) {
    return { ok: false, sent: false, reason: 'tracking_email_not_configured' };
  }
  if (!record?.customer?.email) {
    return { ok: false, sent: false, reason: 'missing_customer_email' };
  }
  const message = buildTrackingEmailMessage(record, trackingUpdate);
  const payload = {
    from: env.TRACKING_EMAIL_FROM,
    to: [record.customer.email],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
  if (env.TRACKING_EMAIL_REPLY_TO) payload.reply_to = env.TRACKING_EMAIL_REPLY_TO;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TRACKING_EMAIL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    sent: response.ok,
    status: response.status,
    body,
  };
}

export async function runTrackingPoll(env) {
  const dryRun = isDryRun(env);
  if (!env?.ORDER_STATE) {
    return {
      ok: true,
      dryRun,
      stub: true,
      inactiveReason: 'missing_ORDER_STATE_binding',
      ranAt: new Date().toISOString(),
      trackedOrders: 0,
      processed: [],
    };
  }
  if (!env?.CUSTOMCAT_API_KEY) {
    return {
      ok: false,
      dryRun,
      inactiveReason: 'missing_CUSTOMCAT_API_KEY',
      ranAt: new Date().toISOString(),
      trackedOrders: 0,
      processed: [],
    };
  }

  const records = await listTrackingRecords(env);
  const activeRecords = records.filter((record) => record?.supplier === 'customcat' && record?.status !== 'shipped_notified');
  const processed = [];

  for (const record of activeRecords) {
    const statusResult = await fetchCustomCatOrderStatus(env, record);
    if (!statusResult.ok) {
      const failedRecord = {
        ...record,
        lastStatusCheckAt: new Date().toISOString(),
        statusCheckError: `customcat_status_${statusResult.status}`,
      };
      await putTrackingRecord(env, failedRecord);
      processed.push({ orderId: record.orderId, ok: false, error: failedRecord.statusCheckError, statusUrl: statusResult.url });
      continue;
    }

    const trackingUpdate = extractTrackingDetails(statusResult.body);
    const nextRecord = {
      ...record,
      customcatOrderId: trackingUpdate.customcatOrderId || record.customcatOrderId || '',
      status: String(trackingUpdate.orderStatus || '').toLowerCase() === 'shipped' ? 'shipped' : (record.status || 'submitted'),
      tracking: trackingUpdate.tracking,
      customcatStatus: trackingUpdate.raw,
      lastStatusCheckAt: new Date().toISOString(),
      statusCheckError: '',
      emailNotification: {
        status: record.emailNotification?.status || 'pending',
        attempts: Number(record.emailNotification?.attempts || 0),
        lastError: record.emailNotification?.lastError || '',
      },
    };

    let emailResult = { ok: false, sent: false, reason: 'not_attempted' };
    if (shouldSendTrackingNotification(nextRecord, trackingUpdate)) {
      emailResult = await sendTrackingEmail(env, nextRecord, trackingUpdate);
      nextRecord.emailNotification = {
        status: emailResult.sent ? 'sent' : 'failed',
        attempts: Number(nextRecord.emailNotification?.attempts || 0) + 1,
        lastError: emailResult.sent ? '' : (emailResult.reason || `email_http_${emailResult.status || 'unknown'}`),
      };
      if (emailResult.sent) {
        nextRecord.notifiedAt = new Date().toISOString();
        nextRecord.status = 'shipped_notified';
      }
    }

    await putTrackingRecord(env, nextRecord);
    processed.push({
      orderId: record.orderId,
      ok: true,
      orderStatus: trackingUpdate.orderStatus,
      trackingNumber: trackingUpdate.tracking.number,
      emailNotification: nextRecord.emailNotification.status,
      statusUrl: statusResult.url,
    });
  }

  return {
    ok: true,
    dryRun,
    stub: false,
    ranAt: new Date().toISOString(),
    trackedOrders: activeRecords.length,
    processed,
  };
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handleStripeWebhookRequest(request, env) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('stripe-signature') || '';

  if (!env?.STRIPE_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'missing_STRIPE_WEBHOOK_SECRET' }, 500);
  }

  try {
    await verifyStripeSignature({ payload: rawBody, signatureHeader, secret: env.STRIPE_WEBHOOK_SECRET });
  } catch (error) {
    return json({ ok: false, error: String(error?.message || error) }, 400);
  }

  let event;
  try {
    event = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json({ ok: false, error: 'invalid_json_payload' }, 400);
  }

  if (event?.type !== 'checkout.session.completed') {
    return json({ ok: true, received: true, ignored: true, type: event?.type || 'unknown' }, 200);
  }

  const session = event?.data?.object || {};
  const internalRaw = sessionToInternalOrder(session);
  const order = normalizeOrder({ source: 'stripe', raw: internalRaw });
  const routing = routeOrderBySupplier(order);

  const dispatch = { customcat: null, apliiq: null };
  let trackingRecord = null;
  if (routing.groups.customcat.length) {
    dispatch.customcat = await submitToCustomCat(order, routing.groups.customcat, env);
    trackingRecord = await persistCustomCatTrackingRecord(env, order, routing, dispatch);
  }
  if (routing.groups.apliiq.length) {
    const directApliiqItems = routing.groups.apliiq.filter((item) => item.directApliiq);
    const queuedApliiqItems = routing.groups.apliiq.filter((item) => !item.directApliiq);
    if (directApliiqItems.length && queuedApliiqItems.length) {
      dispatch.apliiq = {
        direct: await submitToApliiq(order, directApliiqItems, env),
        queued: await queueApliiqOrder(order, queuedApliiqItems),
      };
    } else if (directApliiqItems.length) {
      dispatch.apliiq = await submitToApliiq(order, directApliiqItems, env);
    } else {
      dispatch.apliiq = await queueApliiqOrder(order, queuedApliiqItems);
    }
  }

  return json({
    ok: true,
    received: true,
    type: event.type,
    dryRun: isDryRun(env),
    orderId: routing.orderId,
    size: order.customFields?.size || '',
    missingMappings: routing.missingMappings,
    dispatch,
    tracking: trackingRecord ? {
      stored: true,
      orderId: trackingRecord.orderId,
      customcatOrderId: trackingRecord.customcatOrderId,
    } : {
      stored: false,
    },
  }, 200);
}

async function handlePollTrackingRequest(env, request) {
  // Optional hardening: if BRIDGE_ADMIN_TOKEN secret is set, require header `x-bridge-token`
  // to match. Backward compatible (open) when the secret is unset. The cron path calls
  // runTrackingPoll(env) directly and is unaffected.
  const required = env?.BRIDGE_ADMIN_TOKEN;
  if (required) {
    const provided = (request && request.headers && request.headers.get('x-bridge-token')) || '';
    if (provided !== required) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
  }
  const result = await runTrackingPoll(env);
  return json(result, 200);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return json(healthPayload(env));
      }

      if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
        return await handleStripeWebhookRequest(request, env);
      }

      if (request.method === 'GET' && url.pathname === '/jobs/poll-tracking') {
        return await handlePollTrackingRequest(env, request);
      }

      return json({ ok: false, error: 'not_found' }, 404);
    } catch (error) {
      return json({ ok: false, error: 'internal_error', message: String(error?.message || error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const run = runTrackingPoll(env).then((result) => {
      console.log('[scheduled] tracking-sync stub result', JSON.stringify(result));
      return result;
    });
    if (ctx?.waitUntil) ctx.waitUntil(run);
    else await run;
  },
};
