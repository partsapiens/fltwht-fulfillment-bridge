export function resolveCustomCatSku(lineItem, skuMap) {
  const key = lineItem?.sku;
  if (!key) return null;
  return skuMap[key] || null;
}
