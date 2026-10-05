import { MessageCircle } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { openWhatsapp } from "@/lib/whatsapp";

import { Button } from "./button";

/** Opens WhatsApp with a prefilled message to the shop. */
export function WhatsappButton({
  message,
  children = "Ask on WhatsApp",
  variant = "outline",
  style,
}: {
  message: string;
  children?: string;
  variant?: "primary" | "outline";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Button variant={variant} icon={MessageCircle} onPress={() => openWhatsapp(message)} style={style}>
      {children}
    </Button>
  );
}
