// Real-latency probe. ink-testing-library carries a ~26ms scheduler/throttle floor, so
// wall-clock rerender timing is meaningless for latency. Instead: drive a REAL Ink
// instance against a fake-TTY sink and measure CPU TIME PER FRAME (process.cpuUsage),
// which excludes throttle idle. That is the number that decides whether Ink keeps up:
// if CPU/frame ≪ frame budget, latency is throttle-bound (~26ms) and comfortably under
// the 50ms kill-criterion; if CPU/frame is large, frames pile up and we have a problem.

import React from "react"
import { render } from "ink"
import { Writable, Readable } from "node:stream"
import { segment } from "./src/segment.js"
import { createLayout, sliceLines } from "./src/layout.js"
import { fixtures } from "./src/fixtures.js"
import { PathA, PathB } from "./src/renderers.js"

const h = React.createElement
const WIDTH = 100
const HEIGHT = 40
const OVERSCAN = 8
const FRAMES = 40
const FLUSH_MS = 40 // > Ink's write throttle, so every rerender actually paints a frame

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const makeStdout = () => {
  let bytes = 0
  let writes = 0
  const s = new Writable({
    write(chunk, _enc, cb) {
      bytes += chunk.length
      writes++
      cb()
    },
  })
  s.isTTY = true
  s.columns = WIDTH
  s.rows = HEIGHT
  s.cursorTo = () => {}
  s.clearLine = () => {}
  s.moveCursor = () => {}
  s.getStats = () => ({ bytes, writes })
  return s
}

const makeStdin = () => {
  const s = new Readable({ read() {} })
  s.isTTY = false
  s.setRawMode = () => {}
  s.ref = () => {}
  s.unref = () => {}
  return s
}

const measure = async (label, makeEl, maxOffset) => {
  const stdout = makeStdout()
  const inst = render(makeEl(0), {
    stdout,
    stdin: makeStdin(),
    patchConsole: false,
    exitOnCtrlC: false,
  })
  await sleep(FLUSH_MS) // settle first paint
  const before = process.cpuUsage()
  const wallStart = performance.now()
  for (let i = 1; i <= FRAMES; i++) {
    const off = (i * 3) % Math.max(1, maxOffset)
    inst.rerender(makeEl(off))
    await sleep(FLUSH_MS)
  }
  const cpu = process.cpuUsage(before)
  const wall = performance.now() - wallStart
  const { bytes, writes } = stdout.getStats()
  inst.unmount()
  const painted = Math.max(1, writes - 1) // writes beyond the initial settle ≈ painted frames
  const cpuPerFrame = (cpu.user + cpu.system) / 1000 / FRAMES // ms CPU per requested frame
  const fpsCeiling = 1000 / cpuPerFrame // CPU-bound max fps
  console.log(
    `  ${label.padEnd(20)} CPU/frame ${cpuPerFrame.toFixed(2)}ms  →  CPU-bound ceiling ${Math.round(fpsCeiling)} fps` +
      `   (painted ${painted}/${FRAMES}, ${Math.round(bytes / FRAMES)} B/frame)`,
  )
  return cpuPerFrame
}

console.log(
  `Live-TTY CPU probe — real Ink, fake TTY ${WIDTH}×${HEIGHT}, CPU time per frame (excludes throttle idle)\n`,
)

const fx = fixtures()
for (const name of ["doc-10k", "diff-5k"]) {
  const layout = createLayout(segment(fx[name]), WIDTH)
  const maxOffset = Math.max(1, layout.total - HEIGHT)
  console.log(`■ ${name} (${layout.total} lines)`)
  await measure(
    "A (1 string)",
    (off) =>
      h(PathA, {
        lines: sliceLines(layout, off, HEIGHT),
        width: WIDTH,
        height: HEIGHT,
      }),
    maxOffset,
  )
  await measure(
    "B (per-line +overscan)",
    (off) =>
      h(PathB, {
        lines: sliceLines(layout, off, HEIGHT + 2 * OVERSCAN),
        width: WIDTH,
        height: HEIGHT,
      }),
    maxOffset,
  )
  console.log("")
}

console.log(
  "Kill-criterion read: if CPU/frame ≪ 50ms, per-frame latency is throttle-bound (~26ms) and PASSES.",
)
