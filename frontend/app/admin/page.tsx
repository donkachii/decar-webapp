import { cn } from "cn";
import { ChevronRight, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { ConditionBadge } from "@/components/condition-badge";
import { PartImage } from "@/components/part-image";
import { PhotoUpload } from "@/components/photo-upload";
import { StockChecked } from "@/components/stock-checked";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminAccess } from "@/lib/auth";
import { getCategoryPhotos, getParts } from "@/lib/catalog";
import { isDrawing } from "@/lib/catalog/images";
import { CATEGORY_INFO, partTitle } from "@/lib/catalog/labels";
import { CATEGORIES, CATEGORY_TYPES, type Part, type PartStatus } from "@/lib/catalog/types";
import { getFeatures } from "@/lib/features";
import { formatDateTime, formatNGN } from "@/lib/format";
import { DELIVERY_OPTIONS } from "@/lib/orders/delivery";
import { listOrders } from "@/lib/orders/api";
import type { Order } from "@/lib/orders/types";

import { AccessPanel } from "./access-panel";
import {
  cancelOrder,
  clearCategoryPhoto,
  completeOrder,
  markAvailable,
  markChecked,
  markSold,
  setCategoryPhoto,
} from "./actions";

export const metadata: Metadata = {
  title: "Shop admin",
  robots: { index: false, follow: false },
};

const VIEWS = ["stock", "photos", "orders"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = { stock: "Stock", photos: "Photos", orders: "Orders" };

const STATUS_LABEL: Record<PartStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const access = await getAdminAccess();
  if (!access.allowed) return <AccessPanel reason={access.reason} email={access.user?.email ?? null} />;

  const sp = await searchParams;
  const view: View = VIEWS.find((v) => v === sp.view) ?? "stock";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl leading-none font-bold">Shop admin</h1>
        {access.user ? (
          <form action={signOut}>
            <Button type="submit" variant="link" className="text-sm">
              Sign out {access.user.email}
            </Button>
          </form>
        ) : null}
      </div>
      {access.demo ? (
        <p className="mt-3 rounded-md border border-dashed border-navy px-3 py-2 text-sm">
          Demo mode: Google sign-in isn&apos;t set up on the API, so anyone running it locally can manage stock.
        </p>
      ) : null}

      <nav aria-label="Admin" className="mt-5 grid grid-cols-3 gap-1 rounded-md bg-paper p-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "stock" ? "/admin" : `/admin?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-[4px] font-display text-xl font-semibold",
              view === v ? "bg-navy text-paper" : "hover:bg-bay",
            )}
          >
            {VIEW_LABEL[v]}
          </Link>
        ))}
      </nav>

      {view === "stock" ? (
        <StockView q={typeof sp.q === "string" ? sp.q : ""} status={typeof sp.status === "string" ? sp.status : ""} />
      ) : view === "photos" ? (
        <PhotosView q={typeof sp.q === "string" ? sp.q : ""} />
      ) : (
        <OrdersView />
      )}
    </div>
  );
}

async function StockView({ q, status }: { q: string; status: string }) {
  const all = await getParts({ includeSold: true });
  const query = q.trim().toLowerCase();
  const parts = all
    .filter((p) => !status || p.status === status)
    .filter((p) => !query || p.sku.toLowerCase().includes(query) || partTitle(p).toLowerCase().includes(query))
    .sort((a, b) => a.stockCheckedAt.localeCompare(b.stockCheckedAt));

  return (
    <section aria-label="Stock" className="mt-5">
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search by SKU or name
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder="SKU or name" className="flex-1" />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Button type="submit" variant="outline" size="icon" aria-label="Search">
          <Search aria-hidden />
        </Button>
      </form>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {["", "available", "reserved", "sold"].map((s) => (
          <Link
            key={s || "all"}
            href={`/admin?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`}
            aria-current={status === s ? "true" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium",
              status === s ? "border-tan bg-tan font-semibold" : "border-primer bg-paper",
            )}
          >
            {s ? STATUS_LABEL[s as PartStatus] : "All"}
          </Link>
        ))}
      </div>
      <p className="mt-4 text-sm">
        Longest since checked first. {parts.length} {parts.length === 1 ? "unit" : "units"}.
      </p>
      <ul className="mt-2 flex flex-col gap-3">
        {parts.map((part) => (
          <StockRow key={part.sku} part={part} />
        ))}
      </ul>
    </section>
  );
}

function StockRow({ part }: { part: Part }) {
  const title = partTitle(part);
  return (
    <li className="rounded-md bg-paper p-3">
      <div className="flex gap-3">
        <PartImage src={part.images[0]} alt="" position={part.position} sizes="64px" className="size-16 shrink-0 rounded-sm border border-bay" />
        <div className="min-w-0 flex-1">
          <Link href={`/part/${part.sku}`} className="font-display text-lg leading-tight font-semibold hover:underline">
            {title}
          </Link>
          <p className="text-[13px] tabular">{part.sku}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ConditionBadge condition={part.condition} />
            <span className="font-semibold tabular">{formatNGN(part.priceNGN)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
        <span className={cn("font-semibold", part.status !== "available" && "text-warn")}>
          {STATUS_LABEL[part.status]}
          {part.status === "available" ? `, ${part.stockQty} on the shelf` : ""}
        </span>
        <StockChecked at={part.stockCheckedAt} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {part.status !== "sold" ? (
          <form action={markSold.bind(null, part.sku)}>
            <SubmitButton className="w-full" pendingLabel="Saving…">
              Mark as sold
            </SubmitButton>
          </form>
        ) : null}
        {part.status !== "available" ? (
          <form action={markAvailable.bind(null, part.sku)}>
            <SubmitButton variant="outline" className="w-full" pendingLabel="Saving…">
              Mark available
            </SubmitButton>
          </form>
        ) : null}
        {part.status === "available" ? (
          <form action={markChecked.bind(null, part.sku)}>
            <SubmitButton variant="outline" className="w-full" pendingLabel="Saving…">
              Checked it now
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function photoCount(part: Part): number {
  return part.images.filter((src) => !isDrawing(src)).length;
}

async function PhotosView({ q }: { q: string }) {
  const [all, categoryPhotos, features] = await Promise.all([
    getParts({ includeSold: true }),
    getCategoryPhotos(),
    getFeatures(),
  ]);
  const query = q.trim().toLowerCase();
  const parts = all
    .filter((p) => !query || p.sku.toLowerCase().includes(query) || partTitle(p).toLowerCase().includes(query))
    .sort((a, b) => photoCount(a) - photoCount(b) || a.sku.localeCompare(b.sku));

  return (
    <>
      {features.photoUploads ? null : (
        <p className="mt-5 rounded-md border border-dashed border-navy px-3 py-2 text-sm">
          Photo uploads are off. Add CLOUDINARY_URL to the API&apos;s environment (backend/.env, or Render), then restart it.
        </p>
      )}

      <section aria-labelledby="category-photos" className="mt-5">
        <h2 id="category-photos" className="text-3xl">
          Category photos
        </h2>
        <p className="mt-1 text-sm">
          The tiles under &ldquo;Shop by part&rdquo; on the home page. Use a wide photo: the tile shows a 4:3 crop.
          Without one, a tile shows a part in stock.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {CATEGORIES.map((category) => {
            const own = categoryPhotos[category];
            const partPhoto = all.find((p) => p.category === category && p.status === "available" && !isDrawing(p.images[0]));
            const src = own ?? partPhoto?.images[0] ?? `/parts/${CATEGORY_TYPES[category][0]}.svg`;
            return (
              <li key={category} className="flex gap-3 rounded-md bg-paper p-3">
                <PartImage src={src} alt="" position="n/a" sizes="96px" className="aspect-[4/3] w-24 shrink-0 self-start rounded-sm border border-bay" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight font-semibold">{CATEGORY_INFO[category].label}</p>
                  <p className="text-sm">
                    {own ? "Your photo" : partPhoto ? "A part's photo, picked for you" : "A drawing until a part has a photo"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {features.photoUploads ? (
                      <PhotoUpload
                        action={setCategoryPhoto.bind(null, category)}
                        label={own ? "Replace photo" : "Upload photo"}
                        variant={own ? "outline" : "default"}
                      />
                    ) : null}
                    {own ? (
                      <form action={clearCategoryPhoto.bind(null, category)}>
                        <SubmitButton variant="outline" pendingLabel="Saving…">
                          Use a part&apos;s photo
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="part-photos" className="mt-8">
        <h2 id="part-photos" className="text-3xl">
          Part photos
        </h2>
        <p className="mt-1 text-sm">Parts without photos first.</p>
        <form className="mt-3 flex gap-2" role="search">
          <input type="hidden" name="view" value="photos" />
          <label htmlFor="photo-q" className="sr-only">
            Search by SKU or name
          </label>
          <Input id="photo-q" name="q" defaultValue={q} placeholder="SKU or name" className="flex-1" />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </form>
        <ul className="mt-3 flex flex-col gap-2">
          {parts.map((part) => {
            const count = photoCount(part);
            return (
              <li key={part.sku}>
                <Link href={`/admin/photos/${part.sku}`} className="flex items-center gap-3 rounded-md bg-paper p-3 transition-shadow duration-200 hover:shadow-lift">
                  <PartImage
                    src={part.images[0]}
                    alt=""
                    position={part.position}
                    sizes="56px"
                    className="size-14 shrink-0 rounded-sm border border-bay"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg leading-tight font-semibold">{partTitle(part)}</span>
                    <span className="block text-[13px] tabular">{part.sku}</span>
                    <span className="block text-sm font-semibold">
                      {count === 0 ? "No photos yet" : count === 1 ? "1 photo" : `${count} photos`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

async function OrdersView() {
  const list = await listOrders(50);
  if (list.length === 0) {
    return <p className="mt-5 rounded-md bg-paper px-5 py-8">No orders yet.</p>;
  }
  return (
    <ul className="mt-5 flex flex-col gap-3">
      {list.map((order) => (
        <OrderRow key={order.id} order={order} />
      ))}
    </ul>
  );
}

function OrderRow({ order }: { order: Order }) {
  const phoneDigits = order.customerPhone.replace(/\D/g, "");
  return (
    <li className="rounded-md bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={`/order/${order.id}`} className="font-display text-2xl font-bold tabular hover:underline">
          {order.number}
        </Link>
        <span className="font-display text-xl font-bold tabular">{formatNGN(order.totalNGN)}</span>
      </div>
      <p className="text-sm">
        {formatDateTime(order.createdAt)}.{" "}
        <span className={cn("font-semibold", order.status === "cancelled" && "text-warn")}>
          {order.status === "new" ? "New" : order.status === "completed" ? "Completed" : "Cancelled"}
        </span>
        . {order.paymentStatus === "paid" ? "Paid" : order.paymentMethod === "paystack" ? "Paystack, unpaid" : "Pay later"}.
      </p>
      <p className="mt-3 font-semibold">{order.customerName}</p>
      <p className="flex flex-wrap gap-x-4">
        <a href={`tel:${order.customerPhone}`} className="underline underline-offset-2">
          {order.customerPhone}
        </a>
        <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          WhatsApp
        </a>
      </p>
      <p className="mt-2 text-sm">
        {DELIVERY_OPTIONS[order.deliveryOption].label}
        {order.deliveryAddress ? `: ${order.deliveryAddress}` : ""}
        {order.deliveryOption === "waybill" ? `: ${[order.deliveryPark, order.deliveryState].filter(Boolean).join(", ")}` : ""}
      </p>
      {order.notes ? <p className="mt-1 text-sm">Notes: {order.notes}</p> : null}
      <ul className="mt-3 divide-y divide-bay border-y border-bay text-sm">
        {order.items.map((i) => (
          <li key={i.sku} className="flex justify-between gap-3 py-1.5">
            <span className="tabular">
              {i.sku}
              {i.qty > 1 ? ` x${i.qty}` : ""}
            </span>
            <span className="tabular">{formatNGN(i.priceNGN * i.qty)}</span>
          </li>
        ))}
      </ul>
      {order.status === "new" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <form action={completeOrder.bind(null, order.id)}>
            <SubmitButton className="w-full" pendingLabel="Saving…">
              Mark completed
            </SubmitButton>
          </form>
          <form action={cancelOrder.bind(null, order.id)}>
            <SubmitButton variant="destructive" className="w-full" pendingLabel="Saving…">
              Cancel order
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}
