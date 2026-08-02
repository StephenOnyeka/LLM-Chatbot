import jwt from "jsonwebtoken";
import type { User } from "../src/types/index.js";

// Sign a token the same way src/utils/jwt.ts does, using the test JWT_SECRET
// set in setup.env.ts. Lets tests hit requireAuth-protected routes with a real,
// verifiable Bearer token (auth.middleware verifies the signature, then loads
// the user via findUserById — which tests mock to return `testUser`).
export function signTestToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
}

export const testUser: User = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  isPro: false,
};

export const testProUser: User = {
  id: "user-pro-456",
  email: "pro@example.com",
  name: "Pro User",
  isPro: true,
};

// Authorization header value for a given user id (defaults to testUser).
export function authHeader(userId: string = testUser.id): string {
  return `Bearer ${signTestToken(userId)}`;
}
