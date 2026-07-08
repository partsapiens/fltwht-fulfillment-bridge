import { fetchEbayOrders } from '../../adapters/ebay.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { submitOrderToCustomCat } from '../../adapters/customcat.js';
import { sendJson } from '../../lib/http.js';

export async function runEbaySync(_req, res) {
  const fetched = await fetchEbayOrders();
  if (!fetched.ok) {
    sendJson(res, 200, fetched);
    return;
  }
  const rawOrders = fetched.orders || [];
  const results = [];
  for (const raw of rawOrders) {
    const normalized = normalizeOrder({ source: 'ebay', raw });
    results.push(await submitOrderToCustomCat(normalized));
  }
  sendJson(res, 200, { synced: rawOrders.length, results });
}
