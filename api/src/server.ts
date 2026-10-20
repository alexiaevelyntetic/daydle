import { buildApp } from "./app.js";

const app = buildApp({
  dbPath: process.env.DB_PATH ?? "data/questlog.db",
  logger: true,
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

// API_PORT rather than the generic PORT: when both apps start from one shell (npm run dev),
// an inherited PORT meant for the UI must not move the API off 3001.
await app.listen({
  port: Number(process.env.API_PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
});
