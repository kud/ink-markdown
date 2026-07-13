import React from "react"
import { render } from "ink-testing-library"
import { segment } from "./src/segment.js"
import { createLayout, sliceLines } from "./src/layout.js"
import { PathA, PathB, PathC } from "./src/renderers.js"
import { fixtures } from "./src/fixtures.js"
import { stats as hlStats, resetHighlightStats } from "./src/highlight.js"

const h = React.createElement
const WIDTH = 100
const HEIGHT = 40
const OVERSCAN = 8
const STRIDE = 3 // lines advanced per simulated scroll step
const FRAMES = { A: 150, B: 150, C: 40 }
const C_SCROLL_MAX_LINES = 4000 // above this, only measure C's first render + node count

const now = () => performance.now()
const pct = (arr, p) => {
  if (!arr.length) return NaN
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const ms = (x) => (Number.isFinite(x) ? x.toFixed(1) : "—")
const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)

const runScroll = (label, makeEl, frames, maxOffset) => {
  const t0 = now()
  const inst = render(makeEl(0))
  const first = now() - t0
  const times = []
  const budgetEnd = now() + (label === "C" ? 15000 : 25000)
  for (let s = 1; s <= frames; s++) {
    const off = (s * STRIDE) % Math.max(1, maxOffset)
    const tt = now()
    inst.rerender(makeEl(off))
    times.push(now() - tt)
    if (now() > budgetEnd) break
  }
  inst.unmount()
  return {
    first,
    p50: pct(times, 50),
    p95: pct(times, 95),
    frames: times.length,
  }
}

const benchFixture = (name, source) => {
  resetHighlightStats()
  const memBefore = process.memoryUsage().heapUsed

  const tParse = now()
  const blocks = segment(source)
  const parseMs = now() - tParse

  const tLayout = now()
  const layout = createLayout(blocks, WIDTH)
  const layoutMs = now() - tLayout

  const total = layout.total
  const maxOffset = Math.max(1, total - HEIGHT)
  const memAfter = process.memoryUsage().heapUsed
  const layoutMemMB = (memAfter - memBefore) / 1024 / 1024

  const rows = []

  // Path A — one Text for the whole viewport.
  {
    const r = runScroll(
      "A",
      (off) =>
        h(PathA, {
          lines: sliceLines(layout, off, HEIGHT),
          width: WIDTH,
          height: HEIGHT,
        }),
      FRAMES.A,
      maxOffset,
    )
    rows.push({ path: "A (1 string)", mounted: 1, ...r })
  }
  // Path B — one Text per visible line (+ overscan).
  {
    const H = HEIGHT + 2 * OVERSCAN
    const r = runScroll(
      "B",
      (off) =>
        h(PathB, {
          lines: sliceLines(layout, off, H),
          width: WIDTH,
          height: HEIGHT,
        }),
      FRAMES.B,
      maxOffset,
    )
    rows.push({ path: "B (per-line)", mounted: H, ...r })
  }
  // Path C — naive full tree, no virtualisation.
  {
    if (total <= C_SCROLL_MAX_LINES) {
      const r = runScroll(
        "C",
        (off) =>
          h(PathC, {
            allLines: layout.allLines,
            width: WIDTH,
            height: HEIGHT,
            offset: off,
          }),
        FRAMES.C,
        maxOffset,
      )
      rows.push({ path: "C (naive)", mounted: total, ...r })
    } else {
      const t0 = now()
      const inst = render(
        h(PathC, {
          allLines: layout.allLines,
          width: WIDTH,
          height: HEIGHT,
          offset: 0,
        }),
      )
      const first = now() - t0
      inst.unmount()
      rows.push({
        path: "C (naive)",
        mounted: total,
        first,
        p50: NaN,
        p95: NaN,
        frames: 0,
        note: "scroll skipped (tree too large)",
      })
    }
  }

  return {
    name,
    blocks: blocks.length,
    total,
    parseMs,
    layoutMs,
    layoutMemMB,
    hl: { ...hlStats },
    rows,
  }
}

const printFixture = (r) => {
  console.log(
    `\n■ ${r.name}  —  ${r.blocks} blocks, ${r.total} layout lines  |  parse ${ms(r.parseMs)}ms  layout ${ms(r.layoutMs)}ms  ` +
      `(hl ${r.hl.calls} calls / ${r.hl.hits} hits)  ~${r.layoutMemMB.toFixed(1)}MB`,
  )
  console.log(
    "  " +
      pad("path", 16) +
      lpad("mounted", 9) +
      lpad("first ms", 11) +
      lpad("scroll p50", 12) +
      lpad("scroll p95", 12) +
      "   note",
  )
  console.log("  " + "─".repeat(74))
  for (const row of r.rows) {
    console.log(
      "  " +
        pad(row.path, 16) +
        lpad(row.mounted, 9) +
        lpad(ms(row.first), 11) +
        lpad(ms(row.p50), 12) +
        lpad(ms(row.p95), 12) +
        (row.note ? "   " + row.note : ""),
    )
  }
}

const streamBench = () => {
  console.log(
    "\n═══ Streaming (append-only, path A) — proves only the tail reparses ═══",
  )
  const source = fixtures()["readme-1k"]
  const CHUNK = 180
  let buffer = ""
  const cache = new Map()
  const inst = render(h(PathA, { lines: [], width: WIDTH, height: HEIGHT }))
  const times = []
  let prevIds = new Set()
  let reparsedTotal = 0
  let steps = 0

  for (let i = 0; i < source.length; i += CHUNK) {
    buffer += source.slice(i, i + CHUNK)
    const t0 = now()
    const blocks = segment(buffer)
    // Blocks whose id we haven't seen before = the ones that (re)parsed meaningfully.
    const ids = new Set(blocks.map((b) => b.id))
    const fresh = [...ids].filter((id) => !prevIds.has(id)).length
    reparsedTotal += fresh
    prevIds = ids
    const layout = createLayout(blocks, WIDTH, cache) // cache persists → unchanged blocks reuse layout
    const lines = sliceLines(layout, Math.max(0, layout.total - HEIGHT), HEIGHT) // follow the tail
    inst.rerender(h(PathA, { lines, width: WIDTH, height: HEIGHT }))
    times.push(now() - t0)
    steps++
  }
  inst.unmount()
  console.log(
    `  ${steps} appends  |  frame p50 ${ms(pct(times, 50))}ms  p95 ${ms(pct(times, 95))}ms  |  ` +
      `avg blocks (re)parsed per append: ${(reparsedTotal / steps).toFixed(2)}  (full reparse would be ${prevIds.size})`,
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log(
  `Ink markdown spike — width ${WIDTH} × height ${HEIGHT}, scroll stride ${STRIDE} lines`,
)
console.log(
  "Measured through ink-testing-library (real Ink reconciler + Yoga; excludes physical TTY write).",
)

const fx = fixtures()
const results = []
for (const [name, source] of Object.entries(fx)) {
  const r = benchFixture(name, source)
  results.push(r)
  printFixture(r)
}

if (process.argv.includes("--stream")) streamBench()
else streamBench()

console.log(
  "\nLegend: A = one pre-composed string · B = one Text per visible line · C = naive full tree",
)
