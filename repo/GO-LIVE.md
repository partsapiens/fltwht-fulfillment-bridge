# GO-LIVE

This repo is intentionally paused at the preparation stage.
Do not wire live routing until the operator provides the required credentials and product identifiers below.

## Handoff index

Runbooks:
- `runbooks/etsy-apliiq-connect.md`
- `runbooks/customcat-standard-productid.md`
- `runbooks/ebay-apparel.md`

Prepared listing specs:
- `repo/listings/ebay-border-run.md`
- `repo/listings/etsy-border-run.md`

## Launch path

Default launch path:
- FLTWHT.com orders -> bridge -> CustomCat CSV/manual fulfillment
- eBay orders -> bridge -> CustomCat CSV/manual fulfillment
- Etsy can use native supplier integrations if needed, but that is outside this repo's scope

Reason:
- CustomCat CSV/manual is already confirmed and documented
- CustomCat API is not blocked by a paid-plan finding, but live credential verification is still operator-gated
- Hosting is not chosen yet, so live webhooks should not be expanded further right now

## Required operator inputs

### Stripe
Place in environment/secrets for the bridge runtime:
- `STRIPE_WEBHOOK_SECRET`
- optional later: `STRIPE_API_KEY`

Used by:
- webhook signature verification in `src/adapters/stripe.js`

### eBay
Place in environment/secrets for the bridge runtime:
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`

Used by:
- future eBay OAuth + Fulfillment API order pull
- current stub location: `src/adapters/ebay.js`

### CustomCat
Needed before live CustomCat routing:
- `CUSTOMCAT_API_KEY` (read/write if using API)
- `CUSTOMCAT_API_BASE` if required by the issued docs/account
- real `productId` values for every `*-STD` SKU routed to CustomCat

Used by:
- supplier routing map in `data/sku-map.json`
- future API call path in `src/adapters/customcat.js`
- CSV export in `src/routes/admin/export-customcat-csv.js`

### Apliiq
Needed before live Signature-tier routing through this repo:
- stable supplier product reference or product ID for every `*-SIG` SKU

Current live-first reference already recorded:
- `FW-BRR-TE-SIG` -> `BORDER RUN '89 | Gildan 5000 | DTF`

Used by:
- supplier routing map in `data/sku-map.json`

## Where each input goes

### Runtime secrets
Environment variables:
- `.env` locally
- deployment secrets in the chosen host

Current expected keys are listed in:
- `.env.example`

### Supplier SKU routing
Update:
- `data/sku-map.json`

Rules:
- `*-STD` -> `supplier: customcat` and a real `productId`
- `*-SIG` -> `supplier: apliiq` and a real `apliiqProductRef` or equivalent stable supplier ID

### Verification report
Run:
```bash
npm run report:unmapped
```

This updates:
- `reports/unmapped-skus.json`

## Hosting decision still needed

Before building more live webhook/worker logic, choose the 24/7 host.
Current best $0 candidate identified in prior repo work:
- Cloudflare Workers Free

But this file does not assume deployment is finalized until the operator confirms it.
