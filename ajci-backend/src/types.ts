export type ChatRole = "user" | "assistant";

export interface Attachment {
  id: string;       // files table row id; used to fetch bytes for Gemini
  url: string;      // publicly accessible URL (/api/files/<id>)
  name: string;     // original filename
  mimeType: string; // e.g. "image/png", "application/pdf"
}

export interface User {
  id: string;
  email: string;
  name: string;
  isPro?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  proExpiresAt?: string; // ISO timestamp of current billing period end
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

