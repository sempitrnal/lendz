import { ImageResponse } from "next/og";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeStr } = await params;
  const size = sizeStr === "512" ? 512 : 192;
  const fontSize = Math.round(size * 0.52);
  const radius = Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7c3aed",
          borderRadius: radius,
        }}
      >
        <span
          style={{
            fontSize,
            color: "white",
            fontWeight: 900,
            lineHeight: 1,
            marginTop: Math.round(size * 0.04),
          }}
        >
          ₱
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
