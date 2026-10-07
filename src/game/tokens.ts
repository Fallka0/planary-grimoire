/**
 * Tokens — what walking away from a seal is worth.
 *
 * You may refuse either of the first two seals of a chapter and take a token
 * instead. You lose the ink that seal would have paid; you gain something the
 * shop cannot sell you. The warden cannot be refused, which is what stops the
 * whole thing being a way to skip the game.
 *
 * Every token is paid into the *next* shop rather than now, so refusing a seal
 * is a bet on getting to that shop at all.
 */

export type TokenId = "covenant" | "sigil" | "leaf" | "ink" | "cheap";

export interface Token {
  id: TokenId;
  name: string;
  note: string;
  field: string;
  ink: string;
  glyph: string;
}

export const TOKENS: Token[] = [
  { id: "covenant", name: "Covenant token", note: "Adds one covenant to the next shop.", field: "#1d2a5c", ink: "#fbf1ea", glyph: "§" },
  { id: "sigil", name: "Sigil token", note: "One sigil in the next shop costs nothing.", field: "#1d1846", ink: "#fbf1ea", glyph: "✶" },
  { id: "leaf", name: "Leaf token", note: "Adds one free leaf to the next shop.", field: "#0b4a30", ink: "#efe3c4", glyph: "❧" },
  { id: "ink", name: "Ink token", note: "Five ink, straight away.", field: "#16100a", ink: "#f7d77e", glyph: "✦" },
  { id: "cheap", name: "Thrift token", note: "The next shop restocks for nothing, once.", field: "#3b0f5c", ink: "#fbf1ea", glyph: "↻" },
];

export const TOKEN_BY_ID = new Map(TOKENS.map((token) => [token.id, token]));
