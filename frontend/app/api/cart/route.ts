import { NextResponse, type NextRequest } from "next/server";

import { getCartDetails, parseSkuList } from "@/lib/cart/server";
import { getSelectedVehicle } from "@/lib/vehicle";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }
  const skus = parseSkuList((body as { skus?: unknown } | null)?.skus);
  const vehicle = await getSelectedVehicle();
  const details = await getCartDetails(skus, vehicle);
  return NextResponse.json(details, { headers: { "cache-control": "no-store" } });
}
