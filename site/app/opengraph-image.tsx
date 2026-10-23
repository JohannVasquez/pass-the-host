import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Pass the host: el servidor de Minecraft ya no depende de una sola persona";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), "app/icon.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background:
          "radial-gradient(ellipse at top right, rgba(139,203,107,0.25), transparent 60%), #0F1115",
        color: "#EAEAEA",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <img src={iconSrc} width={96} height={96} style={{ borderRadius: 48 }} alt="" />
        <div style={{ fontSize: 44 }}>Pass the host</div>
      </div>
      <div style={{ marginTop: 48, fontSize: 68, lineHeight: 1.15 }}>
        El servidor de Minecraft ya no depende de una sola persona.
      </div>
      <div style={{ marginTop: 32, fontSize: 30, color: "#A3D98A" }}>
        Gratis · Windows · macOS · Linux
      </div>
    </div>,
    size,
  );
}
