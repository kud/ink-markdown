import { describe, expect, it } from "vitest"
import { createMarkdownDocument } from "./index.js"

describe("createMarkdownDocument", () => {
  it("captures the source length", () => {
    const document = createMarkdownDocument("# hello")

    expect(document.sourceLength).toBe(7)
  })

  it("starts with no parsed blocks", () => {
    const document = createMarkdownDocument("# hello")

    expect(document.blocks).toEqual([])
  })

  it("stamps the document model version", () => {
    const document = createMarkdownDocument("")

    expect(document.version).toBe(1)
  })
})
