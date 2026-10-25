import cors from "cors";
import express, { type Express } from "express";

import type { Settings } from "./config.js";
import { prisma } from "./db.js";
import { errorHandler, HttpError } from "./http.js";
import { accountsRouter } from "./routes/accounts.js";
import { adminRouter } from "./routes/admin.js";
import { catalogRouter } from "./routes/catalog.js";
import { ordersRouter } from "./routes/orders.js";

export function createApp(settings: Settings): Express {
  const app = express();
  app.disable("x-powered-by");
  // ?type=a&type=b arrives as ["a", "b"]; nothing nests.
  app.set("query parser", "simple");

  // The Next.js server and the phone app are the callers; CORS only matters if a
  // browser calls the API directly.
  app.use(
    cors({
      origin: settings.frontendOrigin,
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  app.use(catalogRouter(settings));
  app.use(ordersRouter(settings));
  app.use(accountsRouter(settings));
  app.use("/admin", adminRouter(settings));

  app.use(() => {
    throw new HttpError(404, "Not Found");
  });
  app.use(errorHandler);
  return app;
}
