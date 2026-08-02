import { z } from "zod";

export const CreateSessionBody = z.object({ 
  title: z.string().trim().min(1).max(120).optional() 
});
