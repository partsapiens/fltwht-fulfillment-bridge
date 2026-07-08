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
