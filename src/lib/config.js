export function getConfig() {
  return {
    port: Number(process.env.PORT || 8787),
    baseUrl: process.env.BASE_URL || 'http://localhost:8787',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripeApiKey: process.env.STRIPE_API_KEY || '',
    ebayClientId: process.env.EBAY_CLIENT_ID || '',
    ebayClientSecret: process.env.EBAY_CLIENT_SECRET || '',
    ebayRefreshToken: process.env.EBAY_REFRESH_TOKEN || '',
    customcatApiKey: process.env.CUSTOMCAT_API_KEY || '',
    customcatApiBase: process.env.CUSTOMCAT_API_BASE || '',
  };
}

/** DRY_RUN defaults ON. Only off for 0/false/off. */
export function isDryRun(options = {}) {
  if (typeof options.dryRun === 'boolean') return options.dryRun;
  const env = String(process.env.DRY_RUN ?? '1').toLowerCase();
  return !(env === '0' || env === 'false' || env === 'off');
}

/**
 * CustomCat sandbox flag for order payloads.
 * Prefer sandbox when DRY_RUN is on or CUSTOMCAT_SANDBOX=1.
 */
export function isCustomCatSandbox(options = {}) {
  if (typeof options.sandbox === 'boolean') return options.sandbox;
  if (isDryRun(options)) return true;
  const env = String(process.env.CUSTOMCAT_SANDBOX ?? '0').toLowerCase();
  return env === '1' || env === 'true' || env === 'on';
}

export function getIntegrationStatus() {
  const cfg = getConfig();
  return {
    stripe: {
      webhookConfigured: Boolean(cfg.stripeWebhookSecret),
      apiConfigured: Boolean(cfg.stripeApiKey),
    },
    ebay: {
      configured: Boolean(cfg.ebayClientId && cfg.ebayClientSecret && cfg.ebayRefreshToken),
    },
    customcat: {
      apiConfigured: Boolean(cfg.customcatApiKey && cfg.customcatApiBase),
      csvFallbackAvailable: true,
    },
  };
}
