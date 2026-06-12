export type ChatRole = "user" | "assistant";

export interface User {
  id: string;
  email: string;
  name: string;
  isPro?: boolean;
}

// Login/register return the user plus a JWT for Authorization: Bearer auth
// (used when third-party cookies are blocked cross-site).
export interface AuthResponse extends User {
  token: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  url: string;
  name: string;
  mimeType: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  pending?: boolean;
  attachments?: Attachment[];
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends Credentials {
  name: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  password: string;
}
