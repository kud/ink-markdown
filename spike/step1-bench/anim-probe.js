// Animation-ceiling probe. The latency probe proved DOCUMENT SCROLLING is fine on Ink.
// This asks the opposite question — the design-system one: how well does Ink sustain
// CONTINUOUS animation, and what does faking transparency cost?
//
// Two workloads:
//   • MovingBar   — a small element moves each frame (best case, localised change).
//   • FadeScreen  — every cell's background colour changes each frame (worst case; this
//                   is what an animated translucent full-screen overlay costs, because
//                   "transparency" in a terminal = you recompute each blended cell).
//
// Metrics: real CPU time per frame (process.cpuUsage, excludes throttle idle) → CPU-bound
// fps ceiling; plus Ink's actual sustained paint rate under a tight update loop.

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
  let frames = 0
  const s = new Writable({
    write(chunk, _e, cb) {
      bytes += chunk.length
      if (chunk.length > 500) frames++ // a full repaint is a big write; cursor pokes are tiny
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
    getStats: () => ({ bytes, frames }),
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

// ── workloads ─────────────────────────────────────────────────────────────────
const MovingBar = ({ t }) => {
  const rows = []
  for (let y = 0; y < 10; y++)
    rows.push(y === t % 10 ? c.bgCyan.black(" ".repeat(W)) : c.dim(`row ${y}`))
  return h(
    Box,
    { width: W, height: 10 },
    h(Text, { wrap: "truncate" }, rows.join("\n")),
  )
}

const FadeScreen = ({ t }) => {
  const rows = []
  for (let y = 0; y < H; y++) {
    let row = ""
    for (let x = 0; x < W; x++) {
      const r = Math.floor(128 + 127 * Math.sin(x * 0.1 + t * 0.2))
      const g = Math.floor(128 + 127 * Math.sin(y * 0.1 + t * 0.2 + 2))
      const b = Math.floor(128 + 127 * Math.sin((x + y) * 0.05 + t * 0.2 + 4))
      row += c.bgRgb(r, g, b)(" ")
    }
    rows.push(row)
  }
  return h(
    Box,
    { width: W, height: H },
    h(Text, { wrap: "truncate" }, rows.join("\n")),
  )
}

// ── CPU/frame (FLUSH-spaced so every rerender actually paints) ──────────────────
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
  const { bytes } = stdout.getStats()
  inst.unmount()
  const perFrame = (cpu.user + cpu.system) / 1000 / frames
  console.log(
    `  ${label.padEnd(14)} CPU/frame ${perFrame.toFixed(2)}ms → CPU-ceiling ${Math.round(1000 / perFrame)} fps   (${Math.round(bytes / frames / 1024)}KB/frame)`,
  )
  return perFrame
}

// ── sustained paint rate under a tight update loop (reveals Ink's throttle cap) ──
const sustainedFps = async (label, Comp, durationMs = 1200) => {
  const stdout = makeStdout()
  const inst = render(h(Comp, { t: 0 }), {
    stdout,
    stdin: makeStdin(),
    patchConsole: false,
    exitOnCtrlC: false,
  })
  await sleep(40)
  const f0 = stdout.getStats().frames
  const start = performance.now()
  let t = 0
  while (performance.now() - start < durationMs) {
    inst.rerender(h(Comp, { t: ++t }))
    await sleep(0) // yield so Ink can flush; no artificial delay
  }
  const painted = stdout.getStats().frames - f0
  const secs = (performance.now() - start) / 1000
  inst.unmount()
  console.log(
    `  ${label.padEnd(14)} sustained ${Math.round(painted / secs)} fps painted  (${t} updates issued in ${secs.toFixed(1)}s)`,
  )
}

console.log("Ink animation-ceiling probe — real Ink, fake TTY 100×40\n")
console.log("CPU cost per frame:")
await cpuPerFrame("MovingBar", MovingBar)
await cpuPerFrame("FadeScreen", FadeScreen)
console.log("\nSustained paint rate (tight loop, Ink throttle in effect):")
await sustainedFps("MovingBar", MovingBar)
await sustainedFps("FadeScreen", FadeScreen)
console.log(
  "\nRead: MovingBar ≈ what tasteful Ink animation costs. FadeScreen ≈ full-screen",
)
console.log(
  "fade / translucent overlay — the OpenTUI-native workload. Compare fps to 60.",
)
