// Live demo — run with:  npx tsx examples/demo.tsx
// (interactive: j/k scroll · space/b page · g/G ends · q quit)

import { useMemo, useState } from "react"
import { Box, Text, render, useApp, useInput, useStdout } from "ink"
import {
  MarkdownViewport,
  createMarkdownDocument,
  createMarkdownLayout,
  useMarkdownScroll,
} from "../src/index.js"

const SAMPLE = `# ink-markdown

A **high-performance** Markdown renderer for Ink 7 — this whole view is one \`<Text>\`.

## Why it's fast

Only the *visible* lines are composed and mounted. A 10,000-line document costs the
same as this one. See [the plan](https://github.com/kud/ink-markdown) for the numbers.

- Block-based incremental parsing
- Width-aware cached layout
- Viewport-only rendering
- Streaming mutable-tail updates

> Reviewer: could we clip the gutter on narrow terminals? Resize me and find out.

\`\`\`ts
const layout = createMarkdownLayout(doc, source, { width })
const visible = sliceLines(layout, offset, height)
\`\`\`

\`\`\`diff
-const slow = renderWholeTree(document)
+const fast = renderViewportOnly(document, offset, height)
 return fast
\`\`\`
`

const Demo = () => {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const width = Math.min(100, stdout?.columns ?? 80)
  const height = Math.max(4, (stdout?.rows ?? 24) - 2)
  const [offset, setOffset] = useState(0)

  const doc = useMemo(() => createMarkdownDocument(SAMPLE), [])
  const layout = useMemo(
    () => createMarkdownLayout(doc, SAMPLE, { width }),
    [doc, width],
  )

  useInput((input, key) => {
    if (input === "q" || key.escape) exit()
  })
  useMarkdownScroll({
    totalLines: layout.totalLines,
    height,
    offset,
    onChange: setOffset,
  })

  return (
    <Box flexDirection="column">
      <Text dimColor>
        ink-markdown — j/k · space/b · g/G · q quit · {offset + 1}-
        {Math.min(offset + height, layout.totalLines)}/{layout.totalLines} lines
        · 1 mounted &lt;Text&gt;
      </Text>
      <MarkdownViewport
        layout={layout}
        width={width}
        height={height}
        scrollOffset={offset}
      />
    </Box>
  )
}

render(<Demo />)
