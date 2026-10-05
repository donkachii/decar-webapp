"use client";

import { cn } from "cn";
import { CircleAlert, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useState, useTransition, type ReactNode } from "react";

import { placeOrder, type CheckoutField, type CheckoutState } from "@/app/checkout/actions";
import { cartWhatsappLink, summariseCart } from "@/components/cart-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartDetails } from "@/lib/cart";
import { formatNGN } from "@/lib/format";
import { DELIVERY_OPTIONS, DELIVERY_ORDER, deliveryFee, type DeliveryRates } from "@/lib/orders/delivery";
import type { DeliveryOption, PaymentMethod } from "@/lib/orders/types";

const initialState: CheckoutState = { status: "idle" };

export function CheckoutForm({
  vehicleId,
  paystack,
  showSignIn,
  rates,
  defaults,
}: {
  vehicleId: string | null;
  paystack: boolean;
  showSignIn: boolean;
  rates: DeliveryRates;
  defaults: { name: string; email: string; phone: string };
}) {
  const { lines, parts, vehicle, loading, empty, reload } = useCartDetails(vehicleId);
  const [state, formAction] = useActionState(placeOrder, initialState);
  const [pending, startTransition] = useTransition();
  const [delivery, setDelivery] = useState<DeliveryOption>("pickup");
  const [payment, setPayment] = useState<PaymentMethod>(paystack ? "paystack" : "pay-later");

  const summary = summariseCart(lines, parts);
  const classes = summary.ready.map((r) => r.part.shippingClass);
  const fee = deliveryFee(delivery, classes, rates);
  const total = summary.subtotal + fee;
  const [edited, setEdited] = useState<string[]>([]);
  const errors = Object.fromEntries(
    Object.entries(state.fieldErrors ?? {}).filter(([field]) => !edited.includes(field)),
  ) as CheckoutState["fieldErrors"] & object;

  // Parts that sold mid-checkout: re-read the cart so the lines show it.
  useEffect(() => {
    if (state.unavailable?.length) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (empty) {
    return (
      <div className="mt-6 rounded-md bg-paper px-5 py-10">
        <p className="text-[17px]">Your cart is empty.</p>
        <Button asChild className="mt-4">
          <Link href="/">Find parts for my car</Link>
        </Button>
      </div>
    );
  }

  const payLaterLabel =
    delivery === "pickup"
      ? "Pay at the shop when you collect"
      : delivery === "abuja"
        ? "Pay on delivery"
        : "Pay by bank transfer before we load it";
  const payLaterDetail =
    delivery === "waybill"
      ? "We'll confirm the total and send account details on WhatsApp."
      : "Cash or transfer. We'll call to confirm first.";

  return (
    <form
      noValidate
      onInput={(event) => {
        const field = (event.target as HTMLInputElement).name;
        if (field && !edited.includes(field)) setEdited([...edited, field]);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        setEdited([]);
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start"
    >
      <input type="hidden" name="lines" value={JSON.stringify(summary.ready.map((r) => r.line))} />

      <div className="flex flex-col gap-8">
        {state.status === "error" && state.message ? (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-paper px-4 py-3 font-semibold text-warn">
            <CircleAlert aria-hidden className="mt-0.5 size-[18px] shrink-0" />
            {state.message}
          </p>
        ) : null}

        <Fieldset legend="Your details">
          {showSignIn ? (
            <p className="text-sm">
              Bought from us before?{" "}
              <Link href="/signin?next=/checkout" className="font-semibold underline underline-offset-2">
                Sign in with Google
              </Link>{" "}
              to fill this in. Optional.
            </p>
          ) : null}
          <Field id="name" label="Full name" error={errors.name}>
            <Input id="name" name="name" aria-describedby="name-hint name-error" autoComplete="name" defaultValue={defaults.name} aria-invalid={!!errors.name} required />
          </Field>
          <Field id="phone" label="Phone number" hint="We call or WhatsApp this number to confirm." error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              aria-describedby="phone-hint phone-error"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={defaults.phone}
              aria-invalid={!!errors.phone}
              required
            />
          </Field>
          <Field
            id="email"
            label={payment === "paystack" ? "Email" : "Email (optional)"}
            hint="For your order confirmation."
            error={errors.email}
          >
            <Input id="email" name="email" aria-describedby="email-hint email-error" type="email" autoComplete="email" defaultValue={defaults.email} aria-invalid={!!errors.email} />
          </Field>
        </Fieldset>

        <Fieldset legend="Delivery" error={errors.delivery}>
          <div className="grid gap-2">
            {DELIVERY_ORDER.map((option) => (
              <ChoiceCard
                key={option}
                name="delivery"
                value={option}
                checked={delivery === option}
                onChange={() => {
                  setDelivery(option);
                  setEdited((e) => [...e, "delivery"]);
                }}
                title={DELIVERY_OPTIONS[option].label}
                detail={DELIVERY_OPTIONS[option].detail}
                aside={classes.length ? formatNGN(deliveryFee(option, classes, rates)) : "…"}
              />
            ))}
          </div>
          {delivery === "abuja" ? (
            <Field id="address" label="Delivery address in Abuja" hint="Street, area, and a landmark. Or your mechanic's workshop." error={errors.address}>
              <Textarea id="address" name="address" aria-describedby="address-hint address-error" autoComplete="street-address" aria-invalid={!!errors.address} />
            </Field>
          ) : null}
          {delivery === "waybill" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="state" label="Destination state" error={errors.state}>
                <Input id="state" name="state" aria-describedby="state-hint state-error" autoComplete="address-level1" aria-invalid={!!errors.state} />
              </Field>
              <Field id="park" label="Park to collect from" hint="For example, Jibowu Park, Lagos." error={errors.park}>
                <Input id="park" name="park" aria-describedby="park-hint park-error" aria-invalid={!!errors.park} />
              </Field>
            </div>
          ) : null}
        </Fieldset>

        <Fieldset legend="Payment" error={errors.payment}>
          <div className="grid gap-2">
            <ChoiceCard
              name="payment"
              value="paystack"
              checked={payment === "paystack"}
              onChange={() => setPayment("paystack")}
              disabled={!paystack}
              title="Card or bank transfer with Paystack"
              detail={paystack ? "Pay now. Your receipt goes to your email." : "Coming soon. Choose to pay later for now."}
            />
            <ChoiceCard
              name="payment"
              value="pay-later"
              checked={payment === "pay-later"}
              onChange={() => setPayment("pay-later")}
              title={payLaterLabel}
              detail={payLaterDetail}
            />
          </div>
        </Fieldset>

        <Fieldset legend="Anything we should know?">
          <Field id="notes" label="Notes (optional)" hint="Colour, chassis number, or a time that suits you.">
            <Textarea id="notes" name="notes" aria-describedby="notes-hint notes-error" maxLength={500} />
          </Field>
        </Fieldset>
      </div>

      <aside className="rounded-md bg-paper p-5 lg:sticky lg:top-6">
        <h2 className="text-2xl">Your order</h2>
        <ul className="mt-3 divide-y divide-bay">
          {lines.map((line) => {
            const part = parts.get(line.sku);
            const sold = !part || part.status !== "available" || part.stockQty < line.qty;
            const flagged = state.unavailable?.includes(line.sku);
            return (
              <li key={line.sku} className="flex justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="leading-tight font-semibold">
                    {part?.title ?? line.sku}
                    {line.qty > 1 ? ` x${line.qty}` : ""}
                  </p>
                  <p className="text-[13px] tabular">{line.sku}</p>
                  {sold || flagged ? (
                    <p className="text-sm font-semibold text-warn">
                      {loading ? "Checking…" : "No longer available. Remove it from your cart."}
                    </p>
                  ) : vehicle && part?.fits === false ? (
                    <p className="text-sm font-semibold text-warn">Not confirmed for your vehicle</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold tabular">
                  {part ? formatNGN(part.priceNGN * line.qty) : "…"}
                </p>
              </li>
            );
          })}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-primer pt-3">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="font-semibold tabular">{formatNGN(summary.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{DELIVERY_OPTIONS[delivery].label}</dt>
            <dd className="font-semibold tabular">{formatNGN(fee)}</dd>
          </div>
          <div className="flex items-baseline justify-between pt-2">
            <dt className="font-display text-2xl font-semibold">Total</dt>
            <dd className="font-display text-3xl font-bold tabular">{formatNGN(total)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-sm">No other fees.</p>

        {summary.blocked && !loading ? (
          <p className="mt-4 text-sm font-semibold text-warn">
            Remove the unavailable parts from your cart to continue.{" "}
            <Link href="/cart" className="underline underline-offset-2">
              Go to cart
            </Link>
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="mt-5 w-full"
          disabled={pending || loading || summary.blocked || summary.ready.length === 0}
        >
          {pending
            ? "Placing your order…"
            : payment === "paystack"
              ? `Place order and pay ${formatNGN(total)}`
              : "Place order"}
        </Button>
        {summary.ready.length > 0 ? (
          <a
            href={cartWhatsappLink(summary, vehicle?.label ?? null)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-navy font-semibold hover:bg-bay"
          >
            <MessageCircle aria-hidden className="size-[18px]" />
            Complete order on WhatsApp
          </a>
        ) : null}
      </aside>
    </form>
  );
}

function Fieldset({ legend, error, children }: { legend: string; error?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-1 font-display text-2xl font-semibold">{legend}</legend>
      {error ? <p className="-mt-2 text-sm font-semibold text-warn">{error}</p> : null}
      {children}
    </fieldset>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: CheckoutField | "notes";
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  detail,
  aside,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
  aside?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border-2 bg-paper px-3.5 py-3 transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy",
        checked ? "border-tan" : "border-transparent hover:border-primer",
        disabled && "cursor-not-allowed opacity-55 hover:border-transparent",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
          checked ? "border-navy bg-tan" : "border-primer",
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-navy" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm">{detail}</span>
      </span>
      {aside ? <span className="shrink-0 font-semibold tabular">{aside}</span> : null}
    </label>
  );
}
