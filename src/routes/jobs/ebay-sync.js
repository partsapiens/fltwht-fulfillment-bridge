import { fetchEbayOrders } from '../../adapters/ebay.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { submitOrderToCustomCat } from '../../adapters/customcat.js';
import { sendJson } from '../../lib/http.js';

export async function runEbaySync(_req, res) {
  const rawOrders = await fetchEbayOrders();
  const results = [];
  for (const raw of rawOrders) {
    const normalized = normalizeOrder({ source: 'ebay', raw });
    results.push(await submitOrderToCustomCat(normalized));
  }
  sendJson(res, 200, { synced: rawOrders.length, results });
}
