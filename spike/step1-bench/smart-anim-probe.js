// Tests the hypothesis: "use Ink/React smartly and you don't render so much."
// Realistic translucency isn't a full-screen fade — it's a BOUNDED translucent panel
// (a modal fading in over dimmed content). Terminals can't overlap/composite, so we
// blend it ourselves — but only the panel's rows change each frame; every other row is
// a cached background string reused verbatim. That is "render less" made concrete.
//
// Compares against the full-screen fade (worst case) to show where the wall actually is.

import React from "react"
import { render, Box, Text } from "ink"
import { Writable, Readable } from "node:stream"
import { Chalk } from "chalk"

const h = React.createElement
const c = new Chalk({ level: 3 })
const W = 100
const H = 40
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const makeStdout = () => {
  let bytes = 0
  const s = new Writable({
    write(chunk, _e, cb) {
      bytes += chunk.length
      cb()
    },
  })
  Object.assign(s, {
    isTTY: true,
    columns: W,
    rows: H,
    cursorTo() {},
    clearLine() {},
    moveCursor() {},
    getStats: () => ({ bytes }),
  })
  return s
}
const makeStdin = () =>
  Object.assign(new Readable({ read() {} }), {
    isTTY: false,
    setRawMode() {},
    ref() {},
    unref() {},
  })

// Static background — computed ONCE. rgb grid + pre-rendered row strings (the cached rows).
const bg = []
const bgRow = []
for (let y = 0; y < H; y++) {
  bg[y] = []
  let row = ""
  for (let x = 0; x < W; x++) {
    const rgb = { r: 30 + ((x * 2) % 60), g: 30 + ((y * 3) % 60), b: 60 }
    bg[y][x] = rgb
    row += c.bgRgb(rgb.r, rgb.g, rgb.b)(" ")
  }
  bgRow[y] = row
}

// Panel geometry + fake alpha blend of a dark panel over the background.
const PY0 = 14,
  PY1 = 26,
  PX0 = 30,
  PX1 = 70
const PANEL = { r: 18, g: 18, b: 28 }
const blend = (a, b, t) => Math.round(a * (1 - t) + b * t)

// SmartOverlay: only panel rows are recomputed each frame; other rows reuse bgRow cache.
const SmartOverlay = ({ t }) => {
  const alpha = Math.min(1, t / 20) * (0.75 + 0.25 * Math.sin(t * 0.3)) // fade in, then shimmer
  const rows = []
  for (let y = 0; y < H; y++) {
    if (y < PY0 || y >= PY1) {
      rows.push(bgRow[y]) // cached — no work
      continue
    }
    let row = ""
    for (let x = 0; x < W; x++) {
      if (x < PX0 || x >= PX1) {
        const g = bg[y][x]
        row += c.bgRgb(g.r, g.g, g.b)(" ")
      } else {
        const g = bg[y][x]
        row += c.bgRgb(
          blend(g.r, PANEL.r, alpha),
          blend(g.g, PANEL.g, alpha),
          blend(g.b, PANEL.b, alpha),
        )(" ")
      }
    }
    rows.push(row)
  }
  return h(
    Box,
    { width: W, height: H },
    h(Text, { wrap: "truncate" }, rows.join("\n")),
  )
}

// FadeScreen: full-screen every-cell change (worst case, for contrast).
const FadeScreen = ({ t }) => {
  const rows = []
  for (let y = 0; y < H; y++) {
    let row = ""
    for (let x = 0; x < W; x++) {
      row += c.bgRgb(
        Math.floor(128 + 127 * Math.sin(x * 0.1 + t * 0.2)),
        Math.floor(128 + 127 * Math.sin(y * 0.1 + t * 0.2 + 2)),
        Math.floor(128 + 127 * Math.sin((x + y) * 0.05 + t * 0.2 + 4)),
      )(" ")
    }
    rows.push(row)
  }
  return h(
    Box,
    { width: W, height: H },
    h(Text, { wrap: "truncate" }, rows.join("\n")),
  )
}

const cpuPerFrame = async (label, Comp, frames = 30) => {
  const stdout = makeStdout()
  const inst = render(h(Comp, { t: 0 }), {
    stdout,
    stdin: makeStdin(),
    patchConsole: false,
    exitOnCtrlC: false,
  })
  await sleep(40)
  const before = process.cpuUsage()
  for (let i = 1; i <= frames; i++) {
    inst.rerender(h(Comp, { t: i }))
    await sleep(40)
  }
  const cpu = process.cpuUsage(before)
  const kb = stdout.getStats().bytes / frames / 1024
  inst.unmount()
  const perFrame = (cpu.user + cpu.system) / 1000 / frames
  console.log(
    `  ${label.padEnd(26)} CPU/frame ${perFrame.toFixed(2)}ms → ${Math.round(1000 / perFrame)} fps ceiling   (${kb.toFixed(1)}KB/frame written)`,
  )
}

console.log(
  'Smart-animation probe — does "render less" rescue translucency on Ink?\n',
)
await cpuPerFrame("Full-screen fade (worst)", FadeScreen)
await cpuPerFrame("Bounded translucent panel", SmartOverlay)
console.log(
  "\nThe panel recomputes ~12 of 40 rows and reuses the rest; Ink writes only the",
)
console.log(
  "changed region. That is the realistic modal/toast case — compare its fps to 60.",
)
