/** A category's hex colour at a given opacity; undefined when it isn't one. */
export const tint = (color: string | null, alpha: number) =>
  color && /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`
    : undefined;
