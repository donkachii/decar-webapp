import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { formatDateTime, formatNGN } from "@/lib/format";
import { listMyOrders } from "@/lib/orders/api";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

const STATUS: Record<string, string> = {
  new: "Waiting for confirmation",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect("/signin?next=/account");

  const mine = await listMyOrders();

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="text-5xl leading-none font-bold">Your account</h1>
      <p className="mt-2 text-[17px]">{user.name ? `${user.name}, ${user.email}` : user.email}</p>
      <form action={signOut} className="mt-4">
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>

      <h2 className="mt-10 text-3xl">Your orders</h2>
      {mine.length === 0 ? (
        <p className="mt-3 rounded-md bg-paper px-5 py-6">
          No orders yet. Orders you place while signed in show up here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-bay rounded-md bg-paper">
          {mine.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-bay">
                <span>
                  <span className="block font-display text-xl font-bold tabular">{o.number}</span>
                  <span className="block text-sm">
                    {formatDateTime(o.createdAt)}. {o.items.length} {o.items.length === 1 ? "part" : "parts"}.{" "}
                    {STATUS[o.status]}
                  </span>
                </span>
                <span className="font-semibold tabular">{formatNGN(o.totalNGN)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
