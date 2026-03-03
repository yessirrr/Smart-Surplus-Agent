import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function isApiKeyValid(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key !== "your-key-here" && key.startsWith("sk-");
}
