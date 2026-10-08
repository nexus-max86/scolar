import type { Metadata, Viewport } from "next";
import { OfflineBanner } from "@/components/offline-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Scolar", template: "%s · Scolar" },
  description: "Gestion simple des élèves, des frais scolaires et des paiements pour les écoles privées en RDC.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
