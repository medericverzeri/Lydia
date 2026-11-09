import { NextResponse } from "next/server";
import { createMessage } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });
    const name = clean(body.name, 120);
    const email = clean(body.email, 180);
    const message = clean(body.message, 5000);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) {
      return NextResponse.json({ error: "Veuillez compléter les champs obligatoires." }, { status: 400 });
    }
    await createMessage({
      name,
      email,
      phone: clean(body.phone, 60),
      organization: clean(body.organization, 160),
      topic: clean(body.topic, 200),
      message,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Le message n’a pas pu être transmis. Veuillez réessayer." }, { status: 500 });
  }
}
