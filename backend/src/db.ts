import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { getSettings } from "./config.js";
import { type Prisma, PrismaClient } from "./generated/prisma/client.js";

export type { CartLine, Order, OrderItem, Part, User, Vehicle } from "./generated/prisma/client.js";

// Works through Neon's and Supabase's poolers too: node-postgres sends unnamed
// statements, which transaction-mode PgBouncer accepts.
const pool = new pg.Pool({
  connectionString: getSettings().databaseUrl,
  // Prisma's pg adapter reads and writes timestamptz as UTC wall-clock time and
  // ignores the offset, so every session must be in UTC. Neon and Supabase
  // already are; a laptop's Postgres usually runs in local time (Africa/Lagos is
  // +1), which would shift every stockCheckedAt by an hour. The pool waits for
  // this before handing the connection to Prisma.
  // @types/pg says void, but pg-pool awaits the promise.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  onConnect: (client) => client.query("SET TIME ZONE 'UTC'"),
});
// An idle connection the server drops (a pooler restart, say) is replaced on the
// next query. Without a listener the error would crash the process.
pool.on("error", (error) => console.error("[db] idle connection lost:", error.message));

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** The client inside prisma.$transaction(async (tx) => …). */
export type Tx = Prisma.TransactionClient;
