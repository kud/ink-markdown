import stringWidth from "string-width"

// Semantic (renderer-independent) styling. No ANSI here — the Ink view maps these to
// <Text> props, a future OpenTUI view maps them to its own styling, and a path-A composer
// turns them into ANSI. Colours are resolved theme values (e.g. "cyan"), not tokens.
export type SpanStyle = {
  color?: string
  backgroundColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  dim?: boolean
  inverse?: boolean
}

export type TextSpan = {
  text: string
  style?: SpanStyle
}

export type LayoutLine = {
  id: string
  spans: readonly TextSpan[]
  plainText: string
  displayWidth: number
}

export type BlockLayout = {
  blockId: string
  width: number
  height: number
  lines: readonly LayoutLine[]
}

export type MarkdownTheme = {
  foreground?: string
  muted: string
  heading: string
  link: string
  inlineCode: string
  quote: string
  added: string
  removed: string
  context: string
}

export const defaultTheme: MarkdownTheme = {
  muted: "gray",
  heading: "cyan",
  link: "blue",
  inlineCode: "yellow",
  quote: "gray",
  added: "green",
  removed: "red",
  context: "gray",
}

/** Display width in terminal columns (Unicode-aware: wide chars count as 2). */
export const measureWidth = (text: string): number => stringWidth(text)

/** Slice a string to at most `max` display columns without splitting a code point. */
export const sliceByWidth = (text: string, max: number): string => {
  let used = 0
  let out = ""
  for (const ch of text) {
    const cw = stringWidth(ch)
    if (used + cw > max) break
    out += ch
    used += cw
  }
  return out
}

const sameStyle = (a?: SpanStyle, b?: SpanStyle): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Append text to a span list, merging into the previous span when the style matches so
// runs of identical styling stay a single span (fewer nodes for the renderer).
const append = (line: TextSpan[], text: string, style?: SpanStyle): void => {
  const last = line[line.length - 1]
  if (last && sameStyle(last.style, style))
    line[line.length - 1] = { text: last.text + text, style }
  else line.push(style ? { text, style } : { text })
}

const INLINE =
  /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)]+)\))/g

// Minimal inline parser → styled spans: bold, italic, inline code, links. Markdown-it can
// replace this later for fuller GFM inline; this covers the common PR-comment cases.
export const parseInline = (text: string, theme: MarkdownTheme): TextSpan[] => {
  const spans: TextSpan[] = []
  const re = new RegExp(INLINE)
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) })
    if (m[2] !== undefined) spans.push({ text: m[2], style: { bold: true } })
    else if (m[3] !== undefined)
      spans.push({ text: m[3], style: { color: theme.inlineCode } })
    else if (m[4] !== undefined)
      spans.push({ text: m[4], style: { italic: true } })
    else if (m[5] !== undefined)
      spans.push({ text: m[5], style: { italic: true } })
    else if (m[6] !== undefined)
      spans.push({ text: m[6], style: { color: theme.link, underline: true } })
    last = m.index + m[0].length
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans.length > 0 ? spans : [{ text }]
}

// Word-wrap a run of styled spans to `max` display columns, splitting spans at column
// boundaries and hard-breaking any single token longer than the line.
export const wrapSpans = (
  spans: readonly TextSpan[],
  max: number,
): TextSpan[][] => {
  const width = Math.max(1, max)
  const lines: TextSpan[][] = []
  let line: TextSpan[] = []
  let used = 0
  const flush = () => {
    lines.push(line)
    line = []
    used = 0
  }

  for (const span of spans) {
    const tokens = span.text.match(/\s+|\S+/g) ?? []
    for (const token of tokens) {
      const w = stringWidth(token)
      if (/^\s+$/.test(token)) {
        // Keep inter-word whitespace, but drop it at a line start (no leading spaces on wraps).
        if (used > 0 && used + w <= width) {
          append(line, token, span.style)
          used += w
        }
        continue
      }
      if (used + w <= width) {
        append(line, token, span.style)
        used += w
        continue
      }
      if (used > 0) flush()
      if (w <= width) {
        append(line, token, span.style)
        used += w
      } else {
        let rest = token
        while (stringWidth(rest) > width) {
          const chunk = sliceByWidth(rest, width)
          append(line, chunk, span.style)
          flush()
          rest = rest.slice(chunk.length)
        }
        if (rest) {
          append(line, rest, span.style)
          used = stringWidth(rest)
        }
      }
    }
  }
  if (line.length > 0) lines.push(line)
  return lines.length > 0 ? lines : [[]]
}

/** Truncate a run of spans to `max` display columns (for code / diff — clip, don't wrap). */
export const clipSpans = (
  spans: readonly TextSpan[],
  max: number,
): TextSpan[] => {
  const out: TextSpan[] = []
  let used = 0
  for (const span of spans) {
    if (used >= max) break
    const w = stringWidth(span.text)
    if (used + w <= max) {
      out.push(span)
      used += w
    } else {
      out.push({ text: sliceByWidth(span.text, max - used), style: span.style })
      break
    }
  }
  return out
}
