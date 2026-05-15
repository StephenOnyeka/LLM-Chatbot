import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import sessionsRoutes from "./routes/sessions.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan("dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/sessions", sessionsRoutes);
  app.use("/api/sessions", chatRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
