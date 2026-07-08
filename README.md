# FLTWHT Fulfillment Bridge

Middleware to route FLTWHT orders from eBay and the static site into CustomCat fulfillment.

## Goal

Bridge unsupported sales channels into CustomCat fulfillment:
- eBay orders -> CustomCat
- FLTWHT.com static-site + Stripe orders -> CustomCat

## Planned flow

1. Stripe webhook receives paid checkout events from FLTWHT.com.
2. eBay sync job pulls newly paid/unfulfilled eBay orders.
3. Order normalizer maps both channels into one internal order format.
4. SKU map resolves FLTWHT SKUs to CustomCat product/SKU targets.
5. CustomCat adapter sends orders via API when available.
6. CSV export fallback generates import-ready files when API is unavailable.

## Environment variables

See `.env.example`.

## Status

Initial scaffold only.
