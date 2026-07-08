import { readJson, sendText } from '../../lib/http.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { resolveCustomCatSku, loadSkuMap } from '../../lib/sku-map.js';
import { toCsv } from '../../lib/csv.js';

export async function exportCustomCatCsv(req, res) {
  const payload = await readJson(req, { orders: [] });
  const skuMap = loadSkuMap();
  const rows = [[
    'external_order_id',
    'source',
    'sku',
    'mapped_catalog_sku',
    'title',
    'quantity',
    'name',
    'email',
    'address1',
    'address2',
    'city',
    'state',
    'postal_code',
    'country',
    'phone'
  ]];

  for (const rawOrder of payload.orders || []) {
    const order = normalizeOrder({ source: rawOrder.source || 'unknown', raw: rawOrder });
    for (const item of order.items) {
      const mapped = resolveCustomCatSku(item, skuMap);
      rows.push([
        order.externalOrderId || '',
        order.source || '',
        item.sku || '',
        mapped?.catalogSku || '',
        item.title || '',
        item.quantity || 1,
        order.shippingAddress?.name || order.customer?.name || '',
        order.customer?.email || '',
        order.shippingAddress?.line1 || '',
        order.shippingAddress?.line2 || '',
        order.shippingAddress?.city || '',
        order.shippingAddress?.state || '',
        order.shippingAddress?.postalCode || '',
        order.shippingAddress?.country || '',
        order.shippingAddress?.phone || '',
      ]);
    }
  }

  sendText(res, 200, toCsv(rows), 'text/csv');
}
