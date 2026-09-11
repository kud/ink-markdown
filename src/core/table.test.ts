import { describe, expect, it } from "vitest"
import { createMarkdownDocument } from "./document.js"
import { createMarkdownLayout } from "./layout.js"
import { defaultTheme } from "./spans.js"
import { layoutTable } from "./table.js"

const plain = (rows: ReturnType<typeof layoutTable>): string[] =>
  rows.map((r) => r.map((s) => s.text).join(""))

const TICKETS = [
  "| Ticket | Type | Est |",
  "| --- | --- | ---: |",
  "| SHOP-1200 | Adjustments list: ToE tab | 3 |",
  "| SHOP-1201 | Generate batch form | 5 |",
].join("\n")

describe("layoutTable", () => {
  it("pads columns to their widest cell and joins them with two spaces", () => {
    const rows = plain(layoutTable(TICKETS, 80, defaultTheme))

    expect(rows[0]).toBe("Ticket     Type                       Est")
    expect(rows[2]).toBe("SHOP-1200  Adjustments list: ToE tab    3")
    expect(rows[3]).toBe("SHOP-1201  Generate batch form          5")
  })

  it("draws the separator as one muted rule segment per column", () => {
    const rows = layoutTable(TICKETS, 80, defaultTheme)

    expect(plain(rows)[1]).toBe("─────────  ─────────────────────────  ───")
    expect(
      rows[1].every(
        (s) => s.text === "  " || s.style?.color === defaultTheme.muted,
      ),
    ).toBe(true)
  })

  it("styles the header as a heading, never underlined", () => {
    const [header] = layoutTable(TICKETS, 80, defaultTheme)
    const styled = header.filter((s) => s.text.trim() !== "")

    expect(
      styled.every(
        (s) => s.style?.bold && s.style.color === defaultTheme.heading,
      ),
    ).toBe(true)
    expect(styled.some((s) => s.style?.underline)).toBe(false)
  })

  it("right-aligns a column whose separator says so", () => {
    const rows = plain(layoutTable(TICKETS, 80, defaultTheme))

    expect(rows[2].endsWith("  3")).toBe(true)
    expect(rows[0].endsWith("Est")).toBe(true)
  })

  /*
   * One line per row, always: a row two lines tall is a list wearing a grid.
   * The widest column shrinks first and cells past their column end in `…`,
   * floored at the header's width so a `3` under `Est` is sized by `Est`.
   */
  it("shrinks the widest column and truncates cells when the table overflows", () => {
    const rows = plain(layoutTable(TICKETS, 30, defaultTheme))

    expect(rows.every((r) => r.length <= 30)).toBe(true)
    expect(rows[2]).toMatch(/^SHOP-1200  Adjustments.*…    3$/)
    expect(rows).toHaveLength(4)
  })

  it("keeps every column at any width, clipping the row only past every floor", () => {
    const rows = plain(layoutTable(TICKETS, 12, defaultTheme))

    expect(rows.every((r) => r.length <= 12)).toBe(true)
    expect(rows[0].startsWith("Ticket")).toBe(true)
  })

  it("leaves an empty cell blank and still rules a blank header column", () => {
    const rows = plain(
      layoutTable(
        "|  | ToE file | TAP file |\n| --- | --- | --- |\n| Item row | Paired legs |  |",
        80,
        defaultTheme,
      ),
    )

    expect(rows[0]).toBe("          ToE file     TAP file")
    expect(rows[1]).toBe("────────  ───────────  ────────")
    expect(rows[2]).toBe("Item row  Paired legs          ")
  })

  it("applies inline markup inside cells", () => {
    const rows = layoutTable(
      "| Key | Note |\n| --- | --- |\n| `a` | see [d](https://e.f) |",
      80,
      defaultTheme,
    )

    expect(
      rows[2].some(
        (s) => s.text === "a" && s.style?.color === defaultTheme.inlineCode,
      ),
    ).toBe(true)
    expect(rows[2].some((s) => s.text === "d" && s.style?.underline)).toBe(true)
  })
})

describe("table blocks in a document", () => {
  it("segments consecutive pipe rows as one table, and a lone pipe line as prose", () => {
    const source = `Intro.\n\n${TICKETS}\n\n| just a bar |\n\nAfter.`
    const doc = createMarkdownDocument(source)

    expect(doc.blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "table",
      "paragraph",
      "paragraph",
    ])
  })

  it("lays a table out one line per row inside the document", () => {
    const source = `Intro.\n\n${TICKETS}\n\nAfter.`
    const layout = createMarkdownLayout(
      createMarkdownDocument(source),
      source,
      {
        width: 80,
      },
    )
    const texts = layout.lines.map((l) => l.plainText)

    expect(texts).toEqual([
      "Intro.",
      "",
      "Ticket     Type                       Est",
      "─────────  ─────────────────────────  ───",
      "SHOP-1200  Adjustments list: ToE tab    3",
      "SHOP-1201  Generate batch form          5",
      "",
      "After.",
    ])
  })
})
