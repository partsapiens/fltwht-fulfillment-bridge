import { getConfig } from '../lib/config.js';

export function getRequiredEbayCredentials() {
  return ['EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','EBAY_REFRESH_TOKEN'];
}

export async function fetchEbayOrders() {
  const cfg = getConfig();
  const missing = getRequiredEbayCredentials().filter((key) => !cfg[key === 'EBAY_CLIENT_ID' ? 'ebayClientId' : key === 'EBAY_CLIENT_SECRET' ? 'ebayClientSecret' : 'ebayRefreshToken']);
  return {
    ok: false,
    stub: true,
    reason: 'operator_credentials_required',
    missingCredentials: missing,
    todo: 'Use eBay OAuth with sell.fulfillment scope, then call the Fulfillment API to fetch paid/unfulfilled orders.'
  };
}
