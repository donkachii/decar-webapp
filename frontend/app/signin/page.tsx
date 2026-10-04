import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { getFeatures } from "@/lib/features";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again.",
  "not-configured": "Google sign-in isn't set up on this site yet.",
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const sp = await searchParams;
  const nextParam = typeof sp.next === "string" ? sp.next : "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;

  if (await getUser()) redirect(next);
  const { googleSignIn } = await getFeatures();

  return (
    <div className="mx-auto max-w-md px-4 pt-12">
      <h1 className="text-5xl leading-none font-bold">Sign in</h1>
      <p className="mt-4 text-[17px]">
        Optional. Sign in to see your past orders and fill in checkout faster. You can always check
        out as a guest.
      </p>

      {error ? (
        <p role="alert" className="mt-5 rounded-md bg-paper px-4 py-3 font-semibold text-warn">
          {error}
        </p>
      ) : null}

      {googleSignIn ? (
        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" size="lg" className="w-full bg-paper">
            <GoogleMark />
            Continue with Google
          </Button>
        </form>
      ) : (
        <p className="mt-6 rounded-md bg-paper px-4 py-3">
          Google sign-in isn&apos;t set up yet. You can still check out as a guest.
        </p>
      )}
    </div>
  );
}

// Google's "G" mark in a single colour, as its brand rules allow on light grounds.
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.68 3.69 14.53 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z" />
    </svg>
  );
}
