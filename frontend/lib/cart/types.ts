import type { Condition, PartStatus, PartType, Position, ShippingClass } from "@/lib/catalog/types";

/** What the cart needs to show a line, read fresh from the catalog. */
export interface CartPartView {
  sku: string;
  title: string;
  type: PartType;
  position: Position;
  condition: Condition;
  priceNGN: number;
  status: PartStatus;
  stockQty: number;
  belgium: boolean;
  image: string | null;
  shippingClass: ShippingClass;
  /** null when no vehicle is selected */
  fits: boolean | null;
}

export interface CartDetailsResponse {
  parts: CartPartView[];
  vehicle: { id: string; label: string; shortLabel: string } | null;
}
