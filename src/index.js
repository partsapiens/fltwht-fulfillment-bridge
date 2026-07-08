import http from 'node:http';
import { handleStripeWebhook } from './routes/webhooks/stripe.js';
import { runEbaySync } from './routes/jobs/ebay-sync.js';
import { exportCustomCatCsv } from './routes/admin/export-customcat-csv.js';
import { getConfig, getIntegrationStatus } from './lib/config.js';
import { sendJson } from './lib/http.js';

const config = getConfig();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'fltwht-fulfillment-bridge',
        integrations: getIntegrationStatus(),
      });
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

    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    sendJson(res, 500, { error: 'internal_error', message: String(error?.message || error) });
  }
});

server.listen(config.port, () => {
  console.log(`FLTWHT Fulfillment Bridge listening on :${config.port}`);
});
