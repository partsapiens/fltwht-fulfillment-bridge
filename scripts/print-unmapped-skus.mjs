import fs from 'node:fs';
import path from 'node:path';

const liveCatalogPath = '/Users/airm3/Documents/Claude/Projects/websites/fltwht/_site/products.json';
const skuMapPath = path.resolve(process.cwd(), 'data/sku-map.json');
const reportPath = path.resolve(process.cwd(), 'reports/unmapped-skus.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectSourceSkus() {
  const data = readJson(liveCatalogPath);
  const arr = data.products || [];
  return arr.map((item) => item?.sku).filter(Boolean).sort();
}

function collectMappedSkus() {
  return Object.keys(readJson(skuMapPath)).sort();
}

const allSkus = collectSourceSkus();
const mappedSkus = new Set(collectMappedSkus());
const unmappedSkus = allSkus.filter((sku) => !mappedSkus.has(sku));
const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: [liveCatalogPath],
  totalSourceSkus: allSkus.length,
  totalMappedSkus: mappedSkus.size,
  totalUnmappedSkus: unmappedSkus.length,
  unmappedSkus
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
