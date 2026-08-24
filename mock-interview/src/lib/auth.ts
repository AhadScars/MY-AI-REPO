import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { SESSION_COOKIE, SESSION_DAYS } from "./constants";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new ApiError(500, "Server is missing AUTH_SECRET. Copy .env.example to .env and set it.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .setSubject(user.id)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.id || !payload.email || !payload.name) return null;
    return {
      id: String(payload.id),
      name: String(payload.name),
      email: String(payload.email),
      image: payload.image ? String(payload.image) : null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, image: true },
  });
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Please sign in to continue.", "unauthorized");
  return user;
}

export function publicUser(user: { id: string; name: string; email: string; image: string | null; createdAt?: Date }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    createdAt: user.createdAt,
  };
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
