import { prisma } from "@/lib/db";
import { publicUser, requireUser, setSessionCookie } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/errors";
import { profileSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const session = await requireUser();
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    return jsonOk({ user: user ? publicUser(user) : session, googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireUser();
    const body = profileSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { name: body.name },
    });
    await setSessionCookie({ id: user.id, name: user.name, email: user.email, image: user.image });
    return jsonOk({ user: publicUser(user) });
  } catch (err) {
    return jsonError(err);
  }
}
