import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildApp } from "./app";

const production = process.env.NODE_ENV === "production";
const devAuth = process.env.DEV_AUTH === "true";
const host = process.env.HOST ?? "127.0.0.1";
if (devAuth && host !== "127.0.0.1" && host !== "::1")
  throw new Error("DEV_AUTH requires loopback HOST");
const databasePath = resolve(
  process.env.DATABASE_PATH ?? "data/challenge-buddy.sqlite",
);
mkdirSync(dirname(databasePath), { recursive: true });
const staticRoot = resolve("dist");
const app = await buildApp({
  databasePath,
  production,
  devAuth,
  botToken: process.env.BOT_TOKEN,
  staticRoot: existsSync(staticRoot) ? staticRoot : undefined,
});
await app.listen({ host, port: Number(process.env.PORT ?? 3001) });
process.stdout.write(
  `Challenge Buddy API: http://${host}:${process.env.PORT ?? 3001}\n`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
