import { NextResponse } from "next/server";
import { attachAdminCookie, getAdminAuthConfig, verifyPassword } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = await getAdminAuthConfig();
  if (config.mode === "setup") {
    return NextResponse.json({ error: "Créez d’abord le mot de passe administrateur." }, { status: 409 });
  }
  if (config.mode === "blocked") {
    return NextResponse.json({ error: "Configuration Vercel incomplète : ajoutez ADMIN_PASSWORD et ADMIN_SESSION_SECRET." }, { status: 503 });
  }
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!(await verifyPassword(password))) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }
  return attachAdminCookie(NextResponse.json({ ok: true }));
}
