/**
 * Covenants — one standing agreement per chapter, kept for the rest of the run.
 *
 * The shop sells sigils you will swap out and leaves you will spend in a
 * minute. A covenant is the opposite: one per chapter, expensive, permanent,
 * and never a number on a scoreboard. Every one of them buys *room* — another
 * slot, another hand, another card in the fan — which is why they feel like
 * progress even in a chapter where nothing else goes right.
 */

export type CovenantId = "spine" | "breath" | "patience" | "margin" | "cheapInk" | "wide" | "usury";

export interface Covenant {
  id: CovenantId;
  name: string;
  note: string;
  price: number;
  field: string;
  ink: string;
  plate: string;
}

export const COVENANTS: Covenant[] = [
  { id: "spine", name: "A wider spine", note: "One more slot in the book.", price: 10, field: "#1d2a5c", ink: "#fbf1ea", plate: "#8ee6ff" },
  { id: "breath", name: "A longer breath", note: "One more hand on every seal.", price: 12, field: "#b3122e", ink: "#fbf1ea", plate: "#ff5a78" },
  { id: "patience", name: "Patience", note: "One more discard on every seal.", price: 10, field: "#0b4a30", ink: "#efe3c4", plate: "#3ef0c4" },
  { id: "wide", name: "A broader hand", note: "One more card dealt to your hand.", price: 11, field: "#3b0f5c", ink: "#fbf1ea", plate: "#c58bff" },
  { id: "margin", name: "A deeper margin", note: "The shop stocks one more sigil.", price: 9, field: "#e8c7a2", ink: "#2a0710", plate: "#e0334f" },
  { id: "cheapInk", name: "Cheap ink", note: "Restocking costs one less, and never less than one.", price: 8, field: "#16100a", ink: "#f7d77e", plate: "#b8761c" },
  { id: "usury", name: "Usury", note: "Interest pays up to 8 instead of 5.", price: 12, field: "#050302", ink: "#fff3c4", plate: "#ff2e8a" },
];

export const COVENANT_BY_ID = new Map(COVENANTS.map((c) => [c.id, c]));

export function hasCovenant(held: readonly string[], id: CovenantId): boolean {
  return held.includes(id);
}

/** Every number a covenant moves, gathered in one place so nothing drifts. */
export function shaped(held: readonly string[]) {
  return {
    slots: hasCovenant(held, "spine") ? 1 : 0,
    hands: hasCovenant(held, "breath") ? 1 : 0,
    discards: hasCovenant(held, "patience") ? 1 : 0,
    handSize: hasCovenant(held, "wide") ? 1 : 0,
    shopSigils: hasCovenant(held, "margin") ? 1 : 0,
    rerollOff: hasCovenant(held, "cheapInk") ? 1 : 0,
    interestCap: hasCovenant(held, "usury") ? 8 : 5,
  };
}
