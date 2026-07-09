import fs from 'node:fs';
import path from 'node:path';
import { readJson, sendText } from '../../lib/http.js';
import { normalizeOrder } from '../../lib/order-normalizer.js';
import { resolveCustomCatSku, resolveSkuMapping, loadSkuMap } from '../../lib/sku-map.js';
import { toCsv } from '../../lib/csv.js';

export const CUSTOMCAT_CSV_HEADERS = ['OrderId','LineItemId','Quantity','SKU','ProductId','ProductName','Color','Size','DesignPosition','ShipToFirstName','ShipToLastName','ShipToAddress','ShipToAddress2','ShipToCity','ShipToZip','ShipToState','ShipToCountry','ShipToPhone','ShippingMethod','CustomerEmail'];
const lastSummaryPath = path.resolve(process.cwd(), 'reports/customcat-csv-last-run.json');

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
  const skippedItems = [];
  let exportedItems = 0;

  for (const rawOrder of payload.orders || []) {
    const order = normalizeOrder({ source: rawOrder.source || 'unknown', raw: rawOrder });
    const { firstName, lastName } = splitName(order.shippingAddress?.name || order.customer?.name || '');
    order.items.forEach((item, index) => {
      const mapping = resolveSkuMapping(item, skuMap);
      if (!mapping) {
        skippedItems.push({ sku: item.sku || '', reason: 'missing_mapping' });
        return;
      }
      if (mapping.supplier !== 'customcat') {
        skippedItems.push({ sku: item.sku || '', reason: 'non_customcat_supplier', supplier: mapping.supplier });
        return;
      }
      const mapped = resolveCustomCatSku(item, skuMap);
      rows.push([
        order.externalOrderId || '', `${order.externalOrderId || 'order'}-${index + 1}`, item.quantity || 1, item.sku || '', mapped?.productId || '', item.title || mapped?.productName || '', mapped?.color || item.color || '', mapped?.size || item.size || '', mapped?.designPosition || 'Front', firstName, lastName, order.shippingAddress?.line1 || '', order.shippingAddress?.line2 || '', order.shippingAddress?.city || '', order.shippingAddress?.postalCode || '', order.shippingAddress?.state || '', order.shippingAddress?.country || '', order.shippingAddress?.phone || '', mapped?.shippingMethod || 'Economy', order.customer?.email || ''
      ]);
      exportedItems += 1;
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    exportedItems,
    skippedItems,
    skippedCount: skippedItems.length
  };
  fs.writeFileSync(lastSummaryPath, JSON.stringify(summary, null, 2));
  sendText(res, 200, toCsv(rows), 'text/csv');
}
