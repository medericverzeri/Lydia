import { NextResponse } from "next/server";
import { getPublishedVersion } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint public très léger : permet aux pages déjà ouvertes de détecter
 * un nouvel « Enregistrer » dans l'administration et de se rafraîchir seules.
 * Aucune donnée privée n'est exposée.
 */
export async function GET() {
  try {
    const version = await getPublishedVersion();
    return NextResponse.json(
      { version },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ version: "initial" }, { status: 200 });
  }
}
