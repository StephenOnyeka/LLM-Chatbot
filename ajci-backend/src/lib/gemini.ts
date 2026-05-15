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
  });
  for await (const chunk of response) {
    const text = chunk.text;
    if (typeof text === "string" && text.length > 0) {
      yield text;
    }
  }
}
