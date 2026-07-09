import fs from 'node:fs';
import path from 'node:path';

const liveCatalogPath = '/Users/airm3/Documents/Claude/Projects/websites/fltwht/_site/products.json';
const skuMapPath = path.resolve(process.cwd(), 'data/sku-map.json');
const reportPath = path.resolve(process.cwd(), 'reports/unmapped-skus.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectSourceProducts() {
  const data = readJson(liveCatalogPath);
  return (data.products || []).filter((item) => item?.sku);
}

function getRequiredSupplierField(product, mapping) {
  if (mapping?.requiredIdField) return mapping.requiredIdField;
  if (product.tier === 'standard') return 'productId';
  if (product.tier === 'premium') return 'apliiqProductRef';
  return 'productId';
}

function getExpectedSupplier(product) {
  if (product.tier === 'standard') return 'customcat';
  if (product.tier === 'premium') return 'apliiq';
  return null;
}

const products = collectSourceProducts();
const skuMap = readJson(skuMapPath);
const missingRequiredSupplierIds = [];
const missingMapEntries = [];
const supplierSummary = {};

for (const product of products) {
  const mapping = skuMap[product.sku];
  const expectedSupplier = getExpectedSupplier(product);
  if (!mapping) {
    missingMapEntries.push(product.sku);
    continue;
  }
  const supplier = mapping.supplier || expectedSupplier || 'unknown';
  supplierSummary[supplier] ||= { total: 0, mapped: 0, missingRequiredId: 0 };
  supplierSummary[supplier].total += 1;
  const requiredField = getRequiredSupplierField(product, mapping);
  const requiredValue = mapping[requiredField];
  const isMissing = !requiredValue || requiredValue === 'TBD';
  if (isMissing) {
    supplierSummary[supplier].missingRequiredId += 1;
    missingRequiredSupplierIds.push({ sku: product.sku, supplier, requiredField });
  } else {
    supplierSummary[supplier].mapped += 1;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: [liveCatalogPath],
  totalSourceSkus: products.length,
  totalMappedEntries: Object.keys(skuMap).length,
  totalMissingMapEntries: missingMapEntries.length,
  totalMissingRequiredSupplierIds: missingRequiredSupplierIds.length,
  supplierSummary,
  missingMapEntries,
  missingRequiredSupplierIds
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
