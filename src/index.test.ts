import { describe, expect, it } from "vitest"
import { createMarkdownDocument, updateMarkdownDocument } from "./index.js"

describe("createMarkdownDocument", () => {
  it("captures the source length", () => {
    expect(createMarkdownDocument("# hello").sourceLength).toBe(7)
  })

  it("parses the source into typed top-level blocks", () => {
    const document = createMarkdownDocument("# Title\n\nA paragraph.")

    expect(document.blocks.map((block) => block.type)).toEqual([
      "heading",
      "paragraph",
    ])
  })

  it("stamps the document model version", () => {
    expect(createMarkdownDocument("").version).toBe(1)
  })
})

describe("updateMarkdownDocument", () => {
  it("bumps the version and keeps stable blocks' identity across an edit", () => {
    const first = createMarkdownDocument("# Title\n\nStable paragraph.")
    const second = updateMarkdownDocument(
      first,
      "# Changed Title\n\nStable paragraph.",
    )

    const before = first.blocks.find((block) => block.type === "paragraph")
    const after = second.blocks.find((block) => block.type === "paragraph")

    expect(second.version).toBe(2)
    expect(after?.id).toBe(before?.id)
  })
})
