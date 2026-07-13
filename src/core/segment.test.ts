import { describe, expect, it } from "vitest"
import { segment } from "./segment.js"

const types = (source: string) => segment(source).map((block) => block.type)

describe("segment", () => {
  it("splits the source into typed top-level blocks", () => {
    const source = "# Title\n\nA paragraph.\n\n- one\n- two\n\n> quote\n\n---"

    expect(types(source)).toEqual([
      "heading",
      "paragraph",
      "list",
      "quote",
      "thematic-break",
    ])
  })

  it("captures a fenced code block with its language", () => {
    const [block] = segment("```ts\nconst x = 1\n```")

    expect(block.type).toBe("code")
    expect(block.lang).toBe("ts")
  })

  it("treats a diff fence as a first-class diff block", () => {
    const [block] = segment("```diff\n- a\n+ b\n```")

    expect(block.type).toBe("diff")
  })

  it("keeps an unterminated fence as a single open block (streaming tail)", () => {
    expect(types("intro\n\n```ts\nconst x = 1")).toEqual(["paragraph", "code"])
  })

  it("exposes source offsets that slice back to the original text", () => {
    const source = "# Title\n\nHello world"
    const [, paragraph] = segment(source)

    expect(source.slice(paragraph.sourceStart, paragraph.sourceEnd)).toBe(
      "Hello world",
    )
  })

  it("gives a block stable identity when an unrelated block changes", () => {
    const before = segment("# Title\n\nStable paragraph.")
    const after = segment("# Changed Title\n\nStable paragraph.")

    const beforeParagraph = before.find((block) => block.type === "paragraph")
    const afterParagraph = after.find((block) => block.type === "paragraph")

    expect(afterParagraph?.id).toBe(beforeParagraph?.id)
  })

  it("disambiguates genuinely-identical blocks with unique ids but a shared hash", () => {
    const blocks = segment("dup\n\ndup")

    expect(blocks[0].id).not.toBe(blocks[1].id)
    expect(blocks[0].sourceHash).toBe(blocks[1].sourceHash)
  })
})
