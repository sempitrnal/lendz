/**
 * Classes for the content a touch gesture carries (a swiped row): where the
 * platform runs its own press gestures, no text selection or iOS callout, so a
 * swipe doesn't start a selection. A mouse can still select and copy.
 * From beui.dev, which has more helpers in this file than the swipeable list
 * uses; only this one is copied.
 */
export const TOUCH_GESTURE_CONTENT_CLASS =
  "[-webkit-touch-callout:none] pointer-coarse:select-none";
