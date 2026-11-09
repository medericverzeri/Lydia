import { NextResponse } from "next/server";
import { getMedia } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new NextResponse("Identifiant invalide", { status: 400 });
  const row = await getMedia(id);
  if (!row) return new NextResponse("Fichier introuvable", { status: 404 });
  const bytes = Buffer.from(row.data, "base64");
  const filename = row.name.replace(/[^\p{L}\p{N}._ -]/gu, "_");
  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
