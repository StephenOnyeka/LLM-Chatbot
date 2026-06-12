export type ChatRole = "user" | "assistant";

export interface Attachment {
  url: string;      // publicly accessible URL (e.g. /api/uploads/<filename>)
  name: string;     // original filename
  mimeType: string; // e.g. "image/png", "application/pdf"
  localPath: string; // absolute disk path for Gemini inline reads
}

export interface User {
  id: string;
  email: string;
  name: string;
  isPro?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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

