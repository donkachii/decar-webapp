import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import localFont from "next/font/local";

import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VehiclePickerSheet } from "@/components/vehicle-picker";
import { getUser } from "@/lib/auth";
import { getVehicles } from "@/lib/catalog";
import { SITE } from "@/lib/config/site";
import { getFeatures } from "@/lib/features";
import { getSelectedVehicle } from "@/lib/vehicle";

import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// Barlow has no naira sign. This 1 KB font holds only ₦ (from Roboto
// Condensed) and its unicode-range keeps it off every other character.
const naira = localFont({
  src: [
    { path: "../assets/fonts/naira-500.woff", weight: "300 600" },
    { path: "../assets/fonts/naira-700.woff", weight: "700 900" },
  ],
  variable: "--font-naira",
  declarations: [{ prop: "unicode-range", value: "U+20A6" }],
  adjustFontFallback: false,
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "De Car Revolutionist: Toyota and Lexus body parts, Zuba Market",
    template: "%s | De Car Revolutionist",
  },
  description:
    "Genuine Belgium and new body parts from Zuba Market, checked for fit before they leave the shop.",
  openGraph: { siteName: SITE.name, locale: "en_NG", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#ECEEF0",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [vehicles, vehicle, user, features] = await Promise.all([
    getVehicles(),
    getSelectedVehicle(),
    getUser(),
    getFeatures(),
  ]);

  return (
    <html lang="en-NG" className={`${barlow.variable} ${barlowCondensed.variable} ${naira.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-paper px-4 py-3 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <SiteHeader vehicle={vehicle} user={user} accountsEnabled={features.googleSignIn} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <VehiclePickerSheet vehicles={vehicles} selectedId={vehicle?.id ?? null} />
        <CartDrawer vehicleId={vehicle?.id ?? null} />
      </body>
    </html>
  );
}
