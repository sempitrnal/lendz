export type Point = { x: number; y: number };

/** Tile centres around `(0,0)`: the first at the top, then clockwise. */
export function letterPositions(count: number, radius: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
  });
}

/** The tile whose centre is within `hitRadius` of `point`, nearest first. */
export function letterAt(
  point: Point,
  positions: Point[],
  hitRadius: number,
): number | null {
  let best: number | null = null;
  let bestDistance = hitRadius;
  positions.forEach((p, i) => {
    const distance = Math.hypot(p.x - point.x, p.y - point.y);
    if (distance <= bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * The chain of tile indexes after the finger reaches `index`: the tile it is
 * on, or one already used, changes nothing; the tile before the last one
 * removes the last (backing up); any other tile is added. A chain is tiles,
 * not letters, so two tiles holding the same letter are different tiles.
 */
export function extendChain(chain: number[], index: number): number[] {
  if (chain.length > 0 && chain[chain.length - 1] === index) return chain;
  if (chain.length >= 2 && chain[chain.length - 2] === index) {
    return chain.slice(0, -1);
  }
  if (chain.includes(index)) return chain;
  return [...chain, index];
}

/** A shuffled copy (Fisher-Yates). */
export function shuffled(
  items: string[],
  random: () => number = Math.random,
): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
