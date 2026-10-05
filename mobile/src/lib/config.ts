// Build-time settings (EXPO_PUBLIC_* in mobile/.env). They are compiled into
// the app, so nothing secret goes here: the API holds every key.

const url = (value: string | undefined, fallback: string) => (value || fallback).replace(/\/$/, "");

/** The FastAPI backend. The app calls it directly; every price and stock check happens there. */
export const API_URL = url(process.env.EXPO_PUBLIC_API_URL, "http://localhost:8000");

/** The website. Shared links point here so they preview in WhatsApp; drawings load from it. */
export const SITE_URL = url(process.env.EXPO_PUBLIC_SITE_URL, "http://localhost:3000");

export const SITE = {
  name: "De Car Revolutionist",
  shopLine: "Shop C12/111, Igbo-Ukwu Line",
  marketLine: "Zuba Spare Parts Market, Abuja",
  address: "Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja",
  tagline: "Driving quality. Delivering confidence. Building a legacy.",
  // Both numbers take calls and WhatsApp chats.
  phones: [
    { label: "0816 645 6295", tel: "+2348166456295" },
    { label: "0901 539 6483", tel: "+2349015396483" },
  ],
  // The shop's name on Facebook, Instagram and TikTok.
  socialName: "De Car Revolutionist",
  // International format, digits only: 2348012345678. EXPO_PUBLIC_WHATSAPP_NUMBER
  // overrides the shop's first number.
  whatsappNumber: (process.env.EXPO_PUBLIC_WHATSAPP_NUMBER || "2348166456295").replace(/\D/g, ""),
} as const;

/** OAuth client IDs for Google sign-in on the phone. Public by design. */
export const GOOGLE_CLIENT_IDS = {
  // The website's Web client: Google issues the app's ID token for it (Android).
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
} as const;
