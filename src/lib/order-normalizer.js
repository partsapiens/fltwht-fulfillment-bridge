function normalizeLineItem(item = {}) {
  return {
    sku: item.sku || item.SKU || item.customSku || null,
    title: item.title || item.name || item.description || '',
    quantity: Number(item.quantity || item.qty || 1),
    unitPrice: Number(item.unitPrice || item.price || 0),
    color: item.color || item.variantColor || '',
    size: item.size || item.variantSize || '',
    printAssetUrl: item.printAssetUrl || '',
    metadata: item.metadata || {},
  };
}

function normalizeAddress(address = {}) {
  return {
    name: address.name || '',
    line1: address.line1 || address.address1 || '',
    line2: address.line2 || address.address2 || '',
    city: address.city || '',
    state: address.state || address.province || '',
    postalCode: address.postalCode || address.zip || '',
    country: address.country || address.countryCode || '',
    phone: address.phone || '',
  };
}

export function normalizeOrder({ source, raw }) {
  const items = (raw?.items || raw?.line_items || raw?.lineItems || []).map(normalizeLineItem);
  return {
    source,
    externalOrderId: raw?.id || raw?.orderId || raw?.payment_intent || raw?.checkout_session_id || null,
    orderNumber: raw?.orderNumber || raw?.number || raw?.name || null,
    customer: raw?.customer || {
      email: raw?.customer_email || raw?.buyerEmail || '',
      name: raw?.customer_name || raw?.buyerName || '',
    },
    items,
    currency: raw?.currency || raw?.currencyCode || 'USD',
    shippingAddress: normalizeAddress(raw?.shippingAddress || raw?.shipping_address || raw?.recipient || {}),
    notes: raw?.notes || '',
    raw,
  };
}
