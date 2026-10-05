import { Check, Plus } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { useCartStore } from "@/lib/cart";

import { Button } from "./button";

/** Adds the part and slides the cart sheet up. No navigation. */
export function AddToCartButton({
  sku,
  maxQty,
  size = "md",
  style,
}: {
  sku: string;
  maxQty: number;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}) {
  const inCart = useCartStore((s) => s.lines.find((l) => l.sku === sku));
  const add = useCartStore((s) => s.add);
  const setOpen = useCartStore((s) => s.setOpen);
  const full = inCart !== undefined && inCart.qty >= maxQty;

  return full ? (
    <Button variant="outline" size={size} icon={Check} onPress={() => setOpen(true)} style={style}>
      View in cart
    </Button>
  ) : (
    <Button size={size} icon={Plus} onPress={() => add(sku, maxQty)} style={style}>
      Add to cart
    </Button>
  );
}
