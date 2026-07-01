import { ImageResponse } from "next/og";

export const alt = "StockPilot AI Investment Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "radial-gradient(circle at 18% 12%, rgba(39,224,183,0.32), transparent 28%), radial-gradient(circle at 84% 18%, rgba(88,166,255,0.35), transparent 30%), linear-gradient(135deg, #050b14 0%, #081525 48%, #020610 100%)",
          color: "#f2f7ff",
          fontFamily: "Arial"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: "-0.04em" }}>StockPilot AI</div>
          <div
            style={{
              border: "1px solid rgba(39,224,183,0.45)",
              borderRadius: 999,
              padding: "12px 22px",
              fontSize: 24,
              color: "#27e0b7"
            }}
          >
            Keine Anlageberatung
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ maxWidth: 900, fontSize: 76, fontWeight: 900, lineHeight: 0.98, letterSpacing: "-0.055em" }}>
            Professionelle Investment-Analyse für Aktien, ETFs und Krypto
          </div>
          <div style={{ maxWidth: 880, fontSize: 30, lineHeight: 1.35, color: "#aab8cf" }}>
            Marktdaten, Charts, Datenqualität, Watchlists, Portfolio-Risiko und KI-Einschätzungen in einer modernen PWA.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#d7e2f3" }}>
          {["Realtime-ready", "Risk-first", "Mobile-first", "PWA"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 18,
                padding: "12px 18px",
                background: "rgba(255,255,255,0.06)"
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
