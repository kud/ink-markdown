import React from "react"
import { Box, Text } from "ink"

const h = React.createElement

// PATH A — the whole visible viewport as ONE pre-composed string in a single <Text>.
// Ink sees 1 element / 1 Yoga node. We pay to join the slice each frame; Ink pays ~nothing.
export const PathA = ({ lines, width, height }) =>
  h(
    Box,
    { width, height, flexDirection: "column" },
    h(Text, { wrap: "truncate" }, lines.join("\n")),
  )

// PATH B — one <Text> per visible line. Ink juggles `height` elements, but on a 1-line
// scroll it can reuse the rows that didn't move. We pay less; Ink pays more.
export const PathB = ({ lines, width, height }) =>
  h(
    Box,
    { width, height, flexDirection: "column" },
    lines.map((l, i) => h(Text, { key: i, wrap: "truncate" }, l)),
  )

// PATH C — naive baseline: the ENTIRE document mounted as one <Text> per line, no
// virtualisation. Scroll shifts an inner column via negative margin, forcing Yoga to
// re-lay-out the whole tree each frame. Node count = document size. This is the thing
// virtualisation exists to avoid.
export const PathC = ({ allLines, width, height, offset }) =>
  h(
    Box,
    { width, height, flexDirection: "column", overflow: "hidden" },
    h(
      Box,
      { flexDirection: "column", marginTop: -offset },
      allLines.map((l, i) => h(Text, { key: i, wrap: "truncate" }, l)),
    ),
  )
