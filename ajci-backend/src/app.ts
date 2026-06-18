import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { rateLimit } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import sessionsRoutes from "./routes/sessions.js";
import stripeRoutes from "./routes/stripe.js";
import uploadRoutes from "./routes/upload.js";
import filesRoutes from "./routes/files.js";
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
  if (!isProd) app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

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
