import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import { rateLimit } from "./middlewares/rateLimit.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import stripeRoutes from "./routes/stripe.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import filesRoutes from "./routes/files.routes.js";
import swaggerUi from "swagger-ui-express";
import { buildOpenApiSpec } from "./docs/openapi.js";
import { resolve } from "node:path";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      // Normalize the incoming Origin (strip trailing slash) before matching
      // against the allowlist, and log rejects so misconfigured origins are
      // visible in the deploy logs instead of failing silently.
      origin(origin, cb) {
        // Allow requests with no Origin header (curl, server-to-server, same-origin).
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/+$/, "");
        if (env.CORS_ORIGIN.includes(normalized)) return cb(null, true);
        console.warn(
          `CORS rejected origin "${origin}"; allowed: ${env.CORS_ORIGIN.join(", ")}`,
        );
        return cb(null, false);
      },
      credentials: true,
    }),
  );

  // Stripe webhook MUST be before express.json() so it gets the raw buffer
  app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  // Skip HTTP request logging in prod (structured logs elsewhere) and in tests
  // (keeps the vitest output readable).
  if (!isProd && env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // API documentation. Spec is built once at startup from the zod validators.
  const openApiSpec = buildOpenApiSpec();
  app.get("/docs.json", (_req, res) => {
    res.json(openApiSpec);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Global safety-net limiter; per-route limiters below are tighter.
  app.use(
    "/api",
    rateLimit({ bucket: "global", limit: env.RATE_LIMIT_PER_MINUTE }),
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/sessions", sessionsRoutes);
  app.use("/api/sessions", chatRoutes);
  app.use("/api/stripe", stripeRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/files", filesRoutes);

  // Removed static serving of uploads; files are now served from DB via /api/files/:id
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
