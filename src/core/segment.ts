import { hash } from "./hash.js"
import type { MarkdownBlock, MarkdownBlockType } from "./document.js"

const FENCE = /^```(\S*)\s*$/
const HEADING = /^#{1,6}\s+/
const THEMATIC_BREAK = /^(-{3,}|\*{3,}|_{3,})\s*$/
const QUOTE = /^>\s?/
const LIST = /^(\s*)([-*+]|\d+\.)\s+/

// Line-scan segmenter → renderer-independent top-level blocks with stable, content-based
// identity. Minimal GFM-ish block set; inline parsing happens later in the layout stage.
// An unterminated fence stays a single open block, which is what the streaming tail needs.
export const segment = (source: string): MarkdownBlock[] => {
  const lines = source.split("\n")
  const lineStart: number[] = []
  let offset = 0
  for (const line of lines) {
    lineStart.push(offset)
    offset += line.length + 1 // + newline
  }

  const blocks: MarkdownBlock[] = []
  const seen = new Map<string, number>()

  const push = (
    type: MarkdownBlockType,
    fromLine: number,
    toLine: number,
    lang?: string,
  ) => {
    const lastLine = toLine - 1
    const sourceStart = lineStart[fromLine]
    const sourceEnd = lineStart[lastLine] + lines[lastLine].length
    const text = lines.slice(fromLine, toLine).join("\n")
    const sourceHash = hash(text)
    // Content hash is the identity; disambiguate genuinely-identical blocks by occurrence so
    // React keys stay unique without reintroducing position sensitivity for unique content.
    const count = seen.get(sourceHash) ?? 0
    seen.set(sourceHash, count + 1)
    const id = count === 0 ? sourceHash : `${sourceHash}~${count}`
    blocks.push({
      id,
      type,
      sourceStart,
      sourceEnd,
      sourceHash,
      ...(lang ? { lang } : {}),
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    const fence = line.match(FENCE)
    if (fence) {
      let j = i + 1
      while (j < lines.length && !FENCE.test(lines[j])) j++
      const toLine = j < lines.length ? j + 1 : lines.length // include closing fence, or EOF
      const lang = fence[1] || ""
      push(lang === "diff" ? "diff" : "code", i, toLine, lang || undefined)
      i = toLine
      continue
    }

    if (HEADING.test(line)) {
      push("heading", i, i + 1)
      i++
      continue
    }

    if (THEMATIC_BREAK.test(line)) {
      push("thematic-break", i, i + 1)
      i++
      continue
    }

    if (QUOTE.test(line)) {
      let j = i
      while (j < lines.length && QUOTE.test(lines[j])) j++
      push("quote", i, j)
      i = j
      continue
    }

    if (LIST.test(line)) {
      let j = i
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !FENCE.test(lines[j])
      )
        j++
      push("list", i, j)
      i = j
      continue
    }

    // Paragraph — consume consecutive non-blank, non-structural lines.
    let j = i
    while (
      j < lines.length &&
      lines[j].trim() !== "" &&
      !FENCE.test(lines[j]) &&
      !HEADING.test(lines[j]) &&
      !THEMATIC_BREAK.test(lines[j]) &&
      !QUOTE.test(lines[j]) &&
      !LIST.test(lines[j])
    )
      j++
    push("paragraph", i, j)
    i = j
  }

  return blocks
}
