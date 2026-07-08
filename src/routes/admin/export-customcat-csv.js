export async function exportCustomCatCsv(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  const payload = body ? JSON.parse(body) : { orders: [] };
  const lines = ['order_id,sku,quantity'];
  for (const order of payload.orders || []) {
    for (const item of order.items || []) {
      lines.push([order.externalOrderId || '', item.sku || '', item.quantity || 1].join(','));
    }
  }
  res.writeHead(200, { 'content-type': 'text/csv' });
  res.end(lines.join('\n'));
}
