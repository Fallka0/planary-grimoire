import type { MouseEvent, PointerEvent } from "react";

/**
 * Act on the way down.
 *
 * `click` is the wrong event for anything that should feel like a key being
 * pressed. A browser fires it only once the pointer has been *released*: on a
 * touch screen that means after the finger has left the glass, and on a mouse
 * it means after however long the button was held. So a card bound to `click`
 * starts moving after the gesture that chose it has already finished, which is
 * what "laggy" turns out to mean here — not slow code, just a late event.
 *
 * `pointerdown` fires the moment contact is made, so the card is already
 * lifting under the finger. `click` is then left to the keyboard, which still
 * arrives as one, with `detail === 0` to say that no pointer was involved.
 *
 * This is for *choosing* things, which is a press. It is deliberately not used
 * for buttons that commit — Play hand, Discard, Take the ink — because being
 * able to put a finger down, think, and slide off to cancel is worth more than
 * the few milliseconds.
 */
export function press(run: () => void) {
  return {
    onPointerDown: (event: PointerEvent) => {
      // Left button, or any touch/pen contact, which also reports button 0.
      if (event.button === 0) run();
    },
    onClick: (event: MouseEvent) => {
      if (event.detail === 0) run();
    },
  };
}
