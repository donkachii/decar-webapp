"""Order emails over Gmail SMTP with an app password: works without a domain
(about 500 messages a day). To move to Resend or another provider once there
is a domain, replace send_mail(); nothing else changes.

Emails run as FastAPI background tasks after the response is sent, so they
never block or fail an order.
"""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from urllib.parse import quote

from app.config import SITE_ADDRESS, SITE_NAME, SITE_PHONES, Settings
from app.domain.delivery import DELIVERY_LABELS
from app.domain.labels import format_ngn
from app.schemas import OrderOut

log = logging.getLogger(__name__)

# Design tokens (CLAUDE.md section 8). Tan only on the one action button.
BAY, PAPER, NAVY, TAN = "#ECEEF0", "#FFFFFF", "#051632", "#D6AE73"


@dataclass(frozen=True)
class Mail:
    to: str
    subject: str
    html: str
    text: str
    reply_to: str | None = None


def send_mail(settings: Settings, mail: Mail) -> bool:
    """Sends one email. Returns False (and logs) when email is not configured."""
    if not settings.gmail_user or not settings.gmail_app_password:
        log.warning("[email] GMAIL_USER / GMAIL_APP_PASSWORD not set. Skipped: %s", mail.subject)
        return False
    msg = EmailMessage()
    msg["From"] = formataddr((SITE_NAME, settings.gmail_user))
    msg["To"] = mail.to
    msg["Subject"] = mail.subject
    if mail.reply_to:
        msg["Reply-To"] = mail.reply_to
    msg.set_content(mail.text)
    msg.add_alternative(mail.html, subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as smtp:
        smtp.login(settings.gmail_user, settings.gmail_app_password.replace(" ", ""))
        smtp.send_message(msg)
    return True


def _whatsapp_link(settings: Settings, message: str) -> str:
    return f"https://wa.me/{settings.whatsapp_digits}?text={quote(message)}"


def _delivery_text(order: OrderOut) -> str:
    label = DELIVERY_LABELS[order.delivery_option]
    if order.delivery_option == "abuja" and order.delivery_address:
        return f"{label}: {order.delivery_address}"
    if order.delivery_option == "waybill":
        return f"{label}: {', '.join(x for x in (order.delivery_park, order.delivery_state) if x)}"
    return label


def _payment_text(order: OrderOut) -> str:
    if order.payment_method == "paystack":
        return "Paid with Paystack" if order.payment_status == "paid" else "Paystack, awaiting payment"
    if order.delivery_option == "pickup":
        return "Pay at the shop when you collect"
    return "Pay on delivery or by transfer"


def _qty(qty: int) -> str:
    return f" x{qty}" if qty > 1 else ""


def _items_table(order: OrderOut) -> str:
    rows = "".join(
        f"""<tr>
  <td style="padding:10px 0;border-bottom:1px solid {BAY};">
    <div style="font-weight:600;">{escape(i.name)}{_qty(i.qty)}</div>
    <div style="font-size:13px;">{escape(i.sku)}</div>
  </td>
  <td style="padding:10px 0;border-bottom:1px solid {BAY};text-align:right;font-weight:600;white-space:nowrap;">{format_ngn(i.price_ngn * i.qty)}</td>
</tr>"""
        for i in order.items
    )

    def total(label: str, value: int, strong: bool = False) -> str:
        style = "font-weight:700;font-size:18px;" if strong else ""
        return f"""<tr>
  <td style="padding:6px 0;{style}">{label}</td>
  <td style="padding:6px 0;text-align:right;{style}">{format_ngn(value)}</td>
</tr>"""

    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
{rows}
{total("Subtotal", order.subtotal_ngn)}
{total("Delivery", order.delivery_fee_ngn)}
{total("Total", order.total_ngn, strong=True)}
</table>"""


def _layout(title: str, body: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:{BAY};font-family:Arial,Helvetica,sans-serif;color:{NAVY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BAY};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:{PAPER};border-radius:8px;">
<tr><td style="padding:24px 24px 8px;">
  <div style="font-size:14px;font-weight:700;">{escape(SITE_NAME)}</div>
  <h1 style="margin:12px 0 0;font-size:24px;line-height:1.2;">{escape(title)}</h1>
</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.5;">{body}</td></tr>
</table>
<p style="font-size:12px;color:{NAVY};margin:16px 0 0;">{escape(SITE_ADDRESS)}<br>Call or chat: {escape(", ".join(SITE_PHONES))}</p>
</td></tr></table></body></html>"""


def _items_text(order: OrderOut) -> str:
    lines = [f"{i.sku}  {i.name}{_qty(i.qty)}  {format_ngn(i.price_ngn * i.qty)}" for i in order.items]
    return "\n".join(
        [
            *lines,
            "",
            f"Subtotal  {format_ngn(order.subtotal_ngn)}",
            f"Delivery  {format_ngn(order.delivery_fee_ngn)}",
            f"Total     {format_ngn(order.total_ngn)}",
        ]
    )


def _order_message(order: OrderOut, vehicle_label: str | None) -> str:
    """Same prefilled WhatsApp message as the order page. SKUs first so the shop can search them."""
    out = [
        f"Hello {SITE_NAME}, I placed order {order.number}.",
        "",
        *(f"{i.sku}  {i.name}{_qty(i.qty)}  {format_ngn(i.price_ngn * i.qty)}" for i in order.items),
    ]
    if vehicle_label:
        out += ["", f"My car: {vehicle_label}"]
    out += [f"Delivery: {_delivery_text(order)}", "", "Please confirm the parts are still available."]
    return "\n".join(out)


def buyer_email(settings: Settings, order: OrderOut, vehicle_label: str | None) -> tuple[str, str, str]:
    order_url = f"{settings.frontend_origin}/order/{order.id}"
    wa = _whatsapp_link(settings, _order_message(order, vehicle_label))
    first_name = order.customer_name.split(" ")[0]
    when = "you collect" if order.delivery_option == "pickup" else "we send them"
    subject = f"Order {order.number} received"
    html = _layout(
        f"We've got your order, {first_name}",
        f"""<p style="margin:0 0 16px;">Order <strong>{order.number}</strong>. We'll call or WhatsApp you on {escape(order.customer_phone)} to confirm the parts before {when}.</p>
{_items_table(order)}
<p style="margin:16px 0 4px;"><strong>Delivery:</strong> {escape(_delivery_text(order))}</p>
<p style="margin:0 0 20px;"><strong>Payment:</strong> {escape(_payment_text(order))}</p>
<p style="margin:0 0 12px;"><a href="{escape(wa)}" style="display:inline-block;background:{TAN};color:{NAVY};font-weight:700;text-decoration:none;padding:12px 18px;border-radius:6px;">Complete order on WhatsApp</a></p>
<p style="margin:0;"><a href="{escape(order_url)}" style="color:{NAVY};">View your order</a></p>""",
    )
    text = (
        f"Order {order.number} received.\n\n{_items_text(order)}\n\n"
        f"Delivery: {_delivery_text(order)}\nPayment: {_payment_text(order)}\n\n"
        f"View your order: {order_url}\nComplete on WhatsApp: {wa}\n\n"
        f"{SITE_ADDRESS}\nCall or chat: {', '.join(SITE_PHONES)}"
    )
    return subject, html, text


def owner_email(settings: Settings, order: OrderOut, vehicle_label: str | None) -> tuple[str, str, str]:
    admin_url = f"{settings.frontend_origin}/admin?view=orders"
    phone_digits = "".join(c for c in order.customer_phone if c.isdigit())
    if phone_digits.startswith("0"):
        phone_digits = "234" + phone_digits[1:]
    car = escape(vehicle_label) if vehicle_label else "not selected"
    subject = f"New order {order.number}: {format_ngn(order.total_ngn)}"
    email_line = (
        f'<p style="margin:0 0 4px;">{escape(order.customer_email)}</p>' if order.customer_email else ""
    )
    notes_line = (
        f'<p style="margin:0 0 4px;"><strong>Notes:</strong> {escape(order.notes)}</p>' if order.notes else ""
    )
    html = _layout(
        f"New order {order.number}",
        f"""<p style="margin:0 0 4px;"><strong>{escape(order.customer_name)}</strong></p>
<p style="margin:0 0 4px;"><a href="tel:{escape(order.customer_phone)}" style="color:{NAVY};">{escape(order.customer_phone)}</a>
  &nbsp;<a href="https://wa.me/{phone_digits}" style="color:{NAVY};">WhatsApp</a></p>
{email_line}
<p style="margin:0 0 16px;">Car: {car}</p>
{_items_table(order)}
<p style="margin:16px 0 4px;"><strong>Delivery:</strong> {escape(_delivery_text(order))}</p>
<p style="margin:0 0 4px;"><strong>Payment:</strong> {escape(_payment_text(order))}</p>
{notes_line}
<p style="margin:20px 0 0;">Units are reserved until you complete or cancel the order in <a href="{admin_url}" style="color:{NAVY};">admin</a>.</p>""",
    )
    text = (
        f"New order {order.number}\n\n{order.customer_name}\n{order.customer_phone}\n"
        f"{order.customer_email or ''}\nCar: {vehicle_label or 'not selected'}\n\n{_items_text(order)}\n\n"
        f"Delivery: {_delivery_text(order)}\nPayment: {_payment_text(order)}"
        f"{f'{chr(10)}Notes: {order.notes}' if order.notes else ''}\n\n{admin_url}"
    )
    return subject, html, text


def send_order_emails(settings: Settings, order: OrderOut, vehicle_label: str | None) -> None:
    """Confirmation to the buyer (if they gave an email) and an alert to the shop. Never raises."""
    owner_address = settings.owner_email or settings.gmail_user
    mails: list[Mail] = []
    if order.customer_email:
        mails.append(
            Mail(order.customer_email, *buyer_email(settings, order, vehicle_label), reply_to=owner_address)
        )
    if owner_address:
        mails.append(
            Mail(owner_address, *owner_email(settings, order, vehicle_label), reply_to=order.customer_email)
        )
    for mail in mails:
        try:
            send_mail(settings, mail)
        except (smtplib.SMTPException, OSError):
            log.exception("[email] order email failed for %s", order.number)
