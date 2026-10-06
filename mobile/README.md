# De Car Revolutionist: phone app

The buyer's shop as an iOS and Android app, built with Expo (SDK 57) and Expo Router. It does what the website does, with the same rules and words: choose your car, the damage selector, the four categories with filters, product pages, cart with a fit re-check, checkout (pickup, Abuja delivery, interstate waybill; Paystack or pay later; WhatsApp handoff) and the order page. Google sign-in is optional and never needed to buy.

The owner's `/admin` stays on the website.

## Run it

```bash
pnpm install
cp .env.example .env      # point EXPO_PUBLIC_API_URL at an API your phone can reach
pnpm start                # scan the QR code with Expo Go, or press i / a for a simulator
```

Everything works in Expo Go. Google sign-in there goes through the website in an in-app browser, which needs the website at an https address Google returns to, such as the live site (see [Google sign-in](#google-sign-in)). Native sign-in needs a development or store build (`npx expo run:ios`, `npx expo run:android`, or `npx eas-cli@latest build --profile development`).

Placing an order writes to whichever database the API uses. Test against a local API, not the live one.

## Checks

```bash
pnpm typecheck            # tsc --noEmit (typed routes come from .expo/types, written by `pnpm start`)
pnpm lint                 # expo lint
npx expo-doctor           # dependency and config check
```

## How it fits with the rest

- **No server in between.** The website's browser never calls the API; the Next.js server does. The app calls the FastAPI backend directly (`src/lib/api.ts`). It holds no secrets: the API decides every price, reservation and validation, exactly as for the website.
- **Shared rules, not copies.** `src/lib/domain.ts` re-exports the website's pure modules from `../frontend/lib` (types, labels, zones, side grouping, "replaced together", SKU pattern, NGN and time formatting, delivery fees). `metro.config.js` watches that folder and `tsconfig.json` maps the one `@/lib/catalog/types` import inside it. Keep those frontend files free of Next.js, server-only and package imports, or the app stops building.
- **Stock truth.** Part queries are never cached as fresh. Screens re-read them on focus, when the app returns to the foreground and on pull-to-refresh, and every card shows "Stock checked".
- **Cart** (`src/lib/cart.ts`): a persisted store of `{ sku, qty }` only. Prices, status and fit are re-read from the API whenever the cart shows. While the buyer is signed in, the cart is also saved to their account (`src/lib/cart-sync.ts`, same rules as the website), so it is the same cart on the website and the phone. Signing in adds the phone's guest cart to the account's; signing out empties the phone's cart and leaves the account's as it is.
- **Selected car** (`src/lib/vehicle.ts`): persisted on the phone. Listings filter by it; `?vehicle=<id>` on a deep link makes it the buyer's car, as on the website.
- **Orders placed on this phone** are remembered (id and number only) so a guest can get back to the order page from the Account tab.
- **Paystack.** The app opens Paystack in an in-app browser. Paystack sends the buyer back to the website's callback, which confirms the payment; the order screen re-reads the order when the app comes back to the foreground.
- **Design.** `src/theme.ts` holds the same colour tokens as the website and nothing else. Barlow and Barlow Condensed load from `@expo-google-fonts`. Barlow has no ₦, so the phone's system font draws that one glyph.

## Google sign-in

The buttons show whenever the API has Google sign-in on. There are two ways in, and both end with the API's usual 30-day session (kept in the keychain or keystore):

- **Native** (development and store builds with the client IDs below): Google signs the buyer in on the phone and gives the app an ID token. The app sends it to `POST /auth/google/id-token`, and the API checks it was issued to one of the shop's OAuth clients.
- **Browser** (Expo Go; iOS builds without `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; Android builds Google answers with `DEVELOPER_ERROR`): the app opens `<EXPO_PUBLIC_SITE_URL>/auth/app` in an in-app browser, and the buyer signs in on the website. The website's `/auth/callback` sends the app back to `decar://auth` (`exp://…/--/auth` in Expo Go) with a 5-minute one-time code. The app redeems it at `POST /auth/google/app-session` with a PKCE verifier that never went through the browser, so the code is no use to anyone else. The API only hands codes to `decar://` and Expo Go's `exp://`, which in production must be a private network address.

"Sign in with Google" and "Sign up with Google" on the Account tab run the same flow. The API makes the account the first time it sees a Google address and says so (`created` in the response), so the app can say "Account created" or, after "Sign up", that the buyer already had one.

When the buttons are hidden, a development build says why on the Account tab (the API unreachable or with Google off). It also says when sign-in will use the browser. When sign-in fails, it shows the cause under the buyer's message (for example an API that has no `/auth/google/app-session` yet). Store builds show only the buyer's message.

### Browser sign-in in development (Expo Go)

Google only sends the browser back to the Web client's authorized redirect URIs, and those must be https or `localhost`. A phone's `localhost` is the phone, so `http://192.168.x.x:3000` can't work.

The simple way is the live website: set `EXPO_PUBLIC_SITE_URL=https://decar-revolutionist.vercel.app` and `EXPO_PUBLIC_API_URL=https://decar-revolutionist-api.onrender.com`, then `pnpm start --clear`. The app must use the API the website talks to (one `SESSION_SECRET`), or the code won't redeem, so Expo Go then places real orders. The live API accepts Expo Go's `exp://<private IPv4>:<port>/--/auth` (your laptop on Wi-Fi or a hotspot), not tunnel addresses like `exp.direct`.

To sign in against a local API instead, give the local website an https address:

1. Run it through a tunnel, for example `ngrok http --url=<your-name>.ngrok-free.app 3000`. A `cloudflared` quick tunnel works too, but its address changes on every restart.
2. Add `https://<tunnel>/auth/callback` to the Web client's authorized redirect URIs in Google Cloud Console.
3. Set the backend's `FRONTEND_URL` and the app's `EXPO_PUBLIC_SITE_URL` to that address, and `EXPO_PUBLIC_API_URL` to the local API, then restart both. `FRONTEND_URL` must match `EXPO_PUBLIC_SITE_URL`: the website keeps the sign-in's `state` in a cookie on the address the app opened, and Google returns to `FRONTEND_URL`.

Store builds need none of this: they open the live website.

### Native sign-in

1. In Google Cloud Console, add two OAuth clients next to the website's Web client:
   - **iOS**, bundle ID `com.decarrevolutionist.shop`.
   - **Android**, package `com.decarrevolutionist.shop`, with the SHA-1 of the signing certificate (`npx eas-cli@latest credentials` shows it; with Play App Signing, add Google's SHA-1 too).
2. In `mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (the website's Web client) and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Add the iOS one to `build.base.env` in `eas.json` too: cloud builds never see `.env`.
3. In the backend's environment: `GOOGLE_MOBILE_CLIENT_IDS=<ios client id>`. The Android client ID goes nowhere: Google finds that client by package name and SHA-1, and issues the app's ID token for the website's Web client, which the backend already accepts as `GOOGLE_CLIENT_ID`.
4. Rebuild the app (the iOS URL scheme is set at build time by `app.config.ts`).

## Builds (EAS)

`eas.json` holds the build profiles. Run EAS commands from `mobile/`.

- `development`: a development build (`expo-dev-client`), installed straight onto your phone. Its JavaScript comes from `pnpm start` on your computer, so it reads `mobile/.env` like Expo Go does.
- `development-simulator`: the same build for the iOS Simulator. No Apple Developer account needed.
- `preview`: a standalone build, an installable `.apk` on Android, for trying the app without a computer.
- `production`: store builds. The build number counts up on EAS.

EAS uploads the whole git repository (minus `.gitignore`d files, uncommitted changes included), so `../frontend/lib` goes with it, and `mobile/.env` doesn't. Cloud builds take the public `EXPO_PUBLIC_*` values from `build.base.env` in `eas.json`. Keep them in step with `.env`; EAS refuses empty values, so leave a key out until it has one.

```bash
eas build --profile development --platform android          # then install it from the link EAS prints
eas build --profile development-simulator --platform ios
eas credentials --platform android                           # SHA-1 for the Android OAuth client
```

On Android, Google sign-in fails with `DEVELOPER_ERROR` until the Android OAuth client has the SHA-1 of the keystore EAS signs with. EAS makes that keystore on the first Android build, so build first, then add the client.

## Before the first store release

- `com.decarrevolutionist.shop` is a placeholder bundle ID and package name. Both are permanent once uploaded to the App Store or Play Store, so change them in `app.config.ts` first if the shop wants another.
- Builds and submission go through EAS: `npx eas-cli@latest build --platform all`, then `npx eas-cli@latest submit`.
- `decar://part/<SKU>` links open the app. For `https://…/part/<SKU>` links from WhatsApp to open it as well, the website needs to serve `apple-app-site-association` and `assetlinks.json`; that isn't set up yet.
