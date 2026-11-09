import type { Metadata } from "next";
import { AdminApp } from "@/components/AdminApp";
import { getAdminAuthConfig, isAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Administration sécurisée — Matériosol",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const authenticated = await isAdmin();
  const config = await getAdminAuthConfig();
  const snapshot = authenticated ? await getAdminSnapshot() : null;
  return (
    <AdminApp
      authenticated={authenticated}
      snapshot={snapshot}
      setupRequired={config.mode === "setup"}
      blocked={config.mode === "blocked"}
    />
  );
}
