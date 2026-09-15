import chalk, { type ChalkInstance } from "chalk"
import type { LayoutLine, SpanStyle } from "../core/index.js"

// Path-A composition lives here: semantic spans → one ANSI string. Chalk auto-detects the
// terminal's colour support, so this degrades to plain text where colour is unavailable.
const chain = (fn: ChalkInstance, key: string): ChalkInstance => {
  const next = (fn as unknown as Record<string, unknown>)[key]
  return typeof next === "function" ? (next as ChalkInstance) : fn
}

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)

// A theme colour is either a chalk name (`cyan`) or a hex (`#FF8C00`) — Ink's
// `<Text color>` takes both, and a host handing its design tokens through the
// theme reasonably expects the same here. Chalk exposes the two differently:
// a name is a property, a hex goes through `.hex()` / `.bgHex()`. Routed by
// shape, because a hex looked up as a property is `undefined`, and `chain`
// then hands back the unstyled chain — which is how a cockpit's orange links
// rendered plain for a week without an error anywhere.
const colour = (
  fn: ChalkInstance,
  value: string,
  bg: boolean,
): ChalkInstance =>
  value.startsWith("#")
    ? bg
      ? fn.bgHex(value)
      : fn.hex(value)
    : chain(fn, bg ? `bg${capitalize(value)}` : value)

const applyStyle = (text: string, style?: SpanStyle): string => {
  if (!style) return text
  let fn: ChalkInstance = chalk
  if (style.color) fn = colour(fn, style.color, false)
  if (style.backgroundColor) fn = colour(fn, style.backgroundColor, true)
  if (style.bold) fn = chain(fn, "bold")
  if (style.italic) fn = chain(fn, "italic")
  if (style.underline) fn = chain(fn, "underline")
  if (style.dim) fn = chain(fn, "dim")
  if (style.inverse) fn = chain(fn, "inverse")
  return fn(text)
}

/** Compose one layout line's styled spans into a single ANSI string. */
export const lineToAnsi = (line: LayoutLine): string =>
  line.spans.map((span) => applyStyle(span.text, span.style)).join("")

/** Path-A composition: the visible span-lines → one ANSI string for a single <Text>. */
export const linesToAnsi = (lines: readonly LayoutLine[]): string =>
  lines.map(lineToAnsi).join("\n")
