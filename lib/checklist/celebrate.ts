/**
 * The "+₱500!" celebration when a payment earns profit. A window event keeps
 * the payment code and the screen that shows it apart: `celebrate` fires it,
 * the checklist's `CelebrationHost` listens.
 */

export const CELEBRATE_EVENT = "lendz:celebrate";
export type CelebrateDetail = { amount: number; partial: boolean };

/**
 * Announces profit gained; nothing for zero or less. `partial` is for a
 * payment that only covers part of a schedule: it always fires, whatever it
 * earned, with its own sound and a "kuwang" message instead of the profit.
 */
export function celebrate(
  amount: number,
  target: EventTarget | undefined = typeof window === "undefined"
    ? undefined
    : window,
  partial = false,
): void {
  if (!target || (!(amount > 0) && !partial)) return;
  target.dispatchEvent(
    new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, {
      detail: { amount, partial },
    }),
  );
}

const SOUND_KEY = "lendz-celebration-sound";

type Store = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem">;

const browserStore = (): WriteStore | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** The cha-ching is on unless the person turned it off. */
export function celebrationSoundEnabled(
  storage: Store | undefined = browserStore(),
): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setCelebrationSound(
  on: boolean,
  storage: WriteStore | undefined = browserStore(),
): void {
  try {
    storage?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts until the page is closed, no longer.
  }
}
