import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getAdminSnapshot, saveContent, validateContent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const snapshot = await getAdminSnapshot();
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const body = (await request.json()) as { content?: unknown; publish?: boolean };
    const content = validateContent(body.content);
    content.updatedAt = new Date().toISOString();
    await saveContent(content, body.publish !== false);
    return NextResponse.json({ ok: true, publishedAt: new Date().toISOString(), content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enregistrement impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
