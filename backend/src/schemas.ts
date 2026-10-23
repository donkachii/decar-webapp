// Request and response bodies.
//
// JSON names match the TypeScript types in frontend/lib (camelCase, with NGN in
// capitals: priceNGN, totalNGN), so the clients read responses as they are.
// Datetimes go out as toISOString(), so ISO strings sort correctly as text.

import { z } from "zod";

import type { Order, OrderItem, Part, User, Vehicle } from "./db.js";
import {
  CONDITIONS,
  type Category,
  type Condition,
  CATEGORIES,
  type Make,
  MAKES,
  oneOf,
  PART_STATUSES,
  PART_TYPES,
  type PartStatus,
  type PartType,
  POSITIONS,
  type Position,
  SHIPPING_CLASSES,
  type ShippingClass,
} from "./domain/catalog.js";
import {
  DELIVERY_OPTIONS,
  type DeliveryOption,
  ORDER_STATUSES,
  type OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
} from "./domain/delivery.js";
import { text } from "./http.js";

// --- Catalog ----------------------------------------------------------------

export interface VehicleOut {
  id: string;
  make: Make;
  model: string;
  generation: string;
  yearFrom: number;
  yearTo: number;
  facelift: boolean;
}

export function vehicleOut(v: Vehicle): VehicleOut {
  return {
    id: v.id,
    make: oneOf(MAKES, v.make),
    model: v.model,
    generation: v.generation,
    yearFrom: v.yearFrom,
    yearTo: v.yearTo,
    facelift: v.facelift,
  };
}

export interface PartOut {
  sku: string;
  name: string;
  category: Category;
  type: PartType;
  position: Position;
  condition: Condition;
  defects: string[];
  oemNumber: string | null;
  variants: Record<string, string | boolean>;
  priceNGN: number;
  stockQty: number;
  status: PartStatus;
  stockCheckedAt: string;
  shippingClass: ShippingClass;
  images: string[];
}

export function partOut(p: Part): PartOut {
  return {
    sku: p.sku,
    name: p.name,
    category: oneOf(CATEGORIES, p.category),
    type: oneOf(PART_TYPES, p.type),
    position: oneOf(POSITIONS, p.position),
    condition: oneOf(CONDITIONS, p.condition),
    defects: p.defects,
    oemNumber: p.oemNumber,
    // An object of strings and booleans: the parts_variants_check constraint and rule 3.
    variants: p.variants as Record<string, string | boolean>,
    priceNGN: p.priceNGN,
    stockQty: p.stockQty,
    status: oneOf(PART_STATUSES, p.status),
    stockCheckedAt: p.stockCheckedAt.toISOString(),
    shippingClass: oneOf(SHIPPING_CLASSES, p.shippingClass),
    images: p.images,
  };
}

export interface FitmentOut {
  partSku: string;
  vehicleId: string;
  notes: string | null;
}

// --- Orders -----------------------------------------------------------------

export interface OrderItemOut {
  sku: string;
  name: string;
  priceNGN: number;
  qty: number;
}

export interface OrderOut {
  id: string;
  number: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleId: string | null;
  deliveryOption: DeliveryOption;
  deliveryAddress: string | null;
  deliveryState: string | null;
  deliveryPark: string | null;
  deliveryFeeNGN: number;
  subtotalNGN: number;
  totalNGN: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paystackReference: string | null;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  items: OrderItemOut[];
}

export type OrderWithItems = Order & { items: OrderItem[] };

export function orderOut(o: OrderWithItems): OrderOut {
  return {
    id: o.id,
    number: o.number,
    userId: o.userId,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    vehicleId: o.vehicleId,
    deliveryOption: oneOf(DELIVERY_OPTIONS, o.deliveryOption),
    deliveryAddress: o.deliveryAddress,
    deliveryState: o.deliveryState,
    deliveryPark: o.deliveryPark,
    deliveryFeeNGN: o.deliveryFeeNGN,
    subtotalNGN: o.subtotalNGN,
    totalNGN: o.totalNGN,
    paymentMethod: oneOf(PAYMENT_METHODS, o.paymentMethod),
    paymentStatus: oneOf(PAYMENT_STATUSES, o.paymentStatus),
    paystackReference: o.paystackReference,
    status: oneOf(ORDER_STATUSES, o.status),
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({ sku: i.sku, name: i.name, priceNGN: i.priceNGN, qty: i.qty })),
  };
}

/** What anyone holding the order link may see: phone masked, no email or account. */
export function publicOrder(order: OrderOut): OrderOut {
  const phone = order.customerPhone;
  const masked = phone.length > 6 ? `${phone.slice(0, 7)}•••${phone.slice(-2)}` : phone;
  return { ...order, customerPhone: masked, customerEmail: null, userId: null, paystackReference: null };
}

const CheckoutLineIn = z.object({
  sku: text(64),
  qty: z.number().int(),
});

/** Raw checkout form. Validated by domain/checkout.ts so errors map to form fields. */
export const CheckoutIn = z.object({
  name: text(500).default(""),
  phone: text(100).default(""),
  email: text(320).default(""),
  delivery: text(20).default(""),
  address: text(1000).default(""),
  state: text(200).default(""),
  park: text(200).default(""),
  payment: text(20).default(""),
  notes: text(2000).default(""),
  vehicleId: text(64).nullable().default(null),
  lines: z.array(CheckoutLineIn).max(100).default([]),
});
export type CheckoutIn = z.output<typeof CheckoutIn>;
export type CheckoutLineIn = z.output<typeof CheckoutLineIn>;

export const PaystackVerifyIn = z.object({ reference: text(100) });

// --- Accounts ---------------------------------------------------------------

export interface UserOut {
  id: string;
  email: string;
  name: string | null;
}

export function userOut(u: User): UserOut {
  return { id: u.id, email: u.email, name: u.name };
}

export const GoogleExchangeIn = z.object({ code: text(2000) });
export const GoogleIdTokenIn = z.object({ idToken: text(4096) });

// PKCE (RFC 7636): the app's verifier and its S256 challenge.
const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export const GoogleAppCodeIn = z.object({
  code: text(2000), // Google's one-time code
  challenge: z.string().regex(PKCE_CHALLENGE),
});

export const AppSessionIn = z.object({
  code: text(2000),
  verifier: z.string().regex(PKCE_VERIFIER),
});

// Lengths are checked in domain/accounts.ts, so the forms get their own words.
export const PasswordIn = z.object({
  email: text(254),
  password: text(1000),
});

const CartLineIn = z.object({
  sku: text(64),
  qty: z.number().int().min(1).max(99),
});

/** A signed-in buyer's cart, the same on the website and the phone. Prices are read at checkout. */
export const SavedCartIn = z.object({ lines: z.array(CartLineIn).max(50) });

// --- Admin ------------------------------------------------------------------

export const PartStatusIn = z.object({ status: z.enum(PART_STATUSES) });
