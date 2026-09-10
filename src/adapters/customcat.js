import {
  getConfig,
  getIntegrationStatus,
  isCustomCatSandbox,
  isDryRun,
} from '../lib/config.js';
import { resolveCustomCatSku, loadSkuMap } from '../lib/sku-map.js';

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function resolveCatalogSku(mapping, lineItem) {
  if (!mapping) return null;
  const size = String(lineItem?.size || lineItem?.Size || '').toUpperCase();
  const bySize = mapping.catalogSkusBySize || {};
  if (size && bySize[size]) return bySize[size];
  if (mapping.catalogSku) return mapping.catalogSku;
  return null;
}

function resolveDesignUrl(mapping, lineItem) {
  const fromItem = lineItem?.printAssetUrl || lineItem?.designUrl || '';
  if (fromItem) return String(fromItem);
  if (mapping?.designUrl) return String(mapping.designUrl);
  return null;
}

function mapOrderItems(order, skuMap) {
  return (order.items || []).map((item) => {
    const customcat = resolveCustomCatSku(item, skuMap);
    const catalogSku = resolveCatalogSku(customcat, item);
    const designUrl = resolveDesignUrl(customcat, item);
    return {
      ...item,
      customcat,
      catalogSku,
      designUrl,
      productId: customcat?.productId || null,
      color: customcat?.color || item.color || null,
      colorId: customcat?.colorId || null,
    };
  });
}

function missingSkuKeys(mappedItems) {
  return mappedItems
    .filter((item) => !item.customcat || item.customcat.productId === 'TBD' || !item.catalogSku)
    .map((item) => item.sku);
}

function missingDesignSkus(mappedItems) {
  return mappedItems.filter((item) => !item.designUrl).map((item) => item.sku);
}

function missingShippingFields(order) {
  const ship = order.shippingAddress || {};
  const name = ship.name || order.customer?.name || '';
  const { firstName, lastName } = splitName(name);
  const required = {
    shipping_first_name: firstName,
    shipping_last_name: lastName || firstName,
    shipping_address1: ship.line1,
    shipping_city: ship.city,
    shipping_state: ship.state,
    shipping_zip: ship.postalCode,
    shipping_country: ship.country,
  };
  return Object.entries(required)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);
}

/**
 * Build CustomCat external-design order JSON from a normalized order + mapped items.
 * Does not include api_key unless includeApiKey is true (never log/return that in HTTP responses).
 */
export function buildCustomCatOrderPayload(order, mappedItems, options = {}) {
  const ship = order.shippingAddress || {};
  const { firstName, lastName } = splitName(ship.name || order.customer?.name || '');
  const shippingMethod =
    mappedItems.find((item) => item.customcat?.shippingMethod)?.customcat.shippingMethod ||
    'Economy';

  const payload = {
    shipping_first_name: firstName,
    shipping_last_name: lastName || firstName,
    shipping_address1: ship.line1 || '',
    shipping_address2: ship.line2 || '',
    shipping_city: ship.city || '',
    shipping_state: ship.state || '',
    shipping_zip: ship.postalCode || '',
    shipping_country: ship.country || '',
    shipping_email: order.customer?.email || '',
    shipping_phone: ship.phone || '',
    shipping_method: shippingMethod,
    items: mappedItems.map((item) => {
      const line = {
        catalog_sku: String(item.catalogSku),
        design_url: String(item.designUrl),
        quantity: Number(item.quantity || 1),
      };
      if (item.designUrlBack || item.printAssetUrlBack) {
        line.design_url_back = String(item.designUrlBack || item.printAssetUrlBack);
      }
      return line;
    }),
    sandbox: isCustomCatSandbox(options) ? '1' : '0',
  };

  if (options.includeApiKey) {
    const cfg = getConfig();
    payload.api_key = cfg.customcatApiKey;
  }

  return payload;
}

function orderPostUrl(base, externalOrderId) {
  const root = String(base || '').replace(/\/$/, '');
  if (!root) return null;
  if (externalOrderId) return `${root}/order/${encodeURIComponent(externalOrderId)}`;
  return `${root}/order`;
}

async function postCustomCatOrder(order, mappedItems, options = {}) {
  const cfg = getConfig();
  const url = orderPostUrl(cfg.customcatApiBase, order.externalOrderId);
  const body = buildCustomCatOrderPayload(order, mappedItems, {
    ...options,
    includeApiKey: true,
  });
  const fetcher = options.fetch || globalThis.fetch;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { ok: response.ok, status: response.status, url, payload };
}

/**
 * Submit a normalized order to CustomCat (external-design workflow).
 * When DRY_RUN is on (default), returns a dry-run acceptance payload without POSTing.
 */
export async function submitOrderToCustomCat(order, options = {}) {
  const dryRun = isDryRun(options);
  const skuMap = options.skuMap || loadSkuMap();
  const mappedItems = mapOrderItems(order, skuMap);
  const missingMappings = missingSkuKeys(mappedItems);
  const integrations = getIntegrationStatus();

  if (missingMappings.length) {
    return {
      accepted: false,
      dryRun,
      mode: 'unmapped_skus',
      externalOrderId: order.externalOrderId,
      missingMappings,
      mappedItems,
    };
  }

  const missingDesigns = missingDesignSkus(mappedItems);
  const missingShipping = missingShippingFields(order);
  const previewPayload = buildCustomCatOrderPayload(order, mappedItems, options);

  if (dryRun) {
    return {
      accepted: true,
      dryRun: true,
      mode: 'dry_run',
      externalOrderId: order.externalOrderId,
      missingMappings: [],
      missingDesigns,
      missingShipping,
      mappedItems,
      customCatPayload: previewPayload,
      note:
        'DRY_RUN on — no CustomCat order created. Catalog SKUs and design URLs resolved when present.',
    };
  }

  if (!integrations.customcat.apiConfigured) {
    return {
      accepted: false,
      dryRun: false,
      mode: 'csv_fallback_ready',
      externalOrderId: order.externalOrderId,
      missingMappings: [],
      missingDesigns,
      missingShipping,
      mappedItems,
      customCatPayload: previewPayload,
      note: 'CUSTOMCAT API secrets missing — use CSV export.',
    };
  }

  if (missingDesigns.length || missingShipping.length) {
    return {
      accepted: false,
      dryRun: false,
      mode: 'api_pending_fields',
      externalOrderId: order.externalOrderId,
      missingMappings: [],
      missingDesigns,
      missingShipping,
      mappedItems,
      customCatPayload: previewPayload,
      note: 'catalog_sku ready; design_url and/or shipping fields still required before CustomCat HTTP create.',
    };
  }

  try {
    const result = await postCustomCatOrder(order, mappedItems, options);
    if (!result.ok) {
      return {
        accepted: false,
        dryRun: false,
        mode: 'api_error',
        externalOrderId: order.externalOrderId,
        httpStatus: result.status,
        mappedItems,
        // Never echo api_key; response body from CustomCat only.
        providerResponse: result.payload,
        note: 'CustomCat order POST failed.',
      };
    }

    return {
      accepted: true,
      dryRun: false,
      mode: 'api_submitted',
      externalOrderId: order.externalOrderId,
      httpStatus: result.status,
      mappedItems,
      providerResponse: result.payload,
      sandbox: previewPayload.sandbox,
    };
  } catch (error) {
    return {
      accepted: false,
      dryRun: false,
      mode: 'api_error',
      externalOrderId: order.externalOrderId,
      mappedItems,
      note: String(error?.message || error),
    };
  }
}

export { isDryRun, isCustomCatSandbox };
