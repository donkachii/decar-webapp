import { z } from "zod";

export const SITE_NAME = "De Car Revolutionist";
export const SITE_ADDRESS = "Shop C12/111, Igbo-Ukwu Line, Zuba Spare Parts Market, Abuja";
// Both numbers take calls and WhatsApp chats. The first is the WhatsApp link
// unless WHATSAPP_NUMBER says otherwise.
export const SITE_PHONES = ["0816 645 6295", "0901 539 6483"] as const;
export const SITE_WHATSAPP = "2348166456295";

// Signs session tokens when APP_ENV is development or test and SESSION_SECRET is
// empty, so a fresh clone runs without any setup. Production refuses to start.
const DEV_SESSION_SECRET = "dev-only-session-secret-not-for-production";

// Read from the environment and backend/.env (see getSettings).
const Env = z.object({
  APP_ENV: z.enum(["development", "production", "test"]).default("production"),
  // The only database setting. Locally: your own Postgres. Deployed: the
  // provider's connection string (pooled is fine). No Supabase API keys.
  DATABASE_URL: z.string().default("postgresql://localhost:5432/decar"),
  // Public URL of the Next.js frontend, no trailing slash. Used for the Google
  // redirect, the Paystack callback, CORS and links in emails.
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  // The phone app's OAuth client IDs (iOS, Android), comma-separated. The app
  // signs in on the phone and sends Google's ID token; tokens issued to these
  // clients or to GOOGLE_CLIENT_ID are accepted.
  GOOGLE_MOBILE_CLIENT_IDS: z.string().default(""),
  ADMIN_EMAILS: z.string().default(""),
  GMAIL_USER: z.string().default(""),
  GMAIL_APP_PASSWORD: z.string().default(""),
  OWNER_EMAIL: z.string().default(""),
  PAYSTACK_SECRET_KEY: z.string().default(""),
  // Part photos. Cloudinary console > Settings > API Keys > "API environment
  // variable": cloudinary://<api_key>:<api_secret>@<cloud_name>
  CLOUDINARY_URL: z.string().default(""),
  // Shop WhatsApp number, international format, digits only (2348012345678).
  // Empty uses SITE_WHATSAPP.
  WHATSAPP_NUMBER: z.string().default(""),
});

export type AppEnv = "development" | "production" | "test";

export interface Settings {
  appEnv: AppEnv;
  databaseUrl: string;
  frontendUrl: string;
  sessionSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  adminEmails: string;
  gmailUser: string;
  gmailAppPassword: string;
  ownerEmail: string;
  paystackSecretKey: string;
  cloudinaryUrl: string;
  /** WHATSAPP_NUMBER's digits, or the shop's own number. */
  whatsappDigits: string;
  /** FRONTEND_URL without a trailing slash. */
  frontendOrigin: string;
  googleRedirectUri: string;
  adminEmailSet: ReadonlySet<string>;
  /** Client IDs a Google ID token may be issued to: the website's, then the app's. */
  googleAudiences: readonly string[];
  googleEnabled: boolean;
  paystackEnabled: boolean;
  cloudinaryEnabled: boolean;
  /** Local dev without Google sign-in opens /admin to anyone. Never in production. */
  demoAdmin: boolean;
}

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const e = Env.parse(env);
  const frontendOrigin = e.FRONTEND_URL.replace(/\/+$/, "");
  const googleEnabled = Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
  return {
    appEnv: e.APP_ENV,
    databaseUrl: e.DATABASE_URL,
    frontendUrl: e.FRONTEND_URL,
    sessionSecret: e.SESSION_SECRET,
    googleClientId: e.GOOGLE_CLIENT_ID,
    googleClientSecret: e.GOOGLE_CLIENT_SECRET,
    adminEmails: e.ADMIN_EMAILS,
    gmailUser: e.GMAIL_USER,
    gmailAppPassword: e.GMAIL_APP_PASSWORD,
    ownerEmail: e.OWNER_EMAIL,
    paystackSecretKey: e.PAYSTACK_SECRET_KEY,
    cloudinaryUrl: e.CLOUDINARY_URL,
    whatsappDigits: e.WHATSAPP_NUMBER.replace(/\D/g, "") || SITE_WHATSAPP,
    frontendOrigin,
    googleRedirectUri: `${frontendOrigin}/auth/callback`,
    adminEmailSet: new Set(commaList(e.ADMIN_EMAILS).map((email) => email.toLowerCase())),
    googleAudiences: commaList([e.GOOGLE_CLIENT_ID, e.GOOGLE_MOBILE_CLIENT_IDS].join(",")),
    googleEnabled,
    paystackEnabled: Boolean(e.PAYSTACK_SECRET_KEY),
    cloudinaryEnabled: Boolean(e.CLOUDINARY_URL),
    demoAdmin: e.APP_ENV === "development" && !googleEnabled,
  };
}

let cached: Settings | undefined;

/** The settings from the environment, after .env in the working directory if there is one. */
export function getSettings(): Settings {
  if (cached === undefined) {
    try {
      // Variables already in the environment win over the file.
      process.loadEnvFile(".env");
    } catch {
      // No .env: everything comes from the environment (Render) or the defaults.
    }
    cached = loadSettings();
  }
  return cached;
}

/** The key that signs session tokens and app codes. */
export function signingSecret(settings: Settings): string {
  if (settings.sessionSecret) return settings.sessionSecret;
  if (settings.appEnv !== "production") return DEV_SESSION_SECRET;
  throw new Error("SESSION_SECRET is not set. See backend/.env.example.");
}

export function checkProduction(settings: Settings): void {
  if (settings.appEnv !== "production") return;
  if (settings.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
}
