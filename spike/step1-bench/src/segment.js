import { hash } from "./hash.js"

// Line-scan block segmenter. Splits Markdown into stable top-level blocks with a
// content hash for identity + layout-cache keying. Minimal block set — enough for the
// benchmark fixtures, not a full CommonMark parser.
//
// Returns: { id, type, lang, text, startLine, endLine, sourceHash }[]
// type ∈ heading | code | diff | quote | list | hr | paragraph

const RE_FENCE = /^```(\S*)\s*$/
const RE_HEADING = /^#{1,6}\s+/
const RE_HR = /^(-{3,}|\*{3,}|_{3,})\s*$/
const RE_QUOTE = /^>\s?/
const RE_LIST = /^(\s*)([-*+]|\d+\.)\s+/

export const segment = (source) => {
  const lines = source.split("\n")
  const blocks = []
  let i = 0

  const push = (type, from, to, lang) => {
    const text = lines.slice(from, to).join("\n")
    blocks.push({
      id: hash(text),
      type,
      lang: lang ?? null,
      text,
      startLine: from,
      endLine: to,
      sourceHash: hash(text),
    })
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      i++
      continue
    }

    // Fenced code / diff — consume to the closing fence (or EOF: an open block).
    const fence = line.match(RE_FENCE)
    if (fence) {
      const lang = fence[1] || ""
      let j = i + 1
      while (j < lines.length && !RE_FENCE.test(lines[j])) j++
      const closed = j < lines.length
      const to = closed ? j + 1 : lines.length
      push(lang === "diff" ? "diff" : "code", i, to, lang)
      i = to
      continue
    }

    if (RE_HEADING.test(line)) {
      push("heading", i, i + 1)
      i++
      continue
    }

    if (RE_HR.test(line)) {
      push("hr", i, i + 1)
      i++
      continue
    }

    if (RE_QUOTE.test(line)) {
      let j = i
      while (j < lines.length && RE_QUOTE.test(lines[j])) j++
      push("quote", i, j)
      i = j
      continue
    }

    if (RE_LIST.test(line)) {
      let j = i
      while (
        j < lines.length &&
        lines[j].trim() !== "" &&
        !RE_FENCE.test(lines[j])
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
      !RE_FENCE.test(lines[j]) &&
      !RE_HEADING.test(lines[j]) &&
      !RE_HR.test(lines[j]) &&
      !RE_QUOTE.test(lines[j]) &&
      !RE_LIST.test(lines[j])
    )
      j++
    push("paragraph", i, j)
    i = j
  }

  return blocks
}
