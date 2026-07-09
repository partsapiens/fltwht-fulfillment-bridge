import fs from 'node:fs';
import path from 'node:path';

const skuMapPath = path.resolve(process.cwd(), 'data/sku-map.json');

export function loadSkuMap() {
  try {
    const raw = fs.readFileSync(skuMapPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function resolveSkuMapping(lineItem, skuMap = loadSkuMap()) {
  const key = lineItem?.sku;
  if (!key) return null;
  return skuMap[key] || null;
}

export function resolveCustomCatSku(lineItem, skuMap = loadSkuMap()) {
  const mapping = resolveSkuMapping(lineItem, skuMap);
  if (!mapping || mapping.supplier !== 'customcat') return null;
  return mapping;
}
