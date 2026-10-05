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
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  // International format, digits only: 2348012345678. NEXT_PUBLIC_WHATSAPP_NUMBER
  // overrides the shop's first number.
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "2348166456295").replace(/\D/g, ""),
} as const;

export const VEHICLE_COOKIE = "dcr_vehicle";
