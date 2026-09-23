import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Тогтмол — Бондооктой хамт суралцъя";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "66px 76px",
          background:
            "linear-gradient(135deg, #f5f5f0 0%, #e8eee5 52%, #d8e4d3 100%)",
          color: "#272e27",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#466149",
              color: "#fff",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            ✦
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>
              тогтмол
            </div>
            <div style={{ marginTop: 5, fontSize: 16, color: "#727a70" }}>
              STUDY WORLD · PERSONAL STUDY OS
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 62,
              lineHeight: 1.08,
              fontWeight: 750,
              letterSpacing: -2.2,
              maxWidth: 850,
            }}
          >
            Бондооктой хамт
            <br />
            <span style={{ color: "#466149" }}>бага багаар суралцъя.</span>
          </div>
          <div
            style={{
              fontSize: 23,
              color: "#5e665b",
              lineHeight: 1.45,
              maxWidth: 820,
            }}
          >
            Timer · Calendar · Knowledge · Goals · Achievements · Study Room
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
          <div
            style={{
              flex: 1,
              padding: "18px 20px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(70,97,73,0.16)",
              fontSize: 18,
              color: "#566055",
            }}
          >
            Нэг өдөр. Нэг жижиг алхам. Өөрийн хэмнэлээр.
          </div>
          <div
            style={{
              width: 150,
              height: 90,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid rgba(70,97,73,0.16)",
              fontSize: 52,
            }}
            aria-hidden="true"
          >
            🤖🌱
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
