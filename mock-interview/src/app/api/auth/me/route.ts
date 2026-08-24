import { getSession } from "@/lib/auth";
import { jsonOk } from "@/lib/errors";

export async function GET() {
  const user = await getSession();
  return jsonOk({ user });
}
