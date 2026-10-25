import { Router } from "express";
import { z } from "zod";

import { appReturnAllowed, createAppCode, createSessionToken, isAdmin, redeemAppCode, requireUser } from "../auth.js";
import type { Settings } from "../config.js";
import { Prisma } from "../generated/prisma/client.js";
import { prisma, type User } from "../db.js";
import * as accounts from "../domain/accounts.js";
import { HttpError, parse, queryValue, text } from "../http.js";
import {
  AppSessionIn,
  GoogleAppCodeIn,
  GoogleExchangeIn,
  GoogleIdTokenIn,
  orderOut,
  PasswordIn,
  SavedCartIn,
  userOut,
} from "../schemas.js";
import { getCart, mergeCart, replaceCart } from "../services/carts.js";
import * as google from "../services/google.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";

const GoogleUrlQuery = z.object({
  state: z.string().min(16).max(200),
  appReturn: text(500).optional(),
});

const SIGN_IN_FAILED = "Google sign-in didn't finish.";

export function accountsRouter(settings: Settings): Router {
  const router = Router();

  function requireGoogle(): void {
    if (!settings.googleEnabled) throw new HttpError(503, "Google sign-in isn't set up.");
  }

  async function sessionOut(user: User, created: boolean) {
    return { token: await createSessionToken(settings, user.id), user: userOut(user), created };
  }

  /** Creates or refreshes the account by Google subject. True when this made it. */
  async function saveAccount(identity: google.GoogleIdentity): Promise<{ user: User; created: boolean }> {
    const existing = await prisma.user.findUnique({ where: { googleSub: identity.sub }, select: { id: true } });
    const user = await prisma.user.upsert({
      where: { googleSub: identity.sub },
      create: { googleSub: identity.sub, email: identity.email, name: identity.name },
      update: { email: identity.email, name: identity.name, lastSignInAt: new Date() },
    });
    return { user, created: existing === null };
  }

  async function googleIdentity(sign: () => Promise<google.GoogleIdentity>): Promise<google.GoogleIdentity> {
    try {
      return await sign();
    } catch (error) {
      if (error instanceof google.GoogleSignInError) throw new HttpError(400, SIGN_IN_FAILED);
      throw error;
    }
  }

  /**
   * Where to send the buyer. The website keeps `state` in a cookie and checks it on return.
   *
   * `appReturn` marks a phone-app sign-in in the browser: the address the website
   * will hand the app's one-time code to, checked here before the buyer leaves.
   */
  router.get("/auth/google/url", (req, res) => {
    requireGoogle();
    const q = parse(GoogleUrlQuery, { state: queryValue(req, "state"), appReturn: queryValue(req, "appReturn") }, "query");
    if (q.appReturn !== undefined && !appReturnAllowed(settings, q.appReturn)) {
      throw new HttpError(400, "That address can't receive a sign-in.");
    }
    res.json({ url: google.authorizationUrl(settings, q.state) });
  });

  /** Trades Google's one-time code for an API session token. */
  router.post("/auth/google/exchange", async (req, res) => {
    requireGoogle();
    const { code } = parse(GoogleExchangeIn, req.body, "body");
    const identity = await googleIdentity(() => google.exchangeCode(settings, code));
    const { user, created } = await saveAccount(identity);
    res.json(await sessionOut(user, created));
  });

  /** The phone app's sign-in: Google signed the buyer in on the phone and gave the app an ID token. */
  router.post("/auth/google/id-token", async (req, res) => {
    requireGoogle();
    const { idToken } = parse(GoogleIdTokenIn, req.body, "body");
    const identity = await googleIdentity(() => google.verifyIdToken(settings, idToken));
    const { user, created } = await saveAccount(identity);
    res.json(await sessionOut(user, created));
  });

  /**
   * The website's callback for a phone-app sign-in in the browser.
   *
   * Trades Google's code like /auth/google/exchange, but returns a one-time code
   * for the app instead of the session token: it travels in a URL, so it is only
   * worth anything with the verifier the app kept.
   */
  router.post("/auth/google/app-code", async (req, res) => {
    requireGoogle();
    const { code, challenge } = parse(GoogleAppCodeIn, req.body, "body");
    const identity = await googleIdentity(() => google.exchangeCode(settings, code));
    const { user, created } = await saveAccount(identity);
    res.json({ code: await createAppCode(settings, user.id, challenge, created) });
  });

  /** The phone app trades its one-time code and verifier for an API session token. */
  router.post("/auth/google/app-session", async (req, res) => {
    requireGoogle();
    const { code, verifier } = parse(AppSessionIn, req.body, "body");
    const redeemed = await redeemAppCode(settings, code, verifier);
    const user = redeemed ? await prisma.user.findUnique({ where: { id: redeemed.userId } }) : null;
    if (redeemed === null || user === null) throw new HttpError(400, SIGN_IN_FAILED);
    res.json(await sessionOut(user, redeemed.created));
  });

  /** Makes an email and password account and signs it in. Details are the form's words. */
  router.post("/auth/password/sign-up", async (req, res) => {
    const body = parse(PasswordIn, req.body, "body");
    const email = accounts.normaliseEmail(body.email);
    const problem = accounts.signUpProblem(email, body.password);
    if (problem) throw new HttpError(400, problem);
    // A password account with this email first, so the message says "sign in" when it can.
    const existing = await prisma.user.findFirst({
      where: { email },
      orderBy: { passwordHash: { sort: "asc", nulls: "last" } },
    });
    if (existing !== null) throw new HttpError(409, existing.passwordHash ? accounts.TAKEN : accounts.GOOGLE_ACCOUNT);

    let user: User;
    try {
      user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(body.password) } });
    } catch (error) {
      // The same email signing up twice at once.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, accounts.TAKEN);
      }
      throw error;
    }
    res.json(await sessionOut(user, true));
  });

  /** Signs in an email and password account. Details are the form's words. */
  router.post("/auth/password/sign-in", async (req, res) => {
    const body = parse(PasswordIn, req.body, "body");
    const email = accounts.normaliseEmail(body.email);
    const user = await prisma.user.findFirst({ where: { email, passwordHash: { not: null } } });
    const matches = await verifyPassword(body.password, user?.passwordHash ?? null);
    if (user === null || !matches) {
      const hasGoogle = await prisma.user.findFirst({ where: { email, googleSub: { not: null } }, select: { id: true } });
      throw new HttpError(401, user === null && hasGoogle !== null ? accounts.GOOGLE_ACCOUNT : accounts.WRONG);
    }
    const signedIn = await prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
    res.json(await sessionOut(signedIn, false));
  });

  router.get("/me", async (req, res) => {
    const user = await requireUser(req, settings);
    res.json({ user: userOut(user), isAdmin: isAdmin(settings, user) });
  });

  router.get("/me/orders", async (req, res) => {
    const user = await requireUser(req, settings);
    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    res.json(orders.map(orderOut));
  });

  /** The cart saved to this account, so the website and the phone app show the same one. */
  router.get("/me/cart", async (req, res) => {
    const user = await requireUser(req, settings);
    res.json({ lines: await getCart(user.id) });
  });

  /** Replaces the saved cart after a change on either client. Parts no longer listed drop out. */
  router.put("/me/cart", async (req, res) => {
    const user = await requireUser(req, settings);
    const { lines } = parse(SavedCartIn, req.body, "body");
    res.json({ lines: await replaceCart(user.id, lines) });
  });

  /** Adds a guest cart to the account's at sign-in. Never reserves a unit. */
  router.post("/me/cart/merge", async (req, res) => {
    const user = await requireUser(req, settings);
    const { lines } = parse(SavedCartIn, req.body, "body");
    res.json({ lines: await mergeCart(user.id, lines) });
  });

  return router;
}
