import { SiteApp } from "@/components/SiteApp";
import { getPublishedContent } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const content = await getPublishedContent();
  return <SiteApp content={content} />;
}
