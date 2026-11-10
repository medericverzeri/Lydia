import { NextResponse } from "next/server";
import { getAdminAuthConfig, isAdmin, type AdminAuthConfig } from "../../../../lib/auth";
import { db } from "../../../../db";
import { sql } from "drizzle-orm";
import { getMediaStats, getPublishedVersion } from "../../../../lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let database: "ok" | "error" = "error";
  let version = "initial";
  let media = { embeddedAvailable: 0, embeddedTotal: 56, uploaded: 0 };
  let authConfig: AdminAuthConfig = { passwordConfigured: false, sessionConfigured: false, mode: "blocked" };
  try {
    await db.execute(sql`select 1`);
    database = "ok";
    version = await getPublishedVersion();
    media = await getMediaStats();
    authConfig = await getAdminAuthConfig();
  } catch {
    database = "error";
  }

  return NextResponse.json({
    database,
    publishedVersion: version,
    liveSync: true,
    hosting: process.env.VERCEL ? "Vercel" : "Local / autre hébergement",
    environment: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
      ADMIN_SESSION_SECRET: Boolean(process.env.ADMIN_SESSION_SECRET),
    },
    storage: "PostgreSQL (contenu, photos, PDF et messages)",
    media,
    authMode: authConfig.mode,
    publicFolderRequired: false,
    checks: [
      { label: "Base de données connectée", ok: database === "ok" },
      { label: "DATABASE_URL configurée", ok: Boolean(process.env.DATABASE_URL) },
      { label: "Mot de passe admin configuré", ok: authConfig.passwordConfigured },
      { label: "Clé de session configurée", ok: authConfig.sessionConfigured },
      { label: `Médias intégrés restaurés (${media.embeddedAvailable}/${media.embeddedTotal})`, ok: media.embeddedAvailable === media.embeddedTotal },
      { label: "Enregistrement en direct actif", ok: true },
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
