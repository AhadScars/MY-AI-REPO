import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { ApiError, jsonError, jsonOk } from "@/lib/errors";
import { resetSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = resetSchema.parse(await request.json());
    const hashed = createHash("sha256").update(body.token).digest("hex");
    const user = await prisma.user.findFirst({
      where: { resetToken: hashed, resetExpires: { gt: new Date() } },
    });
    if (!user) throw new ApiError(400, "This reset link is invalid or has expired.", "invalid_token");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.password),
        resetToken: null,
        resetExpires: null,
      },
    });
    await setSessionCookie({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
