export type DeliveryOption = "pickup" | "abuja" | "waybill";
export type PaymentMethod = "paystack" | "pay-later";
export type PaymentStatus = "pending" | "paid" | "failed";
export type OrderStatus = "new" | "completed" | "cancelled";

export interface OrderItem {
  sku: string;
  name: string; // snapshot at order time
  priceNGN: number; // snapshot at order time, read from the catalog, never the cart
  qty: number;
}

export interface Order {
  id: string;
  number: string; // 'DCR-00012'
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
  items: OrderItem[];
}
