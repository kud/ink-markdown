import { segment } from "./segment.js"

export type MarkdownBlockType =
  | "paragraph"
  | "heading"
  | "code"
  | "diff"
  | "list"
  | "quote"
  | "thematic-break"
  | "table"

export type MarkdownBlock = {
  id: string
  type: MarkdownBlockType
  sourceStart: number
  sourceEnd: number
  sourceHash: string
  /** Fence info string for `code` / `diff` blocks (e.g. "ts", "diff"). */
  lang?: string
}

export type MarkdownDocument = {
  version: number
  blocks: readonly MarkdownBlock[]
  sourceLength: number
}

export const createMarkdownDocument = (
  source: string,
  version = 1,
): MarkdownDocument => ({
  version,
  blocks: segment(source),
  sourceLength: source.length,
})

// Reparse after an edit. Block identity is content-based, so unchanged blocks keep their ids
// automatically — cached layouts downstream stay valid — and this just restamps the version.
export const updateMarkdownDocument = (
  previous: MarkdownDocument,
  source: string,
): MarkdownDocument => createMarkdownDocument(source, previous.version + 1)
