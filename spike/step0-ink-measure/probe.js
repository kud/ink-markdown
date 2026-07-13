// Step 0 probe — does Ink measure a <Text> by DISPLAY width (ANSI-stripped,
// Unicode-aware) or by RAW string length? If raw length, render-path A (feed Ink one
// pre-composed ANSI string per viewport) is dead on arrival, because coloured code
// would wrap spuriously. Decisive signal in every test: the OUTPUT LINE COUNT.
//
// No JSX (no build step). ink-testing-library renders to a string frame with no TTY.

import React from "react"
import { Box, Text } from "ink"
import { render } from "ink-testing-library"
import { Chalk } from "chalk"
import stringWidth from "string-width"

const h = React.createElement
const W = 40 // fixed viewport width

// Force truecolor so ANSI is emitted regardless of TTY / pipe. Without this, chalk
// silently drops to level 0 under a pipe and the ANSI-density tests prove nothing.
const c = new Chalk({ level: 3 })

const ANSI = /\[[0-9;]*m/g
const strip = (s) => s.replace(ANSI, "")
const hasAnsi = (s) =>
  ANSI.test(s.replace(ANSI, (m) => ((ANSI.lastIndex = 0), m))) || s !== strip(s)

// Split a frame into its visual rows, dropping trailing blank rows only.
const rows = (frame) => {
  const out = frame.split("\n")
  while (out.length && strip(out[out.length - 1]).trim() === "") out.pop()
  return out
}

const frameOf = (element) => {
  const { lastFrame, unmount } = render(element)
  const f = lastFrame()
  unmount()
  return f
}

const view = (content, { width = W, wrap = "wrap" } = {}) =>
  h(Box, { width }, h(Text, { wrap }, content))

// A line of `n` visible chars, each wrapped in its own truecolor code pair.
// Display width = n; raw length ≈ n * ~20. This is the raw-vs-display discriminator.
const heavy = (n) =>
  Array.from({ length: n }, (_, i) =>
    c.rgb(
      i % 2 ? 255 : 0,
      i % 2 ? 0 : 255,
      0,
    )(String.fromCharCode(97 + (i % 26))),
  ).join("")

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`,
  )
}

// ── Test 1: plain multiline that fits — newlines respected, no wrap ───────────
{
  const input = ["alpha", "beta", "gamma"]
  const r = rows(frameOf(view(input.join("\n"))))
  check("1 plain-fits: 3 in → 3 out", r.length === 3, `got ${r.length} rows`)
}

// ── Test 2: 8 heavy-ANSI lines, each exactly W visible — no wrap, ANSI kept ───
{
  const input = Array.from({ length: 8 }, () => heavy(W)).join("\n")
  const f = frameOf(view(input))
  const r = rows(f)
  const widths = r.map((l) => stringWidth(strip(l).replace(/\s+$/, "")))
  const allW = widths.every((w) => w === W)
  check(
    "2 heavy-ANSI×8 @W: 8 in → 8 out",
    r.length === 8,
    `got ${r.length} rows`,
  )
  check("2b every row display-width == W", allW, `widths=${widths.join(",")}`)
  check("2c ANSI preserved in frame", hasAnsi(f), "frame carries escape codes")
}

// ── Test 3: THE discriminator — 1 line, W visible chars, raw length huge ──────
{
  const input = heavy(W) // display width W, raw length ~W*20
  const raw = input.length
  const r = rows(frameOf(view(input)))
  check(
    "3 DISCRIMINATOR 1 line W-visible, raw≫W → stays 1 row",
    r.length === 1,
    `raw=${raw} chars, displayWidth=${stringWidth(strip(input))}, got ${r.length} rows`,
  )
}

// ── Test 4: overflow control — plain line W+15, must wrap at display boundary ─
{
  const input = "x".repeat(W + 15)
  const r = rows(frameOf(view(input)))
  const firstW = r.length ? stringWidth(strip(r[0]).replace(/\s+$/, "")) : 0
  check(
    "4 plain overflow W+15 → wraps to 2 rows",
    r.length === 2,
    `got ${r.length} rows`,
  )
  check(
    "4b wrap boundary is exactly W",
    firstW === W,
    `first row width=${firstW}`,
  )
}

// ── Test 5: wide chars (CJK width 2) summing to exactly W — no wrap ───────────
{
  const input = "一".repeat(W / 2) // 20 chars × width 2 = 40 cols
  const r = rows(frameOf(view(input)))
  const w0 = r.length ? stringWidth(strip(r[0]).replace(/\s+$/, "")) : 0
  check(
    "5 wide-chars == W cols → 1 row",
    r.length === 1,
    `got ${r.length} rows, width=${w0}`,
  )
}

// ── Test 6: wide-char overflow — 21 CJK = 42 cols > W — must wrap ─────────────
{
  const input = "一".repeat(W / 2 + 1) // 42 cols
  const r = rows(frameOf(view(input)))
  const w0 = r.length ? stringWidth(strip(r[0]).replace(/\s+$/, "")) : 0
  check(
    "6 wide-chars 42 cols → wraps to 2 rows",
    r.length === 2,
    `got ${r.length} rows`,
  )
  check("6b wide wrap first row width <= W", w0 <= W, `first row width=${w0}`)
}

// ── Test 7: PATH-A PATTERN — whole viewport as ONE pre-composed string ────────
{
  const n = 10
  const input = Array.from({ length: n }, (_, i) =>
    heavy((i % (W - 5)) + 3),
  ).join("\n")
  const f = frameOf(view(input))
  const r = rows(f)
  check(
    "7 PATH-A: 10-line ANSI string as ONE <Text> → 10 rows",
    r.length === n,
    `got ${r.length} rows`,
  )
  check(
    "7b PATH-A ANSI preserved",
    hasAnsi(f),
    "single-string viewport keeps colour",
  )
}

// ── Verdict ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.pass)
console.log("\n" + "─".repeat(60))
const discriminator = results.find((r) => r.name.startsWith("3 "))
const pathA = results.filter((r) => r.name.startsWith("7")).every((r) => r.pass)
console.log(
  `Ink version measures by: ${discriminator.pass ? "DISPLAY WIDTH (ANSI-aware) ✓" : "RAW LENGTH ✗"}`,
)
console.log(
  `Render-path A (one pre-composed ANSI string) viable: ${discriminator.pass && pathA ? "YES" : "NO"}`,
)
console.log(
  `${results.length - failed.length}/${results.length} assertions passed`,
)
console.log("─".repeat(60))
process.exit(failed.length ? 1 : 0)
