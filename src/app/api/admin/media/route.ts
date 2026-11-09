import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createMedia } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED: Record<string, "image" | "pdf"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "application/pdf": "pdf",
};

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
    const extension = file.name.toLowerCase().split(".").pop() ?? "";
    const inferred = extension === "pdf" ? "application/pdf" : `image/${extension === "jpg" ? "jpeg" : extension}`;
    const mime = ALLOWED[file.type] ? file.type : inferred;
    const kind = ALLOWED[mime];
    if (!kind) return NextResponse.json({ error: "Format accepté : JPG, PNG, WebP, GIF, AVIF ou PDF." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Fichier limité à 15 Mo." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const head = buffer.subarray(0, 12).toString("latin1");
    if (kind === "pdf" && !head.startsWith("%PDF-")) {
      return NextResponse.json({ error: "Le fichier PDF est invalide." }, { status: 400 });
    }
    if (kind === "image" && !/^(\x89PNG|\xff\xd8\xff|RIFF|GIF8|.{4}ftyp)/.test(head)) {
      return NextResponse.json({ error: "Le fichier image est invalide." }, { status: 400 });
    }

    const media = await createMedia({
      name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180) || "fichier",
      mime,
      kind,
      size: buffer.byteLength,
      buffer,
    });
    return NextResponse.json({ ok: true, media });
  } catch {
    return NextResponse.json({ error: "Le téléversement a échoué." }, { status: 500 });
  }
}
