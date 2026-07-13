import { describe, expect, it } from "vitest"
import { createMarkdownDocument } from "./document.js"
import { createMarkdownLayout, sliceLines } from "./layout.js"
import {
  clipSpans,
  parseInline,
  wrapSpans,
  defaultTheme,
  measureWidth,
} from "./spans.js"

const layout = (source: string, width: number, cache?: Map<string, never>) =>
  createMarkdownLayout(createMarkdownDocument(source), source, {
    width,
    cache: cache as never,
  })

describe("wrapSpans", () => {
  it("wraps prose to the given width without exceeding it", () => {
    const lines = wrapSpans([{ text: "the quick brown fox jumps over" }], 12)

    for (const line of lines) {
      const w = measureWidth(line.map((span) => span.text).join(""))
      expect(w).toBeLessThanOrEqual(12)
    }
    expect(lines.length).toBeGreaterThan(1)
  })

  it("hard-breaks a single token longer than the width", () => {
    const lines = wrapSpans([{ text: "x".repeat(25) }], 10)

    expect(lines.length).toBe(3)
    expect(measureWidth(lines[0].map((s) => s.text).join(""))).toBe(10)
  })

  it("measures wide (CJK) characters as two columns when wrapping", () => {
    const lines = wrapSpans([{ text: "一".repeat(6) }], 8) // 6×2 = 12 cols → wraps

    expect(lines.length).toBe(2)
    expect(measureWidth(lines[0].map((s) => s.text).join(""))).toBe(8)
  })

  it("preserves span styles across a wrap boundary", () => {
    const styled = [{ text: "aaaa " }, { text: "bbbb", style: { bold: true } }]
    const lines = wrapSpans(styled, 4)

    const bold = lines.flat().find((span) => span.text.includes("bbbb"))
    expect(bold?.style?.bold).toBe(true)
  })
})

describe("clipSpans", () => {
  it("truncates to the width and keeps the last span's style", () => {
    const clipped = clipSpans(
      [{ text: "hello world", style: { color: "red" } }],
      5,
    )

    expect(clipped.map((s) => s.text).join("")).toBe("hello")
    expect(clipped[0].style?.color).toBe("red")
  })
})

describe("parseInline", () => {
  it("turns bold, inline code and links into styled spans", () => {
    const spans = parseInline("a **b** `c` [d](http://e)", defaultTheme)

    expect(spans.find((s) => s.text === "b")?.style?.bold).toBe(true)
    expect(spans.find((s) => s.text === "c")?.style?.color).toBe(
      defaultTheme.inlineCode,
    )
    expect(spans.find((s) => s.text === "d")?.style?.color).toBe(
      defaultTheme.link,
    )
  })
})

describe("createMarkdownLayout", () => {
  it("converts a document into terminal lines", () => {
    const result = layout("# Title\n\nA short paragraph.", 40)

    expect(result.totalLines).toBe(result.lines.length)
    expect(result.lines[0].spans[0].style?.color).toBe(defaultTheme.heading)
  })

  it("strips fences and clips code lines to width", () => {
    const result = layout(
      "```ts\nconst reallyLongIdentifierName = 1234567890\n```",
      12,
    )

    expect(result.lines.every((line) => line.displayWidth <= 12)).toBe(true)
    expect(result.lines.some((line) => line.plainText.includes("```"))).toBe(
      false,
    )
  })

  it("colours diff lines by their prefix", () => {
    const result = layout("```diff\n+added\n-removed\n context\n```", 40)
    const added = result.lines.find((line) => line.plainText === "+added")
    const removed = result.lines.find((line) => line.plainText === "-removed")

    expect(added?.spans[0].style?.color).toBe(defaultTheme.added)
    expect(removed?.spans[0].style?.color).toBe(defaultTheme.removed)
  })

  it("builds a cumulative index that maps to a correct viewport slice", () => {
    const source = Array.from({ length: 30 }, (_, i) => `line ${i}`).join(
      "\n\n",
    )
    const result = layout(source, 40)
    const window = sliceLines(result, 5, 10)

    expect(window).toHaveLength(10)
    expect(result.lineOffsets.length).toBe(result.blocks.length)
  })

  it("reuses cached block layouts on a second pass with the same width", () => {
    const source = "# Title\n\nStable paragraph body.\n\n- one\n- two"
    const cache = new Map<string, never>()
    const first = layout(source, 40, cache)
    const second = layout(source, 40, cache)

    expect(first.computed).toBeGreaterThan(0)
    expect(second.reused).toBe(second.blocks.length)
    expect(second.computed).toBe(0)
  })
})
