import { createApp } from "./app.js";
import { checkProduction, getSettings } from "./config.js";
import { prisma } from "./db.js";

const settings = getSettings();
checkProduction(settings);

const port = Number(process.env.PORT ?? 8000);
const server = createApp(settings).listen(port, () => {
  console.log(`De Car Revolutionist API on http://localhost:${port} (${settings.appEnv})`);
});

// Render and most hosts send SIGTERM before replacing the service: finish what's
// in flight, then close the database pool.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
