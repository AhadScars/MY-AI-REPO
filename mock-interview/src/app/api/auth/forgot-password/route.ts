import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { forgotSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(clientKey(request, "forgot"), 6, 15 * 60_000);
    if (!limited.ok) throw new ApiError(429, "Too many reset requests. Try again later.", "rate_limited");

    const body = forgotSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    const generic = {
      message: "If an account exists for that email, a reset link is ready.",
      resetUrl: null as string | null,
    };

    if (!user || !user.passwordHash) return jsonOk(generic);

    const token = randomBytes(32).toString("hex");
    const hashed = createHash("sha256").update(token).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashed, resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetUrl = `${appUrl()}/reset-password?token=${token}`;
    console.info("[auth] password reset link", resetUrl);

    return jsonOk({
      message: generic.message,
      // Shown only so local/dev setups work without email. Do not rely on this in production mail flows.
      resetUrl: process.env.NODE_ENV === "production" ? null : resetUrl,
    });
  } catch (err) {
    return jsonError(err);
  }
}
