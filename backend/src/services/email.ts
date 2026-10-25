// Order emails over Gmail SMTP with an app password: works without a domain
// (about 500 messages a day). To move to Resend or another provider once there
// is a domain, replace sendMail(); nothing else changes.
//
// Emails go out after the response is sent, so they never block or fail an order.

import nodemailer, { type Transporter } from "nodemailer";

import { SITE_ADDRESS, SITE_NAME, SITE_PHONES, type Settings } from "../config.js";
import { DELIVERY_LABELS } from "../domain/delivery.js";
import { formatNgn } from "../domain/labels.js";
import type { OrderOut } from "../schemas.js";

// Design tokens (CLAUDE.md section 8). Tan only on the one action button.
const BAY = "#ECEEF0";
const PAPER = "#FFFFFF";
const NAVY = "#051632";
const TAN = "#D6AE73";

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

let transport: Transporter | undefined;

/** Sends one email. Returns false (and logs) when email is not configured. */
export async function sendMail(settings: Settings, mail: Mail): Promise<boolean> {
  if (!settings.gmailUser || !settings.gmailAppPassword) {
    console.warn(`[email] GMAIL_USER / GMAIL_APP_PASSWORD not set. Skipped: ${mail.subject}`);
    return false;
  }
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: settings.gmailUser, pass: settings.gmailAppPassword.replaceAll(" ", "") },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    from: { name: SITE_NAME, address: settings.gmailUser },
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
  });
  return true;
}

/** HTML-escapes text, quotes included. */
function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/** Percent-encodes for a URL query, leaving / alone. */
function quote(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replaceAll("%2F", "/");
}

function whatsappLink(settings: Settings, message: string): string {
  return `https://wa.me/${settings.whatsappDigits}?text=${quote(message)}`;
}

function deliveryText(order: OrderOut): string {
  const label = DELIVERY_LABELS[order.deliveryOption];
  if (order.deliveryOption === "abuja" && order.deliveryAddress) return `${label}: ${order.deliveryAddress}`;
  if (order.deliveryOption === "waybill") {
    return `${label}: ${[order.deliveryPark, order.deliveryState].filter(Boolean).join(", ")}`;
  }
  return label;
}

function paymentText(order: OrderOut): string {
  if (order.paymentMethod === "paystack") {
    return order.paymentStatus === "paid" ? "Paid with Paystack" : "Paystack, awaiting payment";
  }
  if (order.deliveryOption === "pickup") return "Pay at the shop when you collect";
  return "Pay on delivery or by transfer";
}

function qtyText(qty: number): string {
  return qty > 1 ? ` x${qty}` : "";
}

function itemsTable(order: OrderOut): string {
  const rows = order.items
    .map(
      (i) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${BAY};">
    <div style="font-weight:600;">${escape(i.name)}${qtyText(i.qty)}</div>
    <div style="font-size:13px;">${escape(i.sku)}</div>
  </td>
  <td style="padding:10px 0;border-bottom:1px solid ${BAY};text-align:right;font-weight:600;white-space:nowrap;">${formatNgn(i.priceNGN * i.qty)}</td>
</tr>`,
    )
    .join("");

  const total = (label: string, value: number, strong = false): string => {
    const style = strong ? "font-weight:700;font-size:18px;" : "";
    return `<tr>
  <td style="padding:6px 0;${style}">${label}</td>
  <td style="padding:6px 0;text-align:right;${style}">${formatNgn(value)}</td>
</tr>`;
  };

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
${rows}
${total("Subtotal", order.subtotalNGN)}
${total("Delivery", order.deliveryFeeNGN)}
${total("Total", order.totalNGN, true)}
</table>`;
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:${BAY};font-family:Arial,Helvetica,sans-serif;color:${NAVY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BAY};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${PAPER};border-radius:8px;">
<tr><td style="padding:24px 24px 8px;">
  <div style="font-size:14px;font-weight:700;">${escape(SITE_NAME)}</div>
  <h1 style="margin:12px 0 0;font-size:24px;line-height:1.2;">${escape(title)}</h1>
</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.5;">${body}</td></tr>
</table>
<p style="font-size:12px;color:${NAVY};margin:16px 0 0;">${escape(SITE_ADDRESS)}<br>Call or chat: ${escape(SITE_PHONES.join(", "))}</p>
</td></tr></table></body></html>`;
}

function itemLine(i: OrderOut["items"][number]): string {
  return `${i.sku}  ${i.name}${qtyText(i.qty)}  ${formatNgn(i.priceNGN * i.qty)}`;
}

function itemsText(order: OrderOut): string {
  return [
    ...order.items.map(itemLine),
    "",
    `Subtotal  ${formatNgn(order.subtotalNGN)}`,
    `Delivery  ${formatNgn(order.deliveryFeeNGN)}`,
    `Total     ${formatNgn(order.totalNGN)}`,
  ].join("\n");
}

/** Same prefilled WhatsApp message as the order page. SKUs first so the shop can search them. */
function orderMessage(order: OrderOut, vehicleLabel: string | null): string {
  const out = [`Hello ${SITE_NAME}, I placed order ${order.number}.`, "", ...order.items.map(itemLine)];
  if (vehicleLabel) out.push("", `My car: ${vehicleLabel}`);
  out.push(`Delivery: ${deliveryText(order)}`, "", "Please confirm the parts are still available.");
  return out.join("\n");
}

export function buyerEmail(settings: Settings, order: OrderOut, vehicleLabel: string | null): Rendered {
  const orderUrl = `${settings.frontendOrigin}/order/${order.id}`;
  const wa = whatsappLink(settings, orderMessage(order, vehicleLabel));
  const firstName = order.customerName.split(" ")[0] ?? "";
  const when = order.deliveryOption === "pickup" ? "you collect" : "we send them";
  const html = layout(
    `We've got your order, ${firstName}`,
    `<p style="margin:0 0 16px;">Order <strong>${order.number}</strong>. We'll call or WhatsApp you on ${escape(order.customerPhone)} to confirm the parts before ${when}.</p>
${itemsTable(order)}
<p style="margin:16px 0 4px;"><strong>Delivery:</strong> ${escape(deliveryText(order))}</p>
<p style="margin:0 0 20px;"><strong>Payment:</strong> ${escape(paymentText(order))}</p>
<p style="margin:0 0 12px;"><a href="${escape(wa)}" style="display:inline-block;background:${TAN};color:${NAVY};font-weight:700;text-decoration:none;padding:12px 18px;border-radius:6px;">Complete order on WhatsApp</a></p>
<p style="margin:0;"><a href="${escape(orderUrl)}" style="color:${NAVY};">View your order</a></p>`,
  );
  const text =
    `Order ${order.number} received.\n\n${itemsText(order)}\n\n` +
    `Delivery: ${deliveryText(order)}\nPayment: ${paymentText(order)}\n\n` +
    `View your order: ${orderUrl}\nComplete on WhatsApp: ${wa}\n\n` +
    `${SITE_ADDRESS}\nCall or chat: ${SITE_PHONES.join(", ")}`;
  return { subject: `Order ${order.number} received`, html, text };
}

export function ownerEmail(settings: Settings, order: OrderOut, vehicleLabel: string | null): Rendered {
  const adminUrl = `${settings.frontendOrigin}/admin?view=orders`;
  let phoneDigits = order.customerPhone.replace(/\D/g, "");
  if (phoneDigits.startsWith("0")) phoneDigits = `234${phoneDigits.slice(1)}`;
  const car = vehicleLabel ? escape(vehicleLabel) : "not selected";
  const emailLine = order.customerEmail
    ? `<p style="margin:0 0 4px;">${escape(order.customerEmail)}</p>`
    : "";
  const notesLine = order.notes
    ? `<p style="margin:0 0 4px;"><strong>Notes:</strong> ${escape(order.notes)}</p>`
    : "";
  const html = layout(
    `New order ${order.number}`,
    `<p style="margin:0 0 4px;"><strong>${escape(order.customerName)}</strong></p>
<p style="margin:0 0 4px;"><a href="tel:${escape(order.customerPhone)}" style="color:${NAVY};">${escape(order.customerPhone)}</a>
  &nbsp;<a href="https://wa.me/${phoneDigits}" style="color:${NAVY};">WhatsApp</a></p>
${emailLine}
<p style="margin:0 0 16px;">Car: ${car}</p>
${itemsTable(order)}
<p style="margin:16px 0 4px;"><strong>Delivery:</strong> ${escape(deliveryText(order))}</p>
<p style="margin:0 0 4px;"><strong>Payment:</strong> ${escape(paymentText(order))}</p>
${notesLine}
<p style="margin:20px 0 0;">Units are reserved until you complete or cancel the order in <a href="${adminUrl}" style="color:${NAVY};">admin</a>.</p>`,
  );
  const text =
    `New order ${order.number}\n\n${order.customerName}\n${order.customerPhone}\n` +
    `${order.customerEmail ?? ""}\nCar: ${vehicleLabel ?? "not selected"}\n\n${itemsText(order)}\n\n` +
    `Delivery: ${deliveryText(order)}\nPayment: ${paymentText(order)}` +
    `${order.notes ? `\nNotes: ${order.notes}` : ""}\n\n${adminUrl}`;
  return { subject: `New order ${order.number}: ${formatNgn(order.totalNGN)}`, html, text };
}

/** Confirmation to the buyer (if they gave an email) and an alert to the shop. Never throws. */
export async function sendOrderEmails(settings: Settings, order: OrderOut, vehicleLabel: string | null) {
  const ownerAddress = settings.ownerEmail || settings.gmailUser;
  const mails: Mail[] = [];
  if (order.customerEmail) {
    mails.push({ to: order.customerEmail, ...buyerEmail(settings, order, vehicleLabel), replyTo: ownerAddress });
  }
  if (ownerAddress) {
    mails.push({ to: ownerAddress, ...ownerEmail(settings, order, vehicleLabel), replyTo: order.customerEmail });
  }
  for (const mail of mails) {
    try {
      await sendMail(settings, mail);
    } catch (error) {
      console.error(`[email] order email failed for ${order.number}:`, error);
    }
  }
}
