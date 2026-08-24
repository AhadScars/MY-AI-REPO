import OpenAI from "openai";
import { ZodType } from "zod";
import { ApiError } from "./errors";

const MODEL = process.env.XAI_MODEL || "grok-4.6";

function getClient() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "The AI interviewer is not configured. Set XAI_API_KEY in your environment.",
      "ai_unconfigured",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
    timeout: 90_000,
    maxRetries: 1,
  });
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function grokJson<T>(opts: {
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  const client = getClient();
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: opts.temperature ?? 0.4,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.schemaName,
          schema: opts.jsonSchema,
          strict: true,
        },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new ApiError(502, "The AI interviewer returned an empty response.", "ai_empty");
    }
    const parsed = extractJson(content);
    const validated = opts.zodSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[grok] schema validation failed", validated.error.flatten());
      throw new ApiError(502, "The AI interviewer returned an invalid response. Please retry.", "ai_invalid");
    }
    return validated.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : "Unknown AI error";
    const timedOut = /timeout|timed out|ETIMEDOUT|AbortError/i.test(message);
    console.error("[grok]", message);
    throw new ApiError(
      502,
      timedOut
        ? "We temporarily lost connection to the AI interviewer. Your interview progress has been saved. Please retry."
        : "We temporarily lost connection to the AI interviewer. Your interview progress has been saved. Please retry.",
      timedOut ? "ai_timeout" : "ai_failure",
    );
  }
}

export function isGrokConfigured() {
  return Boolean(process.env.XAI_API_KEY);
}
