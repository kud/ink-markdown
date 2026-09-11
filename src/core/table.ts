import {
  type MarkdownTheme,
  type TextSpan,
  clipSpans,
  measureWidth,
  parseInline,
} from "./spans.js"

// A pipe table, laid out as a grid the eye can travel DOWN: one line per row,
// always. Columns are padded to their widest cell and joined by two spaces
// with no vertical rule — width is the scarce resource, and a four-column
// table spends nine cells on ` │ ` against six on gaps for the same
// information. The column structure is drawn once instead, as per-column `─`
// segments under the header in `theme.muted`, the thematic break's glyph and
// token; the padding carries the boundaries down from there. The header takes
// `theme.heading` bold, exactly as a heading block does, so it reads as the
// same class of thing. Not underlined: underline is what a link wears, and a
// header that looks clickable is a lie.
//
// Overflow shrinks and truncates rather than wrapping or clipping. A row two
// lines tall is a list wearing a grid; clipping at the right edge loses the
// rightmost columns, which in a ticket table are the short informative ones
// (points, status) while sparing the long prose. So while the row overflows,
// one column at a time comes off whichever is currently widest, floored at
// its header's width, and cells past their column end in `…`. If every
// column is at its floor and it still does not fit, the row clips like a code
// line — never a hidden column. A silently missing column is a lie; a visibly
// truncated one is honest.
//
// Empty cells stay blank. The ADF converter already emits `—` for "none", so
// inventing a dash here would collide with a real value. A leading empty
// header cell is a row-label column: blank header, but still a `─` segment,
// because the segment marks the column and is the one thing that says "this
// is a column" when the header cannot.

type Align = "left" | "right"

const GUTTER = "  "

const splitRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "")
  return trimmed.split("|").map((c) => c.trim())
}

const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

const alignOf = (cell: string): Align =>
  /^-+:$/.test(cell.trim()) ? "right" : "left"

const spanWidth = (spans: readonly TextSpan[]): number =>
  spans.reduce((n, s) => n + measureWidth(s.text), 0)

// Truncate a cell's spans to `max` columns, ending in `…` in the last span's
// style when anything was lost. The ellipsis inherits rather than taking a
// colour of its own — a clipped link stays a link to the end.
const truncateSpans = (spans: readonly TextSpan[], max: number): TextSpan[] => {
  if (spanWidth(spans) <= max) return [...spans]
  if (max <= 1) return [{ text: max === 1 ? "…" : "" }]
  const kept = clipSpans(spans, max - 1)
  const last = kept[kept.length - 1]
  if (last) kept[kept.length - 1] = { ...last, text: last.text + "…" }
  else kept.push({ text: "…" })
  return kept
}

const pad = (spans: TextSpan[], width: number, align: Align): TextSpan[] => {
  const gap = width - spanWidth(spans)
  if (gap <= 0) return spans
  const fill = { text: " ".repeat(gap) }
  return align === "right" ? [fill, ...spans] : [...spans, fill]
}

export const layoutTable = (
  text: string,
  width: number,
  theme: MarkdownTheme,
): TextSpan[][] => {
  const lines = text.split("\n").filter((l) => l.trim() !== "")
  const separatorAt = lines.findIndex((l, i) => i > 0 && SEPARATOR.test(l))
  const header = separatorAt > 0 ? splitRow(lines[0]) : null
  const aligns =
    separatorAt > 0 ? splitRow(lines[separatorAt]).map(alignOf) : []
  const bodyLines = lines.filter(
    (_, i) => i !== separatorAt && !(header && i === 0),
  )
  const body = bodyLines.map(splitRow)
  const columns = Math.max(header?.length ?? 0, ...body.map((r) => r.length))
  if (columns === 0) return []

  const cellSpans = (
    cells: string[],
    style?: TextSpan["style"],
  ): TextSpan[][] =>
    Array.from({ length: columns }, (_, c) => {
      const raw = cells[c] ?? ""
      const spans = parseInline(raw, theme)
      return style
        ? spans.map((s) => ({ ...s, style: { ...s.style, ...style } }))
        : spans
    })

  const headerSpans = header
    ? cellSpans(header, { color: theme.heading, bold: true })
    : null
  const rowSpans = body.map((cells) => cellSpans(cells))
  const allRows = headerSpans ? [headerSpans, ...rowSpans] : rowSpans

  const natural = Array.from({ length: columns }, (_, c) =>
    Math.max(1, ...allRows.map((r) => spanWidth(r[c]))),
  )
  const floors = Array.from({ length: columns }, (_, c) =>
    Math.max(1, headerSpans ? spanWidth(headerSpans[c]) : 1),
  )
  const widths = [...natural]
  const total = () =>
    widths.reduce((n, w) => n + w, 0) + GUTTER.length * (columns - 1)
  while (total() > width) {
    let widest = -1
    for (let c = 0; c < columns; c++)
      if (widths[c] > floors[c] && (widest < 0 || widths[c] > widths[widest]))
        widest = c
    if (widest < 0) break
    widths[widest] -= 1
  }

  const rowLine = (cells: TextSpan[][]): TextSpan[] => {
    const out: TextSpan[] = []
    cells.forEach((spans, c) => {
      if (c > 0) out.push({ text: GUTTER })
      out.push(
        ...pad(truncateSpans(spans, widths[c]), widths[c], aligns[c] ?? "left"),
      )
    })
    return clipSpans(out, width)
  }

  const rows: TextSpan[][] = []
  if (headerSpans) {
    rows.push(rowLine(headerSpans))
    const rule: TextSpan[] = []
    widths.forEach((w, c) => {
      if (c > 0) rule.push({ text: GUTTER })
      rule.push({ text: "─".repeat(w), style: { color: theme.muted } })
    })
    rows.push(clipSpans(rule, width))
  }
  for (const r of rowSpans) rows.push(rowLine(r))
  return rows
}
