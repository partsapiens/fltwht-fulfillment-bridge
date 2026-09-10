import fs from 'node:fs';
import path from 'node:path';

const skuMapPath = path.resolve(process.cwd(), 'data/sku-map.json');
const slugAliasPath = path.resolve(process.cwd(), 'data/slug-aliases.json');

export function loadSkuMap() {
  try {
    const raw = fs.readFileSync(skuMapPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function loadSlugAliases() {
  try {
    const raw = fs.readFileSync(slugAliasPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeTier(lineItem) {
  const raw = String(lineItem?.tier || lineItem?.variant || lineItem?.finish || 'standard').toLowerCase();
  if (raw.includes('sig') || raw.includes('premium') || raw.includes('apliiq')) return 'signature';
  return 'standard';
}

/** Resolve storefront slug or FW code to an FW map key. */
export function resolveFwSkuKey(lineItem, slugAliases = loadSlugAliases()) {
  const key = lineItem?.sku;
  if (!key) return null;
  if (key.startsWith('FW-')) return key;

  const alias = slugAliases[key];
  if (!alias) return null;
  const tier = normalizeTier(lineItem);
  return alias[tier] || alias.standard || null;
}

export function resolveSkuMapping(lineItem, skuMap = loadSkuMap(), slugAliases = loadSlugAliases()) {
  const fwKey = resolveFwSkuKey(lineItem, slugAliases);
  if (!fwKey) return null;
  return skuMap[fwKey] || null;
}

export function resolveCustomCatSku(lineItem, skuMap = loadSkuMap(), slugAliases = loadSlugAliases()) {
  const mapping = resolveSkuMapping(lineItem, skuMap, slugAliases);
  if (!mapping || mapping.supplier !== 'customcat') return null;
  return mapping;
}
