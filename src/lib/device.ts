"use client";

import { useEffect, useState } from "react";

/**
 * What the thing in the player's hands can do.
 *
 * Three questions, and the answers decide quite a lot about the screen:
 * whether there is a mouse (hover tooltips are useless without one), whether
 * the viewport is too short to lay a card table out in (a phone on its side is
 * *wide* and short, which is the case every width-based breakpoint gets wrong),
 * and whether it is being held upright.
 */

export interface Device {
  /** No mouse: hover cannot be relied on for anything a player needs. */
  touch: boolean;
  /** Short enough that the layout has to be packed rather than laid out. */
  short: boolean;
  /** Held upright, on something small enough that it matters. */
  upright: boolean;
}

/** Under this, a card table has to be rebuilt rather than merely scaled. */
export const SHORT_PX = 560;

function read(): Device {
  if (typeof window === "undefined") return { touch: false, short: false, upright: false };
  const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const short = window.innerHeight <= SHORT_PX;
  const portrait = window.innerHeight > window.innerWidth;
  // Only a small upright screen is a problem; a portrait desktop window is not.
  return { touch, short, upright: portrait && touch && Math.min(window.innerWidth, window.innerHeight) <= 560 };
}

export function useDevice(): Device {
  // Starts at the desktop answer and corrects on mount, because the server has
  // no window and a guess rendered into the HTML would flash the wrong screen.
  const [device, setDevice] = useState<Device>({ touch: false, short: false, upright: false });

  useEffect(() => {
    const update = () => setDevice(read());
    update();
    // Three signals, because no one of them is reliable everywhere: resize
    // misses some orientation changes, orientationchange is deprecated and
    // absent on desktop, and the media query is the only one that is exact
    // about which way up the thing is.
    const turned = window.matchMedia("(orientation: portrait)");
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    turned.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      turned.removeEventListener("change", update);
    };
  }, []);

  return device;
}

// ── Fullscreen ────────────────────────────────────────

/**
 * Fullscreen, where it is allowed.
 *
 * iOS Safari does not implement it on iPhone at all, so this is offered rather
 * than relied on: the layout has to work inside browser chrome regardless, and
 * fullscreen is simply nicer when it is there.
 */
export function fullscreenAvailable(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenEnabled ?? (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);
}

export async function toggleFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element };
  try {
    if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
    }
  } catch {
    // Refused — some browsers only allow it from certain gestures. Not fatal.
  }
}

export function useFullscreen(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    update();
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);
  return on;
}

// ── Haptics ───────────────────────────────────────────

/**
 * A tap you can feel.
 *
 * Deliberately tiny. The Vibration API is coarse and overusing it is the
 * fastest way to make someone turn a phone's haptics off entirely, so only
 * three things buzz: picking a card up, playing a hand, and breaking a seal.
 * Absent on iOS, where the call simply does nothing.
 */
export const haptic = {
  tap() {
    try {
      navigator.vibrate?.(8);
    } catch {
      // No vibrator, or blocked. Nothing to do.
    }
  },
  knock() {
    try {
      navigator.vibrate?.(18);
    } catch {
      // As above.
    }
  },
  win() {
    try {
      navigator.vibrate?.([16, 50, 16, 50, 40]);
    } catch {
      // As above.
    }
  },
};
