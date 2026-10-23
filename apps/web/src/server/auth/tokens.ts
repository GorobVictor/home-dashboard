import { jwtVerify, SignJWT, errors } from "jose";

export const sessionCookieName = "home_dashboard_session";
export const sessionLifetimeSeconds = 8 * 60 * 60;
const issuer = "home-dashboard";
const audience = "home-dashboard-web";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signingKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${sessionLifetimeSeconds}s`)
    .sign(signingKey());
}

export async function readSessionToken(token: string): Promise<string | null> {
  return (await readSession(token))?.userId ?? null;
}

export async function readSession(token: string): Promise<{ userId: string; expiresAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    return payload.sub && uuidPattern.test(payload.sub) && typeof payload.exp === "number" ? { userId: payload.sub, expiresAt: payload.exp * 1000 } : null;
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      return null;
    }
    throw error;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: sessionLifetimeSeconds,
  };
}
