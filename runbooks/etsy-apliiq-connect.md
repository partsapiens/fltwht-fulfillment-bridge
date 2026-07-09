# Apliiq -> Etsy connection runbook

Scope: research-only operational runbook for Claude or operator to execute later. No live account actions performed here.

## What the Apliiq Etsy connector does

Apliiq publicly states its Etsy connector can:
- connect an Etsy shop to an Apliiq account
- publish products/listings to Etsy
- process Etsy orders automatically or manually through Apliiq
- ship white-label and send tracking back to Etsy

Source basis:
- Apliiq Etsy page says: “Connect your store so products and order details can move cleanly.”
- It also says the connector can “publish products,” “automatically or manually process Etsy orders,” and “send tracking information back to Etsy.”

## Pre-checks

1. Confirm the Etsy shop is already owned and accessible.
2. Confirm the Apliiq account is signed in.
3. Confirm the target product exists in Apliiq.
4. For the first live Signature item, use:
   - `FW-BRR-TE-SIG`
   - reference: `BORDER RUN '89 | Gildan 5000 | DTF`

## Connection flow

1. In Apliiq, open the Etsy integration entry point.
   - Public sources reference an “Etsy getting started guide” and say the Etsy app is free.
2. Authorize Etsy from the Apliiq side.
3. Confirm the shop is visible/connected in Apliiq.
4. Select the saved Apliiq product to publish.
5. Push the product to Etsy as a new listing or connect it to an existing Etsy listing if the connector supports that mode.
6. Confirm post-publish behavior:
   - order appears in Etsy
   - Apliiq receives the order
   - Apliiq can send tracking back to Etsy

## BORDER RUN size variation setup on Etsy

Goal listing structure:
- One Etsy listing
- Variation 1: Size
- Options: `S`, `M`, `L`, `XL`, `2XL`, `3XL`, `4XL`, `5XL`

Research notes:
- Etsy variation guides consistently describe using standard Etsy variation types like Size and Color.
- Third-party Etsy variation guides indicate Etsy supports up to 2 variation properties per listing and standard Size variations are appropriate for apparel.
- I do not have an official Etsy help-page citation loaded here for the exact numeric cap, so treat the “2 variation types” detail as practical guidance, not platform-proof.

For BORDER RUN, recommended listing configuration:
- Variation type: `Size`
- Values: `S`, `M`, `L`, `XL`, `2XL`, `3XL`, `4XL`, `5XL`
- If black is the only live color, do not add a second variation type yet.
- If Etsy or Apliiq requires size-level inventory/SKU linkage, map each size to the corresponding Apliiq/Etsy variant record during publish.

## Operator verify after publish

Verify all of these before calling it complete:
- Etsy listing exists and is visible in Shop Manager
- listing has Size variation with S through 5XL
- Apliiq shows the Etsy-linked product/listing
- order-processing mode is explicitly chosen:
  - automatic, or
  - manual review
- tracking handoff back to Etsy is enabled or documented in the connector settings

## Unknowns to confirm during execution

These are not guessed here and must be confirmed live during execution:
- whether the connector publishes all sizes from the Apliiq product automatically
- whether Etsy-side SKU fields are editable before or after publish in Apliiq
- whether Apliiq uses one product with variant matrix vs. one record per size internally

## Sources

- Apliiq Etsy integration landing page: states the app is free, supports publishing products, automatic/manual order processing, white-label fulfillment, and tracking back to Etsy.
- Apliiq help guide link exposed on the Etsy landing page: `https://help.apliiq.com/portal/en/kb/articles/apliiq-x-etsy-getting-started-guide` (not fetched here, so use live during execution if needed).
