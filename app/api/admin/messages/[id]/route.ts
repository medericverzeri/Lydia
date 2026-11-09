import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteMessage, setMessageRead } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const body = (await request.json()) as { isRead?: boolean };
  await setMessageRead(Number(id), Boolean(body.isRead));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  await deleteMessage(Number(id));
  return NextResponse.json({ ok: true });
}
