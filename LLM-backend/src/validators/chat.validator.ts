import { z } from "zod";

export const AttachmentSchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
});

export const ChatBody = z.object({
  content: z.string().trim().max(8000).default(""),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});
