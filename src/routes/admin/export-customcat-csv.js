import { readJson, sendText } from '../../lib/http.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { resolveCustomCatSku, loadSkuMap } from '../../lib/sku-map.js';
import { toCsv } from '../../lib/csv.js';

export const CUSTOMCAT_CSV_HEADERS = ['OrderId','LineItemId','Quantity','SKU','ProductId','ProductName','Color','Size','DesignPosition','ShipToFirstName','ShipToLastName','ShipToAddress','ShipToAddress2','ShipToCity','ShipToZip','ShipToState','ShipToCountry','ShipToPhone','ShippingMethod','CustomerEmail'];

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function exportCustomCatCsv(req, res) {
  const payload = await readJson(req, { orders: [] });
  const skuMap = loadSkuMap();
  const rows = [CUSTOMCAT_CSV_HEADERS];
  for (const rawOrder of payload.orders || []) {
    const order = normalizeOrder({ source: rawOrder.source || 'unknown', raw: rawOrder });
    const { firstName, lastName } = splitName(order.shippingAddress?.name || order.customer?.name || '');
    order.items.forEach((item, index) => {
      const mapped = resolveCustomCatSku(item, skuMap);
      rows.push([
        order.externalOrderId || '', `${order.externalOrderId || 'order'}-${index + 1}`, item.quantity || 1, item.sku || '', mapped?.productId || '', item.title || mapped?.productName || '', mapped?.color || item.color || '', mapped?.size || item.size || '', mapped?.designPosition || 'Front', firstName, lastName, order.shippingAddress?.line1 || '', order.shippingAddress?.line2 || '', order.shippingAddress?.city || '', order.shippingAddress?.postalCode || '', order.shippingAddress?.state || '', order.shippingAddress?.country || '', order.shippingAddress?.phone || '', mapped?.shippingMethod || 'Economy', order.customer?.email || ''
      ]);
    });
  }
  sendText(res, 200, toCsv(rows), 'text/csv');
}
