import { useMemo } from "react"
import { Box, Text } from "ink"
import {
  createMarkdownDocument,
  createMarkdownLayout,
  sliceLines,
  type LayoutLine,
  type MarkdownDocument,
  type MarkdownLayout,
  type MarkdownTheme,
} from "../core/index.js"
import { linesToAnsi } from "./ansi.js"

export type MarkdownViewportProps = {
  /** Raw Markdown source. Ignored when `layout` is provided. */
  source?: string
  /** Pre-parsed document (reused with `source` to skip re-parsing). */
  document?: MarkdownDocument
  /** Pre-computed layout — skips parse + layout entirely. */
  layout?: MarkdownLayout
  width: number
  height: number
  /** First visible document line. Clamped so the last page never scrolls past the end. */
  scrollOffset?: number
  theme?: MarkdownTheme
  /** Layout cache shared across renders (survives scroll/resize). */
  cache?: Map<string, readonly LayoutLine[]>
}

// The viewport mounts exactly ONE <Text>, whatever the document size: the visible slice is
// composed into a single pre-rendered ANSI string (render-path A). React/Yoga work stays
// O(viewport), not O(document) — the whole performance thesis, made concrete.
export const MarkdownViewport = ({
  source,
  document,
  layout: providedLayout,
  width,
  height,
  scrollOffset = 0,
  theme,
  cache,
}: MarkdownViewportProps) => {
  const layout = useMemo(() => {
    if (providedLayout) return providedLayout
    const text = source ?? ""
    const doc = document ?? createMarkdownDocument(text)
    return createMarkdownLayout(doc, text, { width, theme, cache })
  }, [providedLayout, document, source, width, theme, cache])

  const composed = linesToAnsi(sliceLines(layout, scrollOffset, height))

  return (
    <Box width={width} height={height} flexDirection="column">
      <Text wrap="truncate">{composed}</Text>
    </Box>
  )
}
