export type MarkdownBlockType =
  | "paragraph"
  | "heading"
  | "code"
  | "diff"
  | "list"
  | "quote"
  | "thematic-break"

export type MarkdownBlock = {
  id: string
  type: MarkdownBlockType
  sourceStart: number
  sourceEnd: number
  sourceHash: string
}

export type MarkdownDocument = {
  version: number
  blocks: readonly MarkdownBlock[]
  sourceLength: number
}

export const createMarkdownDocument = (source: string): MarkdownDocument => ({
  version: 1,
  blocks: [],
  sourceLength: source.length,
})
