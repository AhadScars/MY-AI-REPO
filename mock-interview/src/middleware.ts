import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/constants";

const PROTECTED = ["/dashboard", "/interview", "/history", "/analytics", "/profile"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

function secret() {
  const value = process.env.AUTH_SECRET;
  return value ? new TextEncoder().encode(value) : null;
}

async function hasSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const key = secret();
  if (!token || !key) return false;
  try {
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await hasSession(request);

  if (PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    if (!loggedIn) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (loggedIn && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/interview/:path*", "/history/:path*", "/analytics/:path*", "/profile/:path*", "/login", "/signup", "/forgot-password", "/reset-password"],
};
