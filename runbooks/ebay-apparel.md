# eBay apparel runbook

Scope: research-only runbook for future live execution. No account actions performed here.

## Policy baseline for POD apparel on eBay

Research verdict:
- eBay-compatible POD apparel is possible in principle.
- The major policy boundary is dropshipping style and seller-of-record behavior.
- The safest posture is: use a direct manufacturer/fulfillment relationship, not retail arbitrage.

Important caution:
- I do not have an official current eBay policy page fetched here that explicitly names print-on-demand apparel.
- I do have strong secondary guidance that eBay allows compliant dropshipping from wholesale suppliers/manufacturers and forbids retail-arbitrage style fulfillment.
- Because CustomCat/Apliiq are direct fulfillment/manufacturing partners rather than retail marketplaces, the setup is much closer to the compliant pattern than Amazon-to-eBay arbitrage.

## Required apparel item specifics

Official eBay seller resources say Clothing, Shoes & Accessories listings require item specifics including:
- Brand
- Style
- Size Type
- Size

Seller Center also emphasizes that item specifics are one of the most important ways buyers find listings, and variation listings should use variation details like size and color where appropriate.

For a shirt listing, practical minimum specifics to fill:
- Brand
- Department / Gender target (if category requires it)
- Type / Style
- Size Type
- Size
- Color
- Material / Fabric type
- Fit
- Sleeve Length
- Neckline (if applicable)
- Theme / Graphic Print / Pattern when relevant

## Variation structure for apparel

eBay Seller Center guidance says variation listings should group closely related items and use variation details such as size and color.

Recommended structure for one POD shirt listing:
- Variation axis 1: Size
- Variation axis 2: Color

Do not mix unrelated garments in one listing.
For example, tee and hoodie should not share one listing.

## POD-specific listing hygiene

Based on apparel guidance and POD seller practice:
- use clean mockups and accurate material/fit claims
- use consistent size charts
- include processing and delivery expectations that match fulfillment reality
- avoid overstating handmade/custom claims beyond what the platform permits
- ensure the seller remains the brand-facing seller of record

## Trademark / policy risk

High-risk areas for FLTWHT on eBay:
- any residual real automaker names, badges, or logos in titles/descriptions/images
- reused source art that still visibly resembles protected badging or distinctive marque styling
- category/item-specific mismatches that make the listing look deceptive

Specific repo-level verdict:
- use only the retitled IP-safe names already reflected in the live catalog
- do not list any SKU whose artwork/title still needs IP cleanup review
- `FW-MSS-TE-*` remains a heightened review candidate because the live catalog already flags it as higher IP risk

## Existing harnol_98 parts store vs separate path

Verdict:
- Prefer a separate path/brand context for FLTWHT apparel rather than mixing it into the existing `harnol_98` auto-parts identity.

Why:
- category mismatch: auto parts store history vs apparel brand listings
- trust/branding mismatch for buyers
- easier policy hygiene and merchandising if apparel is separated from parts inventory and shipping assumptions
- earlier local export notes already flagged that parts-business shipping defaults may not fit apparel

If a separate eBay account/storefront is not practical, then at minimum:
- separate the category tree clearly
- separate shipping/business policies for apparel
- keep branding and titles consistent with FLTWHT, not auto parts

## Execution checklist for later live work

1. Choose the exact apparel category.
2. Fill all required item specifics:
   - Brand
   - Style/Type
   - Size Type
   - Size
3. Add recommended specifics:
   - Color
   - Material
   - Fit
   - Sleeve length
   - Theme / pattern / graphic
4. Use variation listing only for closely related size/color combinations.
5. Confirm shipping policy matches POD apparel weights/timelines.
6. Run an IP/trademark title/image pass before publish.
7. Prefer separate FLTWHT apparel path over the existing parts-oriented store identity.

## Sources

- eBay Clothing, Shoes & Accessories lookup: required item specifics include Brand, Style, Size Type, and Size.
- eBay Seller Center item specifics page: item specifics and variation details like size/color are key for discovery and grouped listings.
- Secondary dropshipping policy guidance: compliant eBay dropshipping should rely on wholesale suppliers/manufacturers rather than retail arbitrage.
