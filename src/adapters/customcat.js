import { getConfig, getIntegrationStatus } from '../lib/config.js';
import { resolveCustomCatSku, loadSkuMap } from '../lib/sku-map.js';

function isDryRun(options = {}) {
  if (typeof options.dryRun === 'boolean') return options.dryRun;
  const env = String(process.env.DRY_RUN ?? '1').toLowerCase();
  return !(env === '0' || env === 'false' || env === 'off');
}

function resolveCatalogSku(mapping, lineItem) {
  if (!mapping) return null;
  const size = String(lineItem?.size || lineItem?.Size || '').toUpperCase();
  const bySize = mapping.catalogSkusBySize || {};
  if (size && bySize[size]) return bySize[size];
  if (mapping.catalogSku) return mapping.catalogSku;
  return null;
}

/**
 * Submit a normalized order to CustomCat.
 * When DRY_RUN is on (default), returns a dry-run acceptance payload without calling CustomCat.
 * Live HTTP order create still needs design/artwork fields — until then live mode returns
 * `mode: 'csv_fallback_ready'` with fully mapped catalog SKUs for manual/CSV import.
 */
export async function submitOrderToCustomCat(order, options = {}) {
  const dryRun = isDryRun(options);
  const skuMap = loadSkuMap();
  const mappedItems = (order.items || []).map((item) => {
    const customcat = resolveCustomCatSku(item, skuMap);
    const catalogSku = resolveCatalogSku(customcat, item);
    return {
      ...item,
      customcat,
      catalogSku,
      productId: customcat?.productId || null,
      color: customcat?.color || item.color || null,
      colorId: customcat?.colorId || null,
    };
  });
  const missingMappings = mappedItems
    .filter((item) => !item.customcat || item.customcat.productId === 'TBD' || !item.catalogSku)
    .map((item) => item.sku);
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

  if (dryRun) {
    return {
      accepted: true,
      dryRun: true,
      mode: 'dry_run',
      externalOrderId: order.externalOrderId,
      missingMappings: [],
      mappedItems,
      note: 'DRY_RUN on — no CustomCat order created. Catalog SKUs resolved.',
    };
  }

  // Live API order create requires per-design artwork URLs CustomCat expects.
  // Until design assets are wired, return CSV-ready mapped payload (do not invent designs).
  if (!integrations.customcat.apiConfigured) {
    return {
      accepted: false,
      dryRun: false,
      mode: 'csv_fallback_ready',
      externalOrderId: order.externalOrderId,
      missingMappings: [],
      mappedItems,
      note: 'CUSTOMCAT API secrets missing — use CSV export.',
    };
  }

  return {
    accepted: false,
    dryRun: false,
    mode: 'api_pending_designs',
    externalOrderId: order.externalOrderId,
    missingMappings: [],
    mappedItems,
    note: 'Product/catalog IDs ready; wire design/artwork URLs before CustomCat HTTP create. CSV export can fulfill meanwhile.',
  };
}
