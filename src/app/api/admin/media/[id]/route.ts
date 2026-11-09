import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteMedia } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  await deleteMedia(id);
  return NextResponse.json({ ok: true });
}
