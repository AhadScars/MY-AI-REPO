import { prisma } from "@/lib/db";
import { publicUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(clientKey(request, "login"), 12, 10 * 60_000);
    if (!limited.ok) throw new ApiError(429, "Too many login attempts. Try again shortly.", "rate_limited");

    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      throw new ApiError(401, "Incorrect email or password.", "invalid_credentials");
    }
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Incorrect email or password.", "invalid_credentials");

    await setSessionCookie({ id: user.id, name: user.name, email: user.email, image: user.image });
    return jsonOk({ user: publicUser(user) });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return jsonError(new ApiError(400, "Please check the form and try again.", "invalid"));
    }
    return jsonError(err);
  }
}
