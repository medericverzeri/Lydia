import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "../db";
import { adminSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { ensureDatabase } from "./data";

export const ADMIN_COOKIE = "materiosol_admin_session";
const SESSION_DAYS = 7;

export type AdminAuthMode = "env" | "database" | "setup" | "blocked";

export type AdminAuthConfig = {
  mode: AdminAuthMode;
  passwordConfigured: boolean;
  sessionConfigured: boolean;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

function hashPassword(password: string): string {
  return createHash("sha256").update(`materiosol-admin:${password}`).digest("hex");
}

/**
 * Sur Vercel, les deux variables d'environnement sont obligatoires.
 * En aperçu local, si elles sont absentes, l'administrateur crée son mot de
 * passe une seule fois : le hash et la clé de session sont stockés en base.
 */
export async function getAdminAuthConfig(): Promise<AdminAuthConfig> {
  const envPassword = process.env.ADMIN_PASSWORD ?? "";
  const envSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (envPassword.length >= 8 && envSecret.length >= 24) {
    return { mode: "env", passwordConfigured: true, sessionConfigured: true };
  }

  await ensureDatabase();
  const rows = await db.select({ id: adminSettings.id }).from(adminSettings).where(eq(adminSettings.id, 1)).limit(1);
  if (rows.length) {
    return { mode: "database", passwordConfigured: true, sessionConfigured: true };
  }
  if (process.env.VERCEL) {
    return { mode: "blocked", passwordConfigured: false, sessionConfigured: false };
  }
  return { mode: "setup", passwordConfigured: false, sessionConfigured: false };
}

async function sessionSecret(): Promise<string> {
  const envSecret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (envSecret.length >= 24) return envSecret;
  await ensureDatabase();
  const rows = await db
    .select({ secret: adminSettings.sessionSecret })
    .from(adminSettings)
    .where(eq(adminSettings.id, 1))
    .limit(1);
  if (rows[0]?.secret) return rows[0].secret;
  throw new Error("Clé de session absente.");
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  const config = await getAdminAuthConfig();
  if (config.mode === "env") {
    return safeEqual(candidate, process.env.ADMIN_PASSWORD ?? "");
  }
  if (config.mode === "database") {
    await ensureDatabase();
    const rows = await db
      .select({ hash: adminSettings.passwordHash })
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);
    return rows[0] ? safeEqual(hashPassword(candidate), rows[0].hash) : false;
  }
  return false;
}

export async function setupAdminPassword(password: string): Promise<boolean> {
  const config = await getAdminAuthConfig();
  if (config.mode !== "setup") return false;
  if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  await ensureDatabase();
  const secret = randomBytes(32).toString("hex");
  await db.insert(adminSettings).values({
    id: 1,
    passwordHash: hashPassword(password),
    sessionSecret: secret,
  }).onConflictDoNothing();
  return true;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function makeToken(secret: string): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${signature(payload, secret)}`;
}

export async function isAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(ADMIN_COOKIE)?.value;
    if (!token) return false;
    const [payload, provided] = token.split(".");
    if (!payload || !provided) return false;
    const expected = signature(payload, await sessionSecret());
    if (!safeEqual(provided, expected)) return false;
    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}

export async function attachAdminCookie(response: NextResponse): Promise<NextResponse> {
  const token = makeToken(await sessionSecret());
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}

export function clearAdminCookie(response: NextResponse): NextResponse {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
