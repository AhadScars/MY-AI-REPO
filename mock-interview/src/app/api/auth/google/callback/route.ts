import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl, setSessionCookie } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const origin = appUrl();

  if (err || !code) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new ApiError(400, "Google token exchange failed.");
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new ApiError(400, "Google token missing.");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new ApiError(400, "Could not load Google profile.");
    const profile = (await profileRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.email || !profile.id) throw new ApiError(400, "Google profile is incomplete.");

    const email = profile.email.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.id }, { email }] },
    });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: profile.id,
            image: profile.picture ?? existing.image,
            name: existing.name || profile.name || email.split("@")[0],
          },
        })
      : await prisma.user.create({
          data: {
            email,
            name: profile.name || email.split("@")[0],
            googleId: profile.id,
            image: profile.picture ?? null,
          },
        });

    await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    });
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (error) {
    console.error("[google-oauth]", error);
    return NextResponse.redirect(`${origin}/login?error=google`);
  }
}
