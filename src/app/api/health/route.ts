import { getDeployCheck } from "../../../lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const check = await getDeployCheck();
    return Response.json(
      { ok: true, ...check },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
