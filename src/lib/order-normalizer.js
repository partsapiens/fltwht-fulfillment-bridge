export function normalizeOrder({ source, raw }) {
  return {
    source,
    externalOrderId: raw?.id || raw?.orderId || null,
    customer: raw?.customer || null,
    items: raw?.items || [],
    shippingAddress: raw?.shippingAddress || null,
    raw,
  };
}
