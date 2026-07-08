import fs from 'node:fs';
import path from 'node:path';

const storefrontRoot = '/Users/airm3/Documents/Claude/Projects/websites/fltwht-product-factory';
const sources = [
  path.join(storefrontRoot, 'exports/website/products.two-tier.json'),
  path.join(storefrontRoot, 'exports/etsy/etsy-listings.json'),
  path.join(storefrontRoot, 'exports/ebay/ebay-listings.json')
];
const skuMapPath = path.resolve(process.cwd(), 'data/sku-map.json');
const reportPath = path.resolve(process.cwd(), 'reports/unmapped-skus.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectSourceSkus() {
  const set = new Set();
  for (const file of sources) {
    const data = readJson(file);
    const arr = Array.isArray(data) ? data : data.products || [];
    for (const item of arr) {
      if (item?.sku) set.add(item.sku);
    }
  }
  return [...set].sort();
}

function collectMappedSkus() {
  return Object.keys(readJson(skuMapPath)).sort();
}

const allSkus = collectSourceSkus();
const mappedSkus = new Set(collectMappedSkus());
const unmappedSkus = allSkus.filter((sku) => !mappedSkus.has(sku));
const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: sources,
  totalSourceSkus: allSkus.length,
  totalMappedSkus: mappedSkus.size,
  totalUnmappedSkus: unmappedSkus.length,
  unmappedSkus
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
