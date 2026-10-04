import { plainText } from "@/lib/catalog/labels";
import { SITE } from "@/lib/config/site";
import { formatNGN } from "@/lib/format";

export function whatsappLink(message: string): string {
  const base = SITE.whatsappNumber ? `https://wa.me/${SITE.whatsappNumber}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(plainText(message))}`;
}

export interface WhatsappLine {
  sku: string;
  title: string;
  priceNGN: number;
  qty: number;
}

/** Prefilled order message. SKUs go first on each line so the shop can search them. */
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

export function partEnquiryMessage(input: { sku: string; title: string; url: string }): string {
  return `Hello ${SITE.name}, is this part still available?\n\n${input.sku}  ${input.title}\n${input.url}`;
}
