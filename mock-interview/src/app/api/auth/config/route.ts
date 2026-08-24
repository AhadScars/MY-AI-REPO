import { jsonOk } from "@/lib/errors";
import { isGrokConfigured } from "@/lib/grok";

export async function GET() {
  return jsonOk({
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    aiConfigured: isGrokConfigured(),
  });
}
