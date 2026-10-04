import { NextResponse, type NextRequest } from "next/server";

import { VEHICLE_COOKIE } from "@/lib/config/site";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  // Shared links carry ?vehicle=<id>. The recipient sees the same filtered
  // view and the car stays selected for the rest of their visit.
  const vehicle = request.nextUrl.searchParams.get("vehicle");
  const selectVehicle = vehicle && vehicle !== "all" && /^[a-z0-9-]{3,64}$/.test(vehicle);
  if (!selectVehicle) return NextResponse.next();

  request.cookies.set(VEHICLE_COOKIE, vehicle);
  const response = NextResponse.next({ request });
  response.cookies.set(VEHICLE_COOKIE, vehicle, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|icon.svg|parts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
