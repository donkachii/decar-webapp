import { NextResponse, type NextRequest } from "next/server";

import { verifyPaystack } from "@/lib/orders/api";

// Paystack sends the buyer back here with ?reference=… after paying. The API
// checks the amount with Paystack before marking the order paid.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  if (!reference) return NextResponse.redirect(`${origin}/`);

  const result = await verifyPaystack(reference).catch((error: unknown) => {
    console.error("[paystack] verify failed", reference, error);
    return null;
  });
  if (!result) return NextResponse.redirect(`${origin}/`);

  const outcome = result.paid ? "&paid=1" : "&payment=incomplete";
  return NextResponse.redirect(`${origin}/order/${result.orderId}?placed=1${outcome}`);
}
