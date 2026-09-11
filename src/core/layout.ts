import { hash } from "./hash.js"
import type { MarkdownBlock, MarkdownDocument } from "./document.js"
import {
  type BlockLayout,
  type LayoutLine,
  type MarkdownTheme,
  type TextSpan,
  clipSpans,
  defaultTheme,
  measureWidth,
  parseInline,
  wrapSpans,
} from "./spans.js"

const blockText = (block: MarkdownBlock, source: string): string =>
  source.slice(block.sourceStart, block.sourceEnd)

const toLine = (
  blockId: string,
  index: number,
  spans: TextSpan[],
): LayoutLine => {
  const plainText = spans.map((span) => span.text).join("")
  return {
    id: `${blockId}:${index}`,
    spans,
    plainText,
    displayWidth: measureWidth(plainText),
  }
}

const stripFences = (text: string): string[] => {
  const lines = text.split("\n")
  if (lines[0]?.startsWith("```")) lines.shift()
  if (lines.length > 0 && lines[lines.length - 1]?.startsWith("```"))
    lines.pop()
  return lines
}

const diffStyle = (line: string, theme: MarkdownTheme) => {
  if (line.startsWith("@@")) return { color: theme.heading }
  if (/^(\+\+\+|---|diff |index )/.test(line)) return { bold: true }
  if (line.startsWith("+")) return { color: theme.added }
  if (line.startsWith("-")) return { color: theme.removed }
  return { color: theme.context }
}

// One block → its visual terminal lines. Prose wraps; code/diff clip. Pure + deterministic
// given (block text, width, theme) → safe to cache. Syntax highlighting arrives in M4;
// code renders plain here.
const layoutBlock = (
  block: MarkdownBlock,
  source: string,
  width: number,
  theme: MarkdownTheme,
): LayoutLine[] => {
  const text = blockText(block, source)
  const rows: TextSpan[][] = []

  switch (block.type) {
    case "heading": {
      const content = text.replace(/^#{1,6}\s+/, "")
      rows.push(
        ...wrapSpans(
          [{ text: content, style: { color: theme.heading, bold: true } }],
          width,
        ),
      )
      break
    }
    case "thematic-break": {
      rows.push([
        { text: "─".repeat(Math.max(1, width)), style: { color: theme.muted } },
      ])
      break
    }
    case "quote": {
      const content = text.replace(/^>\s?/gm, "").split("\n").join(" ")
      const prefix: TextSpan = { text: "│ ", style: { color: theme.quote } }
      for (const wrapped of wrapSpans(parseInline(content, theme), width - 2))
        rows.push([prefix, ...wrapped])
      break
    }
    case "list": {
      for (const raw of text.split("\n")) {
        const item = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (!item) continue
        wrapSpans(parseInline(item[3], theme), width - 2).forEach(
          (wrapped, i) => {
            const prefix: TextSpan =
              i === 0
                ? { text: "• ", style: { color: theme.heading } }
                : { text: "  " }
            rows.push([prefix, ...wrapped])
          },
        )
      }
      break
    }
    case "code": {
      for (const codeLine of stripFences(text))
        rows.push(clipSpans([{ text: codeLine }], width))
      break
    }
    case "diff": {
      const body = block.lang === "diff" ? stripFences(text) : text.split("\n")
      for (const diffLine of body)
        rows.push(
          clipSpans(
            [{ text: diffLine, style: diffStyle(diffLine, theme) }],
            width,
          ),
        )
      break
    }
    default: {
      const content = text.split("\n").join(" ")
      rows.push(...wrapSpans(parseInline(content, theme), width))
    }
  }

  return rows.map((spans, index) => toLine(block.id, index, spans))
}

export type LayoutOptions = {
  width: number
  theme?: MarkdownTheme
  themeId?: string
  /** Optional cross-call cache (survives scroll/resize) keyed by block id + width + theme. */
  cache?: Map<string, readonly LayoutLine[]>
}

export type MarkdownLayout = {
  width: number
  themeId: string
  blocks: readonly BlockLayout[]
  /** All lines in document order — O(1) viewport slicing. */
  lines: readonly LayoutLine[]
  /** Cumulative first-line index of each block (parallel to blocks). */
  lineOffsets: readonly number[]
  totalLines: number
  reused: number
  computed: number
}

// Lay out every block for a given width, reusing cached block layouts where possible. Scroll
// never recomputes; a width change invalidates only width-dependent entries via the key.
export const createMarkdownLayout = (
  document: MarkdownDocument,
  source: string,
  options: LayoutOptions,
): MarkdownLayout => {
  const theme = options.theme ?? defaultTheme
  const themeId =
    options.themeId ?? (options.theme ? hash(JSON.stringify(theme)) : "default")
  const width = options.width
  const cache = options.cache
  const blocks: BlockLayout[] = []
  const lines: LayoutLine[] = []
  const lineOffsets: number[] = []
  let reused = 0
  let computed = 0

  // One blank line between any two adjacent blocks, none before the first or
  // after the last. Every Markdown renderer separates blocks with vertical
  // space; without it a bold-paragraph "heading" runs straight into the list
  // beneath it and the eye has to parse where one thought ends. A list is one
  // block, so its items stay tight; a fence is one block, so its lines do; a
  // rule gets air on both sides. Pushed HERE rather than inside layoutBlock so
  // the per-block cache stays a function of the block alone, and `blocks[i]`
  // still reports its own height — the gap belongs to the document, not to
  // either neighbour. `lineOffsets` count it, so viewport math stays honest.
  document.blocks.forEach((block, i) => {
    if (i > 0) lines.push(toLine(block.id, -1, []))
    const key = `${block.id}:${width}:${themeId}`
    let blockLines = cache?.get(key)
    if (blockLines) {
      reused++
    } else {
      blockLines = layoutBlock(block, source, width, theme)
      cache?.set(key, blockLines)
      computed++
    }
    lineOffsets.push(lines.length)
    blocks.push({
      blockId: block.id,
      width,
      height: blockLines.length,
      lines: blockLines,
    })
    for (const line of blockLines) lines.push(line)
  })

  return {
    width,
    themeId,
    blocks,
    lines,
    lineOffsets,
    totalLines: lines.length,
    reused,
    computed,
  }
}

/** Visible slice for a viewport — clamped so the last page never scrolls past the end. */
export const sliceLines = (
  layout: MarkdownLayout,
  offset: number,
  height: number,
): readonly LayoutLine[] => {
  const start = Math.max(
    0,
    Math.min(offset, Math.max(0, layout.totalLines - height)),
  )
  return layout.lines.slice(start, start + height)
}

/** Index of the first block whose cumulative offset ≤ line — the log-n first-visible lookup. */
export const firstBlockAt = (layout: MarkdownLayout, line: number): number => {
  const offsets = layout.lineOffsets
  let lo = 0
  let hi = offsets.length - 1
  let answer = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= line) {
      answer = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return answer
}
