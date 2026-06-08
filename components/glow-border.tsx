"use client";

export function GlowBorder({ duration = 4 }: { duration?: number }) {
  return (
    <>
      <span
        aria-hidden
        className="animate-glow-pulse pointer-events-none absolute inset-[-3px] rounded-[14px]"
        style={{
          boxShadow:
            "0 0 14px 3px rgba(56,189,248,0.7), 0 0 40px 14px rgba(14,165,233,0.18)",
        }}
      />
      <span
        aria-hidden
        className="animate-glow-spin pointer-events-none absolute inset-[-3px] rounded-[14px]"
        style={{
          backgroundImage:
            "conic-gradient(from var(--glow-angle), transparent 0%, #bae6fd00 5%, #bae6fd 12%, #ffffff 22%, #bae6fd 32%, #bae6fd00 40%, transparent 44%)",
          WebkitMask:
            "linear-gradient(black, black) content-box, linear-gradient(black, black)",
          WebkitMaskComposite: "destination-out",
          maskComposite: "exclude",
          padding: "3px",
          animationDuration: `${duration}s`,
        }}
      />
    </>
  );
}
