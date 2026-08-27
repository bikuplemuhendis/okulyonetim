import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { SESSION_COOKIE, type Actor } from "./types";
import { homePath } from "./rbac";

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || "kampus-dev-secret-change-me");

export type JwtPayload = {
  sub: string;
  role: Actor["role"];
  tenantId: string | null;
  name: string;
};

export async function signSession(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || !payload.role) return null;
    return {
      sub: String(payload.sub),
      role: payload.role as Actor["role"],
      tenantId: (payload.tenantId as string) || null,
      name: String(payload.name || ""),
    };
  } catch {
    return null;
  }
}

export async function loginWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { scopes: true, student: true },
  });
  if (!user || user.status !== "ACTIVE") return { error: "E-posta veya parola hatalı." };
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "E-posta veya parola hatalı." };
  const token = await signSession({
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    name: user.name,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true as const, path: homePath(user.role) };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getActor(): Promise<Actor | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { scopes: true, student: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    branchIds: user.scopes.map((s) => s.branchId),
    studentId: user.student?.id ?? null,
  };
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for") || h.get("x-real-ip") || "local",
    userAgent: h.get("user-agent") || "unknown",
  };
}
