import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth";
import { ApiError, jsonError } from "@/lib/errors";

export async function GET() {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new ApiError(400, "Google sign-in is not configured.", "google_disabled");
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl()}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    });
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    return jsonError(err);
  }
}
