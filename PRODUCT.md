# Product

<!-- impeccable:product-schema 1 -->

`CLAUDE.md` (one folder above this repo) is the source of truth for scope, data, domain rules, the visual system and copy. This file pulls out the product facts design work needs and defers to it wherever they differ.

## Platform

web

## Users

- Car owners, mechanics, panel beaters and dealers, mostly in and around Abuja, with interstate buyers served by waybill.
- No single group leads (confirmed 2026-10-07). Design for the car owner who needs a part explained and the trade buyer who already knows the part and wants to confirm it fast, on the same screens.
- Most arrive on a phone from a Facebook, Instagram, TikTok or WhatsApp link, often a link to one part. The job: find the right body part for their exact car, trust that it is what the photos show, and buy it or ask about it without visiting the market first.
- The shop owner uses `/admin` from a phone to mark units sold and confirm stock.

## Product Purpose

De Car Revolutionist sells foreign-used genuine ("Belgium") and new body parts for Japanese cars from Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja. The website and phone app are where social traffic turns into orders. Success means a buyer gets the right part for their car the first time, with no surprise about its condition, fit, stock or price.

## Positioning

A real market stall that shows the exact unit you will get. Each Belgium unit is a one-off with its own photos, its own grade (A, B or C) and its defects listed in plain words. Fit is matched by model, generation and facelift, never by year alone. Every unit shows when its stock was last checked. A buyer can visit the stall, call or chat on WhatsApp before paying.

The main reason buyers hold back is doubt about whether a part is genuine and what condition it is really in (confirmed 2026-10-07). Fit and stock are hard rules, but condition is where trust is won or lost.

## Operating Context

- Phones first: mid-range Android on slow, metered connections. Performance budgets are in `CLAUDE.md` section 9.
- Links are shared and pasted into WhatsApp, so every part page must preview well there.
- The selected car (generation plus facelift) follows the buyer across pages and filters every listing. Shared links can carry it (`?vehicle=<id>`).
- Checkout: pickup at the Zuba Market shop, Abuja delivery, or interstate waybill (loaded at the park, collected at the destination park). Payment by Paystack when it is switched on, or on pickup or delivery. "Complete order on WhatsApp" sends a prefilled message with the SKUs.
- Contact: 0816 645 6295 (WhatsApp default) and 0901 539 6483, both for calls and chats.
- The owner photographs the stock and sends the photos over WhatsApp; they are sorted into `photos/` and uploaded to Cloudinary.

## Capabilities and Constraints

- v1 scope: Japanese makes (decided 2026-10-23), shown only once a car of that make is listed. Four categories (lights, bumpers, body, mirrors); subcategories are filters, not pages. Vehicles are added only when stock for them is listed.
- Out of scope for v1: dealer or trade accounts, reviews, VIN decoding, multi-currency.
- Accounts are optional and never needed to buy. Google or email and password for buyers; Google only for the owner's `/admin`.
- Prices in naira, shown as `₦185,000`, with no hidden fees at checkout.
- Adding to cart never reserves a unit; placing an order does. A signed-in buyer's cart is the same on the website and the phone.
- The phone app (`mobile/`, Expo, iOS and Android) is the same shop with the same rules, copy and brand look on both systems, not each system's native styling (confirmed 2026-10-07). `/admin` is website only.
- Terminology buyers use and the product keeps: Belgium parts, facelift and pre-facelift, generation codes (XV50, AL20), position (front-left, inner-right), panel beater, waybill. Condition labels are fixed: Belgium · Grade A, B and C, New · Genuine, New · Aftermarket (`CLAUDE.md` section 4).

## Brand Commitments

- Name: De Car Revolutionist. Tagline: "Driving quality. Delivering confidence. Building a legacy."
- Hero: "The right part for your Toyota, Lexus, Honda or Nissan. First time." Sub: "Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave the shop."
- Voice: plain, exact and honest. Buttons say exactly what happens ("Add to cart", "Choose your car", "Mark as sold"). Sentence case. Grade B and C defects are named, never softened.
- Mission, vision and core values are the owner's own words and appear on `/about` only.
- Logo masters: `frontend/assets/brand/mark.svg` and `logo.svg` (white artwork for a wine ground). Every rendered logo file comes from `pnpm brand`.
- The visual system (colour tokens, type, grounds, and the home hero and damage selector as the two bold elements) is pinned in `CLAUDE.md` section 8.

## Evidence on Hand

- Catalog: `backend/seed/parts.json` holds 27 real parts (hoods, fenders, side mirrors, two grills), all new aftermarket and all drafts with no price or stock yet (2026-10-07). `backend/seed/vehicles.json` holds 15 vehicles.
- Photos: `photos/parts/<SKU>/` for those 27 parts and `photos/library/`, the owner's sorted WhatsApp photos of 2026-10-01 (gitignored, on Cloudinary). Library photos are mostly supplier photos of new stock and never valid for a Belgium unit; one carries another seller's watermark and must not be published.
- No Belgium unit is photographed or listed yet. No lights or bumpers are listed, because their photos don't say which car they fit.
- The owner's mission, vision and values text on `/about`.
- Not available, and never to be invented: customer reviews or testimonials, sales or customer counts, real prices, final delivery rates (placeholders in `backend/src/domain/delivery.ts`), social profile URLs.

## Product Principles

1. **Show this unit, not a part like it.** Condition doubt is what stops a sale, so a unit's own photos, grade and plain-word defects come before anything persuasive.
2. **Fit is confirmed or it says so.** Match on model, generation and facelift. Where fit isn't confirmed, say "Not confirmed for your vehicle" rather than imply it.
3. **Stock truth beats everything.** Show when stock was last checked, and never let a sold or reserved unit look buyable.
4. **One screen for the owner and the trade buyer.** Plain explanations for the person who needs them, and the codes a mechanic checks (generation, position, OEM number, SKU) where they can be scanned. Neither hides the other.
5. **A real shop is one tap away.** Guest checkout always works, signing in is never forced, and WhatsApp, the phone numbers and the stall address are always within reach.

## Accessibility & Inclusion

- Works at 360px wide and with a keyboard only, with visible focus states (`CLAUDE.md` section 11).
- Text and background pairs are checked against a 4.5:1 contrast ratio; the allowed pairs are listed in `CLAUDE.md` section 12.
- Built for slow, metered connections on mid-range Android phones (`CLAUDE.md` section 9).
- English in plain words, so a buyer who doesn't know a part's trade name can still follow it.
