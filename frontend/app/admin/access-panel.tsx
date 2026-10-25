import { signInWithGoogle, signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** What /admin pages show anyone who can't manage stock. */
export function AccessPanel({
  reason,
  email,
  next = "/admin",
}: {
  reason: "signed-out" | "not-allowed" | "not-configured";
  email: string | null;
  /** Where signing in comes back to. */
  next?: string;
}) {
  return (
    <div className="mx-auto max-w-md px-4 pt-12">
      <h1 className="text-4xl leading-none font-bold">Shop staff</h1>
      {reason === "signed-out" ? (
        <>
          <p className="mt-4 text-[17px]">Sign in with the Google account the shop registered for stock updates.</p>
          <form action={signInWithGoogle} className="mt-6">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" size="lg" className="w-full">
              Sign in with Google
            </Button>
          </form>
        </>
      ) : reason === "not-allowed" ? (
        <>
          <p className="mt-4 text-[17px]">
            {email ?? "This account"} can&apos;t manage stock. Ask the owner to add it to ADMIN_EMAILS.
          </p>
          <form action={signOut} className="mt-6">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <p className="mt-4 text-[17px]">Set up Google sign-in on the API to manage stock. See the README.</p>
      )}
    </div>
  );
}
