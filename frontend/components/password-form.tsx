"use client";

import { useActionState, useState } from "react";

import { passwordAuth, type PasswordMode, type PasswordState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: PasswordState = { mode: "sign-in", error: null, email: "" };

/** Email and password: sign in, or create an account. Google sits beside it on /signin. */
export function PasswordForm({ next }: { next: string }) {
  const [mode, setMode] = useState<PasswordMode>("sign-in");
  const [state, formAction] = useActionState(passwordAuth, initialState);
  const signUp = mode === "sign-up";
  // A refusal belongs to the form that got it; switching forms clears it.
  const error = state.mode === mode ? state.error : null;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={!!error}
          aria-describedby={error ? "password-error" : undefined}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        {signUp ? (
          <p id="password-hint" className="text-sm">
            At least 8 characters.
          </p>
        ) : null}
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          minLength={signUp ? 8 : undefined}
          aria-invalid={!!error}
          aria-describedby={[signUp ? "password-hint" : "", error ? "password-error" : ""].join(" ").trim() || undefined}
          required
        />
      </div>
      {error ? (
        <p id="password-error" role="alert" className="font-semibold text-warn">
          {error}
        </p>
      ) : null}
      <SubmitButton size="lg" className="w-full" pendingLabel={signUp ? "Creating account…" : "Signing in…"}>
        {signUp ? "Create account" : "Sign in"}
      </SubmitButton>
      <p className="text-sm">
        {signUp ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          onClick={() => setMode(signUp ? "sign-in" : "sign-up")}
          className="font-semibold underline underline-offset-2"
        >
          {signUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}
