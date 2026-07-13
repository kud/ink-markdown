import { Chalk } from "chalk"
import wrapAnsi from "wrap-ansi"
import sliceAnsi from "slice-ansi"
import stringWidth from "string-width"
import { highlightCode } from "./highlight.js"

// Force truecolor so ANSI is always emitted (representative string sizes + wrap cost),
// regardless of whether stdout is a pipe.
const c = new Chalk({ level: 3 })

// Clip an ANSI string to `width` visual columns without severing escape codes.
const clip = (line, width) =>
  stringWidth(line) > width ? sliceAnsi(line, 0, width) : line

// Minimal inline styling for prose. Bold before italic (bold's ** would otherwise be
// eaten by the single-* italic rule).
const inline = (s) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, (_, x) => c.bold(x))
    .replace(/`([^`]+)`/g, (_, x) => c.yellow(x))
    .replace(/\*([^*]+)\*/g, (_, x) => c.italic(x))
    .replace(/\b_([^_]+)_\b/g, (_, x) => c.italic(x))

const wrap = (text, width) =>
  wrapAnsi(text, Math.max(1, width), { hard: true, trim: false }).split("\n")

const stripFences = (text) => {
  const lines = text.split("\n")
  if (lines[0]?.startsWith("```")) lines.shift()
  if (lines[lines.length - 1]?.startsWith("```")) lines.pop()
  return lines
}

// One block → its visual terminal lines (each an ANSI string ≤ width). This is where
// prose wraps and code/diffs clip. Pure + deterministic → safe to cache by (hash,width).
const layoutBlock = (block, width) => {
  switch (block.type) {
    case "heading": {
      const level = block.text.match(/^#+/)?.[0].length ?? 1
      const t = block.text.replace(/^#{1,6}\s+/, "")
      const styled = level <= 1 ? c.bold.cyan(t) : c.bold.blue(t)
      return wrap(styled, width)
    }
    case "hr":
      return [c.dim("─".repeat(width))]
    case "quote": {
      const body = block.text.replace(/^>\s?/gm, "")
      return wrap(inline(body.split("\n").join(" ")), width - 2).map(
        (l) => c.dim("│ ") + l,
      )
    }
    case "list": {
      const out = []
      for (const raw of block.text.split("\n")) {
        const m = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/)
        if (!m) continue
        const marker = c.cyan("•")
        const wrapped = wrap(inline(m[3]), width - 2)
        wrapped.forEach((l, i) => out.push((i === 0 ? marker + " " : "  ") + l))
      }
      return out
    }
    case "code": {
      const body = stripFences(block.text).join("\n")
      const hi = highlightCode(body, block.lang).split("\n")
      const gw = String(hi.length).length
      return hi.map((ln, i) =>
        clip(c.dim(String(i + 1).padStart(gw) + " │ ") + ln, width),
      )
    }
    case "diff": {
      const body =
        block.lang === "diff" ? stripFences(block.text) : block.text.split("\n")
      return body.map((ln) => {
        let styled = ln
        if (/^(diff --git|index |similarity |rename )/.test(ln))
          styled = c.bold(ln)
        else if (/^(\+\+\+|---)/.test(ln)) styled = c.bold(ln)
        else if (ln.startsWith("@@")) styled = c.cyan(ln)
        else if (ln.startsWith("+")) styled = c.green(ln)
        else if (ln.startsWith("-")) styled = c.red(ln)
        else styled = c.dim(ln)
        return clip(styled, width)
      })
    }
    default:
      return wrap(inline(block.text.split("\n").join(" ")), width)
  }
}

// Build the full document layout for a given width. Every block is laid out once and
// cached by (sourceHash, width); scroll never recomputes. Produces a flat `allLines`
// array (O(1) slicing) plus per-block cumulative offsets (the log-n first-visible-block
// index the real engine would binary-search). The flat array holds STRINGS, not React
// nodes — memory scales with source, node count does not.
export const createLayout = (blocks, width, cache = new Map()) => {
  const allLines = []
  const offsets = []
  let reused = 0
  let computed = 0

  for (const b of blocks) {
    const key = `${b.sourceHash}:${width}`
    let lines = cache.get(key)
    if (lines) reused++
    else {
      lines = layoutBlock(b, width)
      cache.set(key, lines)
      computed++
    }
    offsets.push(allLines.length)
    for (const l of lines) allLines.push(l)
  }

  return {
    allLines,
    offsets,
    total: allLines.length,
    width,
    cache,
    reused,
    computed,
  }
}

// Binary search: first block whose cumulative offset ≤ line. Demonstrates the log-n
// first-visible-block requirement (unused by the flat slice below, but this is the shape
// the real engine uses when it doesn't flatten).
export const firstBlockAt = (layout, line) => {
  const { offsets } = layout
  let lo = 0
  let hi = offsets.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= line) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

export const sliceLines = (layout, offset, height) => {
  const start = Math.max(
    0,
    Math.min(offset, Math.max(0, layout.total - height)),
  )
  return layout.allLines.slice(start, start + height)
}
