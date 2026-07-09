# CustomCat Standard ProductId runbook

Scope: research-only runbook for obtaining the real CustomCat identifier(s) needed for Standard routing.

## What unblocks Standard mode

Every `*-STD` SKU in `data/sku-map.json` needs a real CustomCat identifier.

At minimum, the bridge needs one of these models confirmed per Standard SKU:

1. **Product ID model**
   - one top-level Product ID
   - plus color + size variation info when ordering

2. **Catalog SKU model**
   - exact variant-level `catalog_sku`
   - example from CustomCat docs: `Gildan 5000 - Black - Large -> catalog_sku = 48146`

Current repo map uses `productId` as the required field for Standard SKUs.
If the operator prefers exact variant-level routing, the repo can later switch to `catalogSku` instead.

## CustomCat API/account setup flow

CustomCat help docs say:
1. Create a CustomCat account
2. In the sidebar, click **Connect Store**
3. Select **Create API Order**
4. Enter a Store Name and URL and click **Connect**
5. Go to **Settings > Store > API**
6. Copy the read-only or read-write API keys
7. API docs are at `https://customcat-beta.mylocker.net/api/v1/`

This proves where the API keys live and how the API store is created.

## Where the Standard product identifiers come from

CustomCat docs describe two usable identifier approaches:

### Option A: Product ID
- usable as the top-level product identifier
- if used, the order must also include color and size
- third-party CustomCat integration docs explain that Product ID is shared across variants, so variation fields are needed to resolve the exact item

### Option B: Catalog SKU
- exact variant-level identifier
- CustomCat’s API help page gives an example:
  - Gildan 5000 / Black / Large -> `catalog_sku = 48146`
- for external-design ordering, `/catalog` and `/catalog_sku` are the relevant API paths

## Fastest operator workflow to capture the Standard ID

Recommended live execution path:

1. Sign into CustomCat.
2. Create or identify the Standard black tee product intended for FLTWHT Standard mode.
3. Open the API store setup if not already created:
   - Connect Store -> Create API Order
4. Open Settings -> Store -> API and copy the API keys.
5. Use the API docs / catalog endpoints to identify either:
   - the Product ID for the chosen blank, or
   - the exact `catalog_sku` for each live black tee variant
6. Record the chosen identifier back into `data/sku-map.json`.

## Minimum data to record for one Standard tee SKU

For example `FW-BRR-TE-STD`, capture:
- supplier: `customcat`
- identifier strategy used:
  - `productId`, or
  - `catalogSku`
- if Product ID model:
  - Product ID
  - color value expected by CustomCat
  - size values expected by CustomCat
- if Catalog SKU model:
  - exact variant-level ID(s)

## Repo implication

Current repo assumption:
- `requiredIdField: productId`

If execution proves `catalog_sku` is cleaner, update the repo map model before any live routing.

## Sources

- CustomCat help: “Connect Store -> Create API Order”, then “Settings > Store > API” for read-only/read-write keys.
- CustomCat help: `/catalog` and `/catalog_sku` support external-design ordering and inventory lookup.
- CustomCat help example: Gildan 5000 Black Large -> `catalog_sku = 48146`.
- Order Desk CustomCat integration doc: Product ID can be used, but color/size are required to resolve the exact variant when using top-level Product ID.
