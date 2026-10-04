import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-16">
      <h1 className="text-5xl leading-none font-bold">That page isn&apos;t on the shelf</h1>
      <p className="mt-4 text-[17px]">
        The link may be old, or the part may have been sold and removed. Choose your car on the home
        page to see what fits it today.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Find parts for my car</Link>
      </Button>
    </div>
  );
}
