import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConditionBadge } from "@/components/condition-badge";
import { PartImage } from "@/components/part-image";
import { PhotoUpload } from "@/components/photo-upload";
import { SubmitButton } from "@/components/submit-button";
import { getAdminAccess } from "@/lib/auth";
import { getPart } from "@/lib/catalog";
import { isDrawing } from "@/lib/catalog/images";
import { partTitle } from "@/lib/catalog/labels";
import { normaliseSku } from "@/lib/catalog/sku";
import { isBelgium } from "@/lib/catalog/types";
import { getFeatures } from "@/lib/features";

import { AccessPanel } from "../../access-panel";
import { addPartPhoto, makeCardPhoto, removePartPhoto } from "../../actions";

export const metadata: Metadata = {
  title: "Part photos",
  robots: { index: false, follow: false },
};

export default async function PartPhotosPage({ params }: PageProps<"/admin/photos/[sku]">) {
  const { sku: raw } = await params;
  const access = await getAdminAccess();
  if (!access.allowed) {
    return <AccessPanel reason={access.reason} email={access.user?.email ?? null} next={`/admin/photos/${raw}`} />;
  }

  const sku = normaliseSku(raw);
  const [part, features] = await Promise.all([sku ? getPart(sku) : null, getFeatures()]);
  if (!part) notFound();
  const photos = part.images.filter((src) => !isDrawing(src));
  const title = partTitle(part);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <Link href="/admin?view=photos" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        All photos
      </Link>
      <h1 className="mt-3 text-4xl leading-none font-bold">{title}</h1>
      <p className="mt-2 text-[13px] tabular">{part.sku}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ConditionBadge condition={part.condition} />
        <Link href={`/part/${part.sku}`} className="text-sm underline underline-offset-2">
          See it on the site
        </Link>
      </div>

      <ul className="mt-5 flex list-disc flex-col gap-1 rounded-md bg-paper py-3 pr-4 pl-8 text-[15px]">
        <li>Photo 1 is the card and the WhatsApp preview: the part on its own, on a plain light background.</li>
        {isBelgium(part.condition) ? <li>A Belgium unit: photos of this exact unit only, never supplier photos.</li> : null}
        {part.defects?.length ? <li>Show each defect: {part.defects.join("; ")}.</li> : null}
      </ul>

      {photos.length === 0 ? (
        <p className="mt-5 rounded-md bg-paper px-5 py-8">No photos yet. The site shows a line drawing until you add one.</p>
      ) : (
        <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((src, i) => (
            <li key={src} className="flex flex-col rounded-md bg-paper p-2">
              <PartImage
                src={src}
                alt={`${title}, photo ${i + 1}`}
                position={part.position}
                fit="contain"
                sizes="(min-width: 640px) 240px, 50vw"
                className="rounded-sm border border-bay"
              />
              <p className="mt-2 px-1 text-sm font-semibold">{i === 0 ? "1 · Card photo" : i + 1}</p>
              <div className="mt-2 flex flex-1 flex-col justify-end gap-2">
                {i > 0 ? (
                  <form action={makeCardPhoto.bind(null, part.sku, src)}>
                    <SubmitButton variant="outline" size="sm" className="w-full" pendingLabel="Saving…">
                      Make card photo
                    </SubmitButton>
                  </form>
                ) : null}
                <form action={removePartPhoto.bind(null, part.sku, src)}>
                  <SubmitButton variant="destructive" size="sm" className="w-full" pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 pb-10">
        {features.photoUploads ? (
          <>
            <PhotoUpload action={addPartPhoto.bind(null, part.sku)} label="Add photos" multiple />
            <p className="mt-2 text-sm">Take them with the camera or pick them from the gallery. New photos go at the end.</p>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-navy px-3 py-2 text-sm">
            Photo uploads are off. Add CLOUDINARY_URL to the API&apos;s environment (backend/.env, or Render), then restart it.
          </p>
        )}
      </div>
    </div>
  );
}
