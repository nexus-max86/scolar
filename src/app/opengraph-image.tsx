import { ImageResponse } from "next/og";

export const alt = "Scolar : gestion des frais scolaires pour les écoles en RDC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image d'aperçu quand un lien Scolar est partagé sur WhatsApp. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f6f8fb", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg viewBox="0 0 64 64" width="88" height="88">
            <rect width="64" height="64" rx="15" fill="#1f5296" />
            <path d="M40 17H27a7.5 7.5 0 0 0 0 15h10a7.5 7.5 0 0 1 0 15H20" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="46.5" cy="17" r="3.4" fill="#44c27a" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#111827", letterSpacing: -2 }}>scolar</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: "#111827", lineHeight: 1.1, letterSpacing: -2 }}>Les frais scolaires, sans cahier.</div>
          <div style={{ fontSize: 32, color: "#4b5563", lineHeight: 1.4 }}>Paiements en dollars ou en francs, reçus numérotés, impayés, espace parent et bulletins.</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#1f5296", fontWeight: 600 }}>Pour les écoles privées en RDC</div>
      </div>
    ),
    size,
  );
}
