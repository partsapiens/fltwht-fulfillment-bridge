import { fetchEbayOrders } from '../../adapters/ebay.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { submitOrderToCustomCat } from '../../adapters/customcat.js';

export async function runEbaySync(_req, res) {
  const rawOrders = await fetchEbayOrders();
  const results = [];
  for (const raw of rawOrders) {
    const normalized = normalizeOrder({ source: 'ebay', raw });
    results.push(await submitOrderToCustomCat(normalized));
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ synced: rawOrders.length, results }));
}
