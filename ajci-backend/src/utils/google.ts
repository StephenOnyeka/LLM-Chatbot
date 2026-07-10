import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  email: string;
  name: string;
}

// Verify a Google ID token (the credential the frontend GIS button returns) and
// extract the user's email + name. Throws if the token is invalid, unverified,
// or not issued for our client ID.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error("Google account email missing or unverified");
  }
  return {
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0]!,
  };
}
