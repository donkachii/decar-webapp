export const SITE = {
  name: "De Car Revolutionist",
  shopLine: "Shop C12/111, Igbo-Ukwu Line",
  marketLine: "Zuba Spare Parts Market, Abuja",
  address: "Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  // International format, digits only: 2348012345678. Empty opens WhatsApp's
  // contact picker instead of the shop chat.
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, ""),
} as const;

export const VEHICLE_COOKIE = "dcr_vehicle";
