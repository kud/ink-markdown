import { describe, expect, it } from "vitest"
import { lineToAnsi, linesToAnsi } from "./ansi.js"
import type { LayoutLine } from "../core/index.js"

// Built from a plain-ASCII string so no raw ESC control byte ever lands in source.
const ANSI = new RegExp("\\u001b\\[[0-9;]*m", "g")
const strip = (text: string): string => text.replace(ANSI, "")

const line = (spans: LayoutLine["spans"]): LayoutLine => ({
  id: "x",
  spans,
  plainText: spans.map((s) => s.text).join(""),
  displayWidth: 0,
})

describe("lineToAnsi", () => {
  it("preserves visible text across plain and styled spans", () => {
    const out = lineToAnsi(
      line([{ text: "plain " }, { text: "bold", style: { bold: true } }]),
    )

    expect(strip(out)).toBe("plain bold")
  })

  it("degrades unknown style keys to plain text rather than throwing", () => {
    const out = lineToAnsi(
      line([{ text: "hi", style: { color: "not-a-real-colour" } }]),
    )

    expect(strip(out)).toBe("hi")
  })

  // A host passes its design tokens through the theme, and those are hexes.
  // Chalk exposes a hex through `.hex()`, not as a property, so the plain
  // chain lookup found nothing and the span went out unstyled.
  it("colours a hex the way it colours a name", () => {
    const named = lineToAnsi(line([{ text: "x", style: { color: "cyan" } }]))
    const hex = lineToAnsi(line([{ text: "x", style: { color: "#FF8C00" } }]))
    expect(strip(hex)).toBe("x")
    // Only meaningful where chalk has colour at all; a colourless runner
    // styles neither, and the assertion holds trivially.
    expect(hex === "x").toBe(named === "x")
  })
})

describe("linesToAnsi", () => {
  it("joins lines with newlines", () => {
    const out = linesToAnsi([line([{ text: "one" }]), line([{ text: "two" }])])

    expect(strip(out)).toBe("one\ntwo")
  })
})
