// Google sign-in in the browser comes back to decar://auth (exp://…/--/auth in
// Expo Go). The in-app browser hands that address to the sign-in code
// (src/lib/session.ts), so the router ignores it and the buyer stays where
// they started: the Account tab or checkout.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  try {
    return /(^|\/)auth$/.test(path.split("?")[0]) ? null : path;
  } catch {
    return path;
  }
}
