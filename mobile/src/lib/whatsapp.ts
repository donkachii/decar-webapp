import { Linking } from "react-native";

import { SITE, SITE_URL } from "./config";
import { formatNGN, plainText } from "./domain";

// The same messages as the website's lib/whatsapp.ts. SKUs go first on each
// line so the shop can search them.

export function whatsappLink(message: string): string {
  const base = SITE.whatsappNumber ? `https://wa.me/${SITE.whatsappNumber}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(plainText(message))}`;
}

export function openWhatsapp(message: string): void {
  void Linking.openURL(whatsappLink(message));
}

export interface WhatsappLine {
  sku: string;
  title: string;
  priceNGN: number;
  qty: number;
}

export function orderMessage(input: {
  lines: WhatsappLine[];
  vehicleLabel?: string | null;
  orderNumber?: string;
  deliveryLabel?: string;
}): string {
  const out: string[] = [
    input.orderNumber
      ? `Hello ${SITE.name}, I placed order ${input.orderNumber}.`
      : `Hello ${SITE.name}, I'd like to order:`,
    "",
    ...input.lines.map(
      (l) => `${l.sku}  ${l.title}${l.qty > 1 ? ` x${l.qty}` : ""}  ${formatNGN(l.priceNGN * l.qty)}`,
    ),
  ];
  if (input.vehicleLabel) out.push("", `My car: ${input.vehicleLabel}`);
  if (input.deliveryLabel) out.push(`Delivery: ${input.deliveryLabel}`);
  out.push("", "Please confirm the parts are still available.");
  return out.join("\n");
}

/** The website's product page, which previews with photo and price when pasted into WhatsApp. */
export function partUrl(sku: string): string {
  return `${SITE_URL}/part/${sku}`;
}

export function partEnquiryMessage(input: { sku: string; title: string }): string {
  return `Hello ${SITE.name}, is this part still available?\n\n${input.sku}  ${input.title}\n${partUrl(input.sku)}`;
}
