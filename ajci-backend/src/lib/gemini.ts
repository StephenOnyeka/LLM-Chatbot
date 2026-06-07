import { GoogleGenAI } from "@google/genai";
import { env } from "../config.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface GeminiTurn {
  role: "user" | "model";
  parts: { text: string }[];
}

export async function* streamReply(history: GeminiTurn[]): AsyncIterable<string> {
  const response = await ai.models.generateContentStream({
    model: env.GEMINI_MODEL,
    contents: history,
    // temperature:0 makes generation deterministic, which is what makes the
    // response cache sound: a cached reply equals what the model would
    // regenerate for the same prompt, rather than freezing one random sample.
    config: { temperature: 0 },
  });
  for await (const chunk of response) {
    const text = chunk.text;
    if (typeof text === "string" && text.length > 0) {
      yield text;
    }
  }
}
