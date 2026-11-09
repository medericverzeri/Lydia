import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteApp } from "@/components/SiteApp";
import { getPublishedContent } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Page privée — Matériosol",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = await getPublishedContent();
  const hiddenPage = content.hiddenPages.find((page) => page.slug === slug);
  const hiddenSection = content.site.navigation.find((item) => item.slug === slug && item.hidden);
  if (!hiddenPage && !hiddenSection) notFound();
  return (
    <SiteApp
      content={content}
      privateMode
      hiddenPage={hiddenPage}
      sectionOnly={hiddenSection?.id}
    />
  );
}
