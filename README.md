# FLTWHT Fulfillment Bridge

Middleware to route FLTWHT orders from eBay and the static site into CustomCat fulfillment.

## Goal

Bridge unsupported sales channels into CustomCat fulfillment:
- eBay orders -> CustomCat
- FLTWHT.com static-site + Stripe orders -> CustomCat

## Current status

This repo now has a usable internal order model and a CSV fallback path.
That means you can normalize orders from unsupported channels even before the full CustomCat API path is wired.

## Planned flow

1. Stripe webhook receives paid checkout events from FLTWHT.com.
2. eBay sync job pulls newly paid/unfulfilled eBay orders.
3. Order normalizer maps both channels into one internal order format.
4. SKU map resolves FLTWHT SKUs to CustomCat product/SKU targets.
5. CustomCat adapter sends orders via API when available.
6. CSV export fallback generates import-ready files when API is unavailable.

## Handoff index

Operational runbooks:
- `runbooks/etsy-apliiq-connect.md`
- `runbooks/customcat-standard-productid.md`
- `runbooks/ebay-apparel.md`

Channel-ready listing specs:
- `repo/listings/ebay-border-run.md`
- `repo/listings/etsy-border-run.md`

## Endpoints

- `GET /health`
- `POST /webhooks/stripe`
- `POST /jobs/ebay-sync`
- `POST /admin/export-customcat-csv`

## Environment variables

See `.env.example`.

## CSV fallback

`POST /admin/export-customcat-csv` accepts JSON like:

```json
{
  "orders": [
    {
      "source": "ebay",
      "orderId": "12345",
      "customer": { "email": "buyer@example.com", "name": "Buyer Name" },
      "shippingAddress": {
        "line1": "123 Main St",
        "city": "Los Angeles",
        "state": "CA",
        "postalCode": "90001",
        "country": "US"
      },
      "items": [
        { "sku": "FLT-E30-STD-TEE-BLK-M", "title": "E30 Tee", "quantity": 1 }
      ]
    }
  ]
}
```

The route returns CSV with CustomCat mapping columns, including empty mapped SKU cells where catalog mapping still needs to be filled.
