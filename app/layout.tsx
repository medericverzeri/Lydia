import type { Metadata } from "next";
import type { ReactNode } from "react";
import mediaUrls from "@/data/media-urls.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lydia Charpentier — Matériosol",
  description: "Chargée de développement Matériosol : l’économie circulaire des matériaux et les partenariats du réemploi.",
  icons: { icon: mediaUrls.logoUrl },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
