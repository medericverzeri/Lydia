import { NextResponse } from "next/server";
import { attachAdminCookie, getAdminAuthConfig, setupAdminPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAdminAuthConfig();
  return NextResponse.json(
    { setupRequired: config.mode === "setup", blocked: config.mode === "blocked" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    const created = await setupAdminPassword(password);
    if (!created) {
      return NextResponse.json({ error: "Le mot de passe administrateur est déjà configuré." }, { status: 409 });
    }
    return attachAdminCookie(NextResponse.json({ ok: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuration impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
