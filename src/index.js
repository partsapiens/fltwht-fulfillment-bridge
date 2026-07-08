import http from 'node:http';
import { handleStripeWebhook } from './routes/webhooks/stripe.js';
import { runEbaySync } from './routes/jobs/ebay-sync.js';
import { exportCustomCatCsv } from './routes/admin/export-customcat-csv.js';

const port = Number(process.env.PORT || 8787);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'fltwht-fulfillment-bridge' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/webhooks/stripe') {
      await handleStripeWebhook(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/jobs/ebay-sync') {
      await runEbaySync(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/admin/export-customcat-csv') {
      await exportCustomCatCsv(req, res);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error', message: String(error?.message || error) }));
  }
});

server.listen(port, () => {
  console.log(`FLTWHT Fulfillment Bridge listening on :${port}`);
});
