import { prisma } from "@/lib/db";
import { hashPassword, publicUser, setSessionCookie } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(clientKey(request, "signup"), 8, 15 * 60_000);
    if (!limited.ok) throw new ApiError(429, "Too many signup attempts. Try again later.", "rate_limited");

    const body = signupSchema.parse(await request.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new ApiError(409, "An account with this email already exists.", "exists");

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
      },
    });
    await setSessionCookie({ id: user.id, name: user.name, email: user.email, image: user.image });
    return jsonOk({ user: publicUser(user) }, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return jsonError(new ApiError(400, "Please check the form and try again.", "invalid"));
    }
    return jsonError(err);
  }
}
