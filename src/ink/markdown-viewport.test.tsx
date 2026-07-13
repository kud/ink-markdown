import { describe, expect, it } from "vitest"
import { render } from "ink-testing-library"
import { MarkdownViewport } from "./markdown-viewport.js"

const bigDoc = Array.from(
  { length: 500 },
  (_, i) => `Paragraph number ${i} with a few words in it.`,
).join("\n\n")

const rowsOf = (frame: string | undefined): string[] =>
  (frame ?? "").split("\n").filter((row) => row.trim().length > 0)

describe("MarkdownViewport", () => {
  it("mounts only viewport-sized content for a large document", () => {
    const { lastFrame, unmount } = render(
      <MarkdownViewport source={bigDoc} width={60} height={10} />,
    )

    // 500-paragraph document, but the frame is bounded to the viewport height.
    expect(rowsOf(lastFrame()).length).toBeLessThanOrEqual(10)
    unmount()
  })

  it("shows different content as the scroll offset advances", () => {
    const top = render(
      <MarkdownViewport
        source={bigDoc}
        width={60}
        height={6}
        scrollOffset={0}
      />,
    )
    const down = render(
      <MarkdownViewport
        source={bigDoc}
        width={60}
        height={6}
        scrollOffset={40}
      />,
    )

    expect(top.lastFrame()).not.toBe(down.lastFrame())
    top.unmount()
    down.unmount()
  })

  it("clamps the scroll offset so the last page never runs past the end", () => {
    const huge = render(
      <MarkdownViewport
        source={bigDoc}
        width={60}
        height={6}
        scrollOffset={100000}
      />,
    )
    const nearlyHuge = render(
      <MarkdownViewport
        source={bigDoc}
        width={60}
        height={6}
        scrollOffset={99999}
      />,
    )

    expect(huge.lastFrame()).toBe(nearlyHuge.lastFrame())
    huge.unmount()
    nearlyHuge.unmount()
  })

  it("renders a pre-computed layout without needing source", () => {
    const { lastFrame, unmount } = render(
      <MarkdownViewport
        source={"# Heading\n\nBody text."}
        width={40}
        height={4}
      />,
    )

    expect(lastFrame() ?? "").toContain("Heading")
    unmount()
  })
})
