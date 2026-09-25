import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface GeminiTurn {
  role: "user" | "model";
  parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  >;
}

export async function* streamReply(history: GeminiTurn[]): AsyncIterable<string> {
  const response = await ai.models.generateContentStream({
    model: env.GEMINI_MODEL,
    contents: history as Parameters<typeof ai.models.generateContentStream>[0]["contents"],
    // temperature:0 makes generation deterministic, which is what makes the
    // response cache sound: a cached reply equals what the model would
    // regenerate for the same prompt, rather than freezing one random sample.
    config: { temperature: 0 },
  });
  for await (const chunk of response) {
    let text: string | undefined;
    try {
      // chunk.text is a getter that can throw on safety-blocked or
      // non-text chunks (function calls, finish reasons, etc.).
      text = chunk.text;
    } catch {
      // Skip this chunk — it carries no text content.
      continue;
    }
    if (typeof text === "string" && text.length > 0) {
      yield text;
    }
  }
}
