import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { z, ZodError } from "zod";
import { createChallengeSchema } from "../shared/contracts";
import { validateInitData } from "./auth";
import { AppError } from "./errors";
import { ChallengeRepository } from "./repository";
import { ChallengeService } from "./challenges";

export interface AppOptions {
  databasePath: string;
  devAuth?: boolean;
  production?: boolean;
  botToken?: string;
  staticRoot?: string;
  clock?: () => Date;
}
export async function buildApp(options: AppOptions) {
  if (options.production && options.devAuth)
    throw new Error("DEV_AUTH is forbidden in production");
  if (!options.devAuth && !options.botToken)
    throw new Error("Set BOT_TOKEN or use local pnpm dev");
  const app = Fastify({ bodyLimit: 16_384, logger: false });
  const repository = new ChallengeRepository(options.databasePath);
  const service = new ChallengeService(repository, options.clock);
  app.addHook("onClose", async () => repository.close());
  await app.register(helmet, {
    // Telegram Web may embed the app. Other sites cannot frame it.
    xFrameOptions: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://telegram.org"],
        styleSrc: ["'self'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        frameAncestors: [
          "'self'",
          "https://web.telegram.org",
          "https://*.telegram.org",
        ],
        upgradeInsecureRequests: options.production ? [] : null,
      },
    },
    strictTransportSecurity: options.production,
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(422)
        .send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Проверьте название, дату, длительность и часовой пояс.",
          },
        });
    if (error instanceof AppError)
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    const status =
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
        ? error.statusCode
        : 500;
    return reply
      .code(status)
      .send({
        error: {
          code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
          message:
            status === 429
              ? "Слишком много запросов. Попробуйте через минуту."
              : "Не удалось обработать запрос.",
        },
      });
  });
  app.get("/api/health", async () => ({ status: "ok" }));
  app.get("/healthz", async () => ({ status: "ok" }));
  await app.register(
    async (api) => {
      const owners = new WeakMap<object, string>();
      api.addHook("preHandler", async (request, reply) => {
        reply.header("Cache-Control", "no-store");
        // Development identity is available only to local requests with explicit app header.
        if (options.devAuth) {
          const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
            request.ip,
          );
          const allowedOrigins = [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:3001",
            "http://localhost:3001",
          ];
          if (
            !local ||
            request.headers["x-local-development"] !== "true" ||
            (request.headers.origin &&
              !allowedOrigins.includes(request.headers.origin))
          ) {
            throw new AppError(
              401,
              "UNAUTHORIZED",
              "Локальный режим доступен только на этом компьютере.",
            );
          }
          owners.set(request, "local-developer");
        } else {
          const header = request.headers.authorization ?? "";
          if (!header.startsWith("tma "))
            throw new AppError(
              401,
              "UNAUTHORIZED",
              "Откройте приложение через Telegram.",
            );
          owners.set(
            request,
            validateInitData(
              header.slice(4),
              options.botToken!,
              options.clock?.(),
            ),
          );
        }
      });
      api.get("/session", async () => ({
        mode: options.devAuth ? "development" : "telegram",
      }));
      api.get("/challenges", async (request) => {
        const query = z
          .object({
            page: z.coerce.number().int().min(1).max(100000).default(1),
            pageSize: z.coerce.number().int().min(1).max(50).default(20),
          })
          .parse(request.query);
        return service.list(owners.get(request)!, query.page, query.pageSize);
      });
      api.post("/challenges", async (request, reply) => {
        const challenge = service.create(
          owners.get(request)!,
          createChallengeSchema.parse(request.body),
        );
        return reply.code(201).send(challenge);
      });
      const idOf = (params: unknown) =>
        z.object({ id: z.uuid() }).parse(params).id;
      api.get("/challenges/:id", async (request) =>
        service.get(owners.get(request)!, idOf(request.params)),
      );
      api.put("/challenges/:id/check-ins/today", async (request) =>
        service.checkIn(owners.get(request)!, idOf(request.params), true),
      );
      api.delete("/challenges/:id/check-ins/today", async (request) =>
        service.checkIn(owners.get(request)!, idOf(request.params), false),
      );
      api.put("/challenges/:id/archive", async (request) =>
        service.archive(owners.get(request)!, idOf(request.params)),
      );
      api.delete("/challenges/:id/archive", async (request) =>
        service.unarchive(owners.get(request)!, idOf(request.params)),
      );
    },
    { prefix: "/api" },
  );
  if (options.staticRoot)
    await app.register(staticFiles, { root: options.staticRoot });
  app.setNotFoundHandler((_request, reply) =>
    reply
      .code(404)
      .send({ error: { code: "NOT_FOUND", message: "Страница не найдена." } }),
  );
  return app;
}
