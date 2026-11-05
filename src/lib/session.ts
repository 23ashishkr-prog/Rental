import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ConfigError } from "./errors";

const COOKIE = "rent_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new ConfigError(
      "AUTH_SECRET is missing or shorter than 16 characters. Set a long random value in .env.local and in Vercel.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: number): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSession(): Promise<{ uid: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const uid = Number(payload.uid ?? payload.sub);
    if (!Number.isInteger(uid) || uid <= 0) return null;
    return { uid };
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    return null;
  }
}
