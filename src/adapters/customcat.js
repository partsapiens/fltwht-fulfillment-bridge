import { getIntegrationStatus } from '../lib/config.js';
import { resolveCustomCatSku, loadSkuMap } from '../lib/sku-map.js';

export async function submitOrderToCustomCat(order) {
  const skuMap = loadSkuMap();
  const mappedItems = order.items.map((item) => ({
    ...item,
    customcat: resolveCustomCatSku(item, skuMap),
  }));

  const missingMappings = mappedItems.filter((item) => !item.customcat).map((item) => item.sku);
  const integrations = getIntegrationStatus();

  return {
    accepted: false,
    mode: integrations.customcat.apiConfigured ? 'api_pending' : 'csv_fallback_ready',
    externalOrderId: order.externalOrderId,
    missingMappings,
    mappedItems,
  };
}
