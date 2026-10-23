import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, db pull, studio) doesn't read .env on its own.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env: the variables come from the environment (Render, CI).
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Transaction-mode poolers (Neon's -pooler host, Supabase's port 6543) can't
    // hold Prisma Migrate's advisory lock, so set DIRECT_URL to the direct URI
    // when DATABASE_URL is one. The API itself always uses DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://localhost:5432/decar",
  },
});
