import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  RegisterBody,
  LoginBody,
  GoogleBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../validators/auth.validator.js";
import { CreateSessionBody } from "../validators/sessions.validator.js";
import { ChatBody, AttachmentSchema } from "../validators/chat.validator.js";

// Teaches zod about the `.openapi()` metadata helper. Must run before any
// schema is registered.
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Cookie/Bearer auth: requireAuth accepts either an Authorization: Bearer
// header or the ajci_token cookie. Register both so "Authorize" in the UI works.
const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});
const cookieAuth = registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "ajci_token",
});

const secured = [{ [bearerAuth.name]: [] }, { [cookieAuth.name]: [] }];

// ---------------------------------------------------------------------------
// Response schemas (mirror src/types and controller JSON shapes)
// ---------------------------------------------------------------------------

const UserSchema = registry.register(
  "User",
  z
    .object({
      id: z.string().openapi({ example: "b1c2d3e4-…" }),
      email: z.string().email().openapi({ example: "user@example.com" }),
      name: z.string().openapi({ example: "Ada Lovelace" }),
      isPro: z.boolean().optional(),
      stripeCustomerId: z.string().optional(),
      stripeSubscriptionId: z.string().optional(),
      proExpiresAt: z.string().optional().openapi({
        description: "ISO timestamp of the current billing period end",
      }),
    })
    .openapi("User"),
);

// register/login/google/reset-password all return the user plus a JWT.
const AuthResponse = registry.register(
  "AuthResponse",
  UserSchema.extend({
    token: z.string().openapi({ description: "JWT bearer token" }),
  }).openapi("AuthResponse"),
);

const SessionSchema = registry.register(
  "Session",
  z
    .object({
      id: z.string(),
      title: z.string().openapi({ example: "New chat" }),
      createdAt: z.string().openapi({ example: "2026-07-21T10:00:00.000Z" }),
      updatedAt: z.string().openapi({ example: "2026-07-21T10:05:00.000Z" }),
    })
    .openapi("Session"),
);

const AttachmentResponse = registry.register(
  "Attachment",
  AttachmentSchema.openapi("Attachment"),
);

const MessageSchema = registry.register(
  "Message",
  z
    .object({
      id: z.string(),
      sessionId: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string(),
      attachments: z.array(AttachmentResponse).optional(),
    })
    .openapi("Message"),
);

const UploadResponse = registry.register(
  "UploadResponse",
  z
    .object({
      id: z.string(),
      url: z.string().openapi({ example: "http://localhost:4000/api/files/…" }),
      name: z.string(),
      mimeType: z.string(),
      createdAt: z.string(),
    })
    .openapi("UploadResponse"),
);

const ErrorResponse = registry.register(
  "Error",
  z
    .object({
      message: z.string().openapi({ example: "Not authenticated" }),
      issues: z.array(z.any()).optional().openapi({
        description: "Present on 400 validation errors (zod issues)",
      }),
    })
    .openapi("Error"),
);

// Reusable JSON helpers ------------------------------------------------------

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
});

const errorRef = { $ref: "#/components/schemas/Error" };
const unauthorized = {
  401: { description: "Not authenticated", content: { "application/json": { schema: ErrorResponse } } },
};
const badRequest = {
  400: { description: "Invalid request body", content: { "application/json": { schema: ErrorResponse } } },
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// Health --------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Liveness probe",
  responses: {
    200: { description: "OK", ...json(z.object({ ok: z.boolean() })) },
  },
});

// Auth ----------------------------------------------------------------------
registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Register a new account",
  request: { body: json(RegisterBody) },
  responses: {
    201: { description: "Account created", ...json(AuthResponse) },
    ...badRequest,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Log in with email and password",
  request: { body: json(LoginBody) },
  responses: {
    200: { description: "Logged in", ...json(AuthResponse) },
    ...badRequest,
    ...unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/google",
  tags: ["Auth"],
  summary: "Sign in with a Google ID token",
  request: { body: json(GoogleBody) },
  responses: {
    200: { description: "Signed in", ...json(AuthResponse) },
    ...badRequest,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/forgot-password",
  tags: ["Auth"],
  summary: "Send a password-reset code by email",
  request: { body: json(ForgotPasswordBody) },
  responses: {
    200: { description: "Reset code sent (always ok, to avoid user enumeration)", ...json(z.object({ ok: z.boolean() })) },
    ...badRequest,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/reset-password",
  tags: ["Auth"],
  summary: "Reset the password with an emailed code",
  request: { body: json(ResetPasswordBody) },
  responses: {
    200: { description: "Password reset and logged in", ...json(AuthResponse) },
    ...badRequest,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Clear the auth cookie",
  responses: { 204: { description: "Logged out" } },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  tags: ["Auth"],
  summary: "Get the current authenticated user",
  security: secured,
  responses: {
    200: { description: "Current user", ...json(UserSchema) },
    ...unauthorized,
  },
});

// Sessions ------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/api/sessions",
  tags: ["Sessions"],
  summary: "List the user's chat sessions",
  security: secured,
  responses: {
    200: { description: "Sessions", ...json(z.array(SessionSchema)) },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/sessions",
  tags: ["Sessions"],
  summary: "Create a new chat session",
  security: secured,
  request: { body: json(CreateSessionBody) },
  responses: {
    201: { description: "Session created", ...json(SessionSchema) },
    ...badRequest,
    ...unauthorized,
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/sessions/{id}",
  tags: ["Sessions"],
  summary: "Delete a chat session",
  security: secured,
  request: { params: z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) }) },
  responses: {
    204: { description: "Session deleted" },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/sessions/{id}/messages",
  tags: ["Sessions"],
  summary: "List the messages in a session",
  security: secured,
  request: { params: z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) }) },
  responses: {
    200: { description: "Messages", ...json(z.array(MessageSchema)) },
    ...unauthorized,
  },
});

// Chat ----------------------------------------------------------------------
registry.registerPath({
  method: "post",
  path: "/api/sessions/{id}/chat",
  tags: ["Chat"],
  summary: "Stream an assistant reply (Server-Sent Events)",
  description:
    "Returns a `text/event-stream`. Each `data:` frame is `{ \"token\": \"…\" }`; " +
    "the stream ends with a `[DONE]` sentinel. On failure an `event: error` frame is sent.",
  security: secured,
  request: { params: z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) }), body: json(ChatBody) },
  responses: {
    200: {
      description: "SSE token stream",
      content: { "text/event-stream": { schema: z.string() } },
    },
    ...badRequest,
    ...unauthorized,
  },
});

// Upload / Files ------------------------------------------------------------
registry.registerPath({
  method: "post",
  path: "/api/upload",
  tags: ["Files"],
  summary: "Upload a file (Pro plan only)",
  security: secured,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.string().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: {
    201: { description: "File stored", ...json(UploadResponse) },
    400: { description: "No file uploaded", content: { "application/json": { schema: ErrorResponse } } },
    403: { description: "Pro plan required", content: { "application/json": { schema: ErrorResponse } } },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/files/{id}",
  tags: ["Files"],
  summary: "Download a stored file's bytes",
  request: { params: z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) }) },
  responses: {
    200: {
      description: "File bytes",
      content: { "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) } },
    },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponse } } },
  },
});

// Stripe --------------------------------------------------------------------
registry.registerPath({
  method: "post",
  path: "/api/stripe/create-checkout-session",
  tags: ["Stripe"],
  summary: "Create a Stripe checkout session for the Pro plan",
  security: secured,
  responses: {
    200: { description: "Checkout URL", ...json(z.object({ url: z.string() })) },
    400: { description: "Already a Pro member", content: { "application/json": { schema: ErrorResponse } } },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: "/api/stripe/verify-session",
  tags: ["Stripe"],
  summary: "Verify a completed checkout session and upgrade the user",
  security: secured,
  request: { query: z.object({ session_id: z.string().openapi({ param: { name: "session_id", in: "query" } }) }) },
  responses: {
    200: { description: "Verification result", ...json(z.object({}).passthrough()) },
    ...badRequest,
    ...unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stripe/cancel-subscription",
  tags: ["Stripe"],
  summary: "Cancel the user's Pro subscription",
  security: secured,
  responses: {
    200: { description: "Cancellation result", ...json(z.object({}).passthrough()) },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stripe/webhook",
  tags: ["Stripe"],
  summary: "Stripe webhook receiver (raw body, signature-verified)",
  description: "Called by Stripe, not by clients. Expects the raw request body and a `stripe-signature` header.",
  responses: {
    200: { description: "Acknowledged", ...json(z.object({ received: z.boolean() })) },
    400: { description: "Invalid signature", content: { "application/json": { schema: ErrorResponse } } },
  },
});

/** Builds the OpenAPI 3.0 document from the registry. */
export function buildOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "AJCI Chatbot API",
      version: "0.1.0",
      description:
        "REST + SSE API for the AJCI chatbot backend. Authenticate via the " +
        "`Authorize` button using a JWT bearer token returned by /api/auth/login.",
    },
    servers: [{ url: env.PUBLIC_URL, description: "Configured PUBLIC_URL" }],
  });
}
