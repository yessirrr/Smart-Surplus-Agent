import OpenAI from "openai";

function getProviderKey(): string | null {
  const key = process.env.MODEL_PROVIDER_KEY;
  if (!key || key === "your-provider-key-here") {
    return null;
  }

  return key;
}

export function isProviderKeyConfigured(): boolean {
  const key = getProviderKey();
  return typeof key === "string" && key.startsWith("sk-");
}

export function getModelClient(): OpenAI {
  const key = getProviderKey();
  if (!key) {
    throw new Error("Model provider key is not configured.");
  }

  return new OpenAI({ apiKey: key });
}
