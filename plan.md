# @kud/ink-markdown — Plan

A high-performance Markdown/code/diff rendering engine for Ink 7. Full spec in
[`prd.md`](./prd.md); this file is the working handoff and records decisions made
**after** the PRD was written. Where the two disagree, this file wins.

A fresh Claude session opened in this folder can continue from here without
re-deriving anything.

---

## Problem

Ink apps that display large, code-heavy, streaming documents (AI responses, code
review, diffs, source files) hit a wall: the common Markdown-for-Ink model parses
the whole document into a React tree, runs Yoga layout over all of it, and re-diffs
the entire output each frame. That cost scales with document size — thousands of
lines, big diffs, and 20 fps streaming make it unusable.

**The ask:** a reusable engine whose rendering cost is bounded to the viewport, good
enough that Markdown/diff rendering stops being a reason to migrate off Ink to
OpenTUI. "As good as OpenTUI" — see the thesis below for what that actually means.

## The performance thesis (the whole bet)

We will **not** make Ink's per-node overhead as cheap as OpenTUI's Zig renderer.
React reconciliation + Yoga sit in the loop; that race is unwinnable on throughput.

Instead we **starve Ink of work**: keep the tree it reconciles and the layout Yoga
runs at `O(viewport)` and _constant_, never `O(document)`. Then Ink's overhead stops
scaling with the document, and the gap to OpenTUI stops mattering. This is exactly
PRD §17 ("no app migrates to OpenTUI _solely_ for Markdown/diff rendering") and the
§19 migration thresholds.

Mechanism: our own engine does parsing + layout + wrapping + highlighting, caches
aggressively, and hands Ink only the visible slice. The most aggressive form hands
Ink a **single pre-composed ANSI string** for the whole viewport (one `<Text>`, one
Yoga node, one diff) — essentially OpenTUI's "compose a buffer" trick smuggled
through Ink.

## Use cases (priority order)

1. Static Markdown in a bounded viewport (README, docs).
2. Scroll a 10k-line document — only viewport + overscan mounted.
3. Stream an AI response at up to 20 fps — completed blocks immutable, only the open
   tail reparsed.
4. Highlighted fenced code — lazy, visible-lines-first.
5. Unified Git diff as a first-class structured block.
6. Custom block renderers (design-system override).

## Scope

**In (v1 target):** block-based parsing with stable identity, width-aware cached
layout, viewport-only Ink rendering, incremental streaming, syntax-highlighted code,
unified diff, theming via semantic tokens, custom renderers, instrumentation.

**Out (v1):** full CommonMark parity, embedded HTML, editing, mouse text selection,
images, LaTeX, OpenTUI renderer, cross-renderer visual identity. See PRD §7.

---

## Decisions (made this session)

- **Package name:** `@kud/ink-markdown` (supersedes the PRD's `@gtv/*` /
  `terminal-markdown-*` names). `@kud/*` publishing is autonomous per project
  conventions.
- **Approach: spike-first.** De-risk the performance thesis with a throwaway
  benchmark spike _before_ committing to the 3-package architecture. The unknown is
  not "can we parse Markdown" — it's "does the pre-composed-string bet actually rival
  OpenTUI and crush naive Ink". Prove or kill it cheaply first.
- **Render path: HYBRID with A as the fast path** (decided by Step 1 spike). Text
  blocks (prose/code/diff — the hot paths) compose to one pre-composed ANSI string →
  single `<Text>`; blocks with a registered custom component escape into real React
  (effectively path B for those). Evidence: path A's per-frame compose cost is **~1.6µs
  and constant in document size**, while it hands Ink strictly the least work (1 node
  vs B's ~56). A and B were performance-equivalent in the harness, so B is a
  _flexibility_ option, not a faster one — the hybrid gets both. Resolves the §10.13
  tension between "one string = fast" and "many elements = flexible".
  - **B — one `<Text>` per visible line:** retained as the escape-hatch mechanism for
    custom-component blocks, not the default.
  - Rejected baseline **C** (full React tree per block): catastrophic — 1.7s first
    paint on the 10k-line doc, 9167 mounted nodes, scroll unmeasurable.
- **Parser:** two-layer. A cheap custom **block segmenter** (line-scan to find
  top-level block boundaries → stable IDs + source hashes + append-only streaming for
  free), then parse _within_ each block with `markdown-it` (sync, fast, battle-tested),
  cached by block hash. Rejected: `remark`/mdast — correct but heavy and hostile to
  incremental reparsing.
- **Highlight then wrap:** highlight the _logical_ line first (full token context),
  then wrap the styled spans by measured display width. Wrapping first breaks
  multiline tokens at wrap points.
- **Highlighter:** start with a _sync_ one (`lowlight` / `highlight.js`) behind the
  `SyntaxHighlighter` interface (PRD §10.8) — no worker complexity in v1. Cache by
  `(codeHash, lang, theme)`, run on visible + overscan only. Add `shiki` + worker
  later only if benchmarks demand it.
- **Wrap defaults:** code/diff → horizontal **clip** (with horizontal scroll, the
  code-review norm); prose → wrap. Configurable.
- **Keyboard:** core exposes scrolling primitives + an optional `MarkdownController`
  hook. Core does not own keybindings.
- **Stack:** TypeScript, ESM only, `tsup` build, `vitest`, Ink 7 + React, exact-pinned
  deps. Node aligned with the product runtime.

## Open questions (revisit after spike)

- Which render path (A vs B) — decided by spike numbers.
- Mono-package (`@kud/ink-markdown` only) vs monorepo (`@kud/ink-markdown-core` +
  `@kud/ink-markdown`)? Lean: start single-package, extract core later via the
  core-extractor pattern if a second surface (OpenTUI) materialises.
- `shiki` vs lightweight sync highlighter for v1 quality/perf trade-off.
- Worker threads / subprocess for highlighting large files (PRD §20).
- How much GFM for v1.
- Diff input: raw text, structured model, or both.
- Viewport anchoring when streamed content changes _above_ the current scroll
  position (PRD §20 — genuinely tricky, needs a rule).
- Layout-cache memory limit / eviction.
- OSC 8 hyperlinks in the initial release.

---

## Next steps

### Step 0 — Retire the make-or-break risk first ✅ DONE

**Question:** does Ink measure a `<Text>` by display width (ANSI-stripped,
Unicode-aware) or by raw string length? If raw length, render-path A is dead.

**Result: DISPLAY WIDTH. Path A is viable.** Probe in
[`spike/step0-ink-measure/`](./spike/step0-ink-measure/) (Ink 7.1.0 + React 19.2.7 +
ink-testing-library 4.0.0), 12/12 assertions passed. Decisive test: a single line of
40 display columns but **840 raw characters** (heavy per-char truecolor ANSI) stayed
**one row** — no spurious wrap. Also confirmed:

- Ink wraps overflow at exactly the display-width boundary (col W), not earlier/later.
- Wide/CJK chars measured at 2 columns each; wrap correct at the column boundary.
- A 10-line pre-composed ANSI string rendered as **one** `<Text>` produced exactly 10
  rows with colour intact — the literal path-A pattern works.
- Bonus: ink-testing-library 4 drives Ink 7 cleanly → our spike test harness is proven.

No workaround (Ink `Transform` / custom `Output`) needed. Run: `npm --prefix
spike/step0-ink-measure run probe`.

### Step 1 — Build the benchmark spike (throwaway)

Scratch dir (not the published package yet). Thinnest vertical slice touching the
whole pipeline:

1. **Segmenter** — line-scan splitting Markdown into top-level blocks with
   `id` + `sourceHash`. Minimal block set: paragraph, heading, fenced code, diff fence.
2. **Layout** — per block → wrapped `LayoutLine`s of styled spans. Include a
   sync-highlighted code path and a unified-diff path.
3. **Two viewport renderers** — A (pre-composed ANSI string → one `<Text>`) and
   B (one `<Text>` per visible line). Plus control **C** (naive full tree, no
   virtualisation) as the baseline to beat.
4. **Harness** — render the fixtures below and drive scroll + a 20 fps streaming feed.

### Step 2 — Fixtures

- 1k-line README, 10k-line technical doc, 5k-line source file, 5k-line unified diff,
  a streaming AI-response replay, a doc with hundreds of small code blocks (PRD §15).

### Step 3 — Measure

- initial parse ms, first-render ms, per-frame time during scroll (p50 / **p95**),
  Ink node count / mounted lines, CPU during scroll, memory, cache-hit ratio.
- Compare **A vs B vs C**, against absolute PRD §13 targets (parse <100ms,
  first render <150ms, scroll p95 <50ms, mounted lines ≈ viewport+overscan).
- **Stretch:** stand up an OpenTUI equivalent for a same-fixture comparison. Optional
  — the primary comparison is A/B/C + absolute targets; don't block on OpenTUI setup.

### Step 4 — Decide & write up

Record the numbers back into this file, pick render path A or B, confirm/adjust the
parser + highlight decisions, then graduate to the real package and PRD Milestone 1
(`@kud/ink-markdown` proper, renderer-independent core model). Route the build through
`/k-project` when the spike has proven the thesis.

**Kill criterion:** if neither A nor B gets scroll p95 under ~50ms on the 10k-line
and 5k-line-diff fixtures with bounded mounted lines, the thesis is wrong — stop and
reassess (OpenTUI from the start, or a different Ink strategy) before building further.

### Step 1 results ✅ (spike in [`spike/step1-bench/`](./spike/step1-bench/))

Harness: `segment → cached layout (sync cli-highlight, coloured unified diff, ANSI-safe
clip) → renderers A/B/C`, driven through ink-testing-library. Run: `npm --prefix
spike/step1-bench run bench`. **Thesis is alive on every axis measurable without a real
TTY.**

- **Parse:** 6.9ms for the 10k-line doc — 14× under the 100ms target. Non-issue.
- **Engine compose/frame (ours, no Ink):** path A slice+join = **~1.6µs, constant in
  document size** (1k→10k identical). The "rebuild the string each frame" worry is
  three orders of magnitude below 1ms. Path A is effectively free on our side.
- **Node count (the O(viewport) win):** A = **1**, B = 56, naive C = **9167** on the
  10k doc. Virtualisation delivers bounded nodes as designed.
- **Naive baseline is catastrophic:** C = **1.7s first paint** on 10k lines, scroll
  unmeasurable. Confirms the whole premise — not-virtualising is the failure mode.
- **Streaming mutable-tail works:** ~**1.65 blocks reparsed per append** vs 219 for a
  full reparse (~99% avoided) over 330 appends.
- **A ≈ B** in the harness → render-path choice is about flexibility, not speed. Picked
  hybrid-with-A (see Decisions).

**Latency — resolved via a separate CPU probe.** ink-testing-library carries a ~26ms
fixed per-rerender floor and rebuilds the whole frame, so its absolute ms are
floor-inflated and useless for latency. `live-tty-probe.js` sidesteps this: it drives a
**real** Ink instance against a fake-TTY sink and measures **CPU time per frame**
(`process.cpuUsage`, which excludes throttle idle). Result: path A = **7.7ms CPU/frame**
(10k doc) / 4.1ms (5k diff), CPU-bound ceiling ~130fps. Since 7.7ms ≪ the ~26ms repaint
throttle, scroll latency is **throttle-bound (~26ms), under the 50ms bar → kill-criterion
PASSED.** (Caveat: real-terminal write adds async I/O, but that's cheap and off the CPU
path.) Everything else ITL could trust — ordering, node counts, parse, engine cost,
streaming — is also green.

**Strategic note — animation + transparency is a DIFFERENT workload (OpenTUI's turf).**
The passing verdict above is for _document scrolling / streaming_: low event rate,
virtualised, bounded work. Continuous animation (30–60fps motion, fades, layered
"transparent" panels) is the opposite regime and is exactly where Ink's ~26ms render
throttle, whole-string diffing, and lack of a cell compositor bite — and where OpenTUI
(real per-cell buffer + alpha compositing in native code) wins. **The design system's
animation/transparency ambition, not markdown rendering, is the real candidate for
driving an OpenTUI decision** (matches PRD §19 migration thresholds). Keep the two
decisions separate.

**Animation ceiling — measured (`anim-probe.js`).** Real Ink, CPU/frame + sustained
paint rate, 100×40:

- **Localised motion** (spinner, progress, moving highlight): **2.97ms CPU/frame** (~337fps
  ceiling), tiny incremental writes — Ink diffs only what changed. ✅ Ink does tasteful
  animation well.
- **Full-screen fade / translucent overlay** (every cell recoloured each frame — the honest
  cost of faking terminal "transparency"): **20.7ms CPU/frame**, **~21 fps** sustained,
  75KB/frame. ❌ Visibly below 60fps; janky. This is OpenTUI-native territory (per-cell
  compositor in compiled code vs our per-cell `bgRgb` + whole-frame string diff in JS).

**"Render less" test (`smart-anim-probe.js`)** — bounded translucent panel (recompute 12
of 40 rows, reuse the rest) vs full-screen fade: CPU **15.7ms vs 22.6ms** (smart React
helps CPU, 44→64fps ceiling) — BUT the panel still **wrote 67KB/frame** (~= full-screen's
74KB). Lesson: the wall isn't render hygiene, it's **visual density** — a frame of 4,000
bg-coloured cells is ~75KB of ANSI to produce+emit in JS, and `React.memo` can't shrink
that (it stops functions re-running, not bytes being written). The cost lives _below_
React.

**Conclusion (refined):** the true variable is **visual density**, not render discipline.

- ✅ **Light** animation — spinners, progress, sliding panels, toasts, colour transitions
  on text (localised change, small frames): cheap + smooth on Ink (~3ms). This is ~90% of
  what a design system needs — the user's "use React smartly, render less" instinct wins here.
- ⚠️ **Bounded translucent panel** (modal/toast over dimmed bg): borderline — 64fps CPU
  ceiling, ~30fps after Ink's throttle. Fine with good easing, not liquid.
- ❌ **Dense full-surface motion** — gradients, blurs, screen-wide shimmer, translucent
  overlays over animated content: OpenTUI-only. Ink has no compositor, no alpha, no
  absolute positioning / z-layers / overlap.

A design system built mainly on light animation → stay on Ink. One built on dense, layered,
translucent motion → genuine **OpenTUI** decision, separate from ink-markdown. The
renderer-independent core (PRD §6.2/§18) means either way, ink-markdown's engine renders
under OpenTUI for ~free if that call is made.

---

## Status

- [x] Name fixed: `@kud/ink-markdown`
- [x] Approach fixed: spike-first, render path decided by measurement
- [x] PRD preserved (`prd.md`), decisions captured (this file)
- [x] Step 0 — Ink measures by display width; **render-path A viable** (12/12 probe)
- [x] Step 1 — spike built + measured; parse/nodes/streaming/engine-cost all green
- [x] Step 4 — render path chosen: **hybrid, path-A fast path**
- [x] **Kill-criterion PASSED** (live-TTY CPU probe): path A **7.7ms CPU/frame** on the
      10k doc, 4.1ms on the 5k diff → throttle-bound (~26ms), well under 50ms. Method:
      `live-tty-probe.js` measures `process.cpuUsage` per frame vs a fake TTY (ITL's
      ~26ms floor makes wall-clock unusable for latency).
- [x] Graduated to `@kud/ink-markdown` package (repo live, kud-site README + docs)

## Build progress (post-spike)

- [x] **Milestone 1 — core document model.** `src/core`: line-scan segmenter, FNV-1a
      content-hash block identity, `create`/`updateMarkdownDocument`. Zero Ink imports.
- [x] **Milestone 2 — terminal layout engine.** `src/core/spans.ts` + `layout.ts`:
      semantic styled spans (not ANSI), display-width-aware span wrapping (Unicode/CJK),
      inline parsing (bold/italic/code/link), block layouts (heading/para/list/quote/hr;
      code plain-clipped, diff prefix-coloured), per-block layout cache (id:width:theme),
      cumulative line index + `sliceLines` + `firstBlockAt`. 22 tests green.
- [ ] **Milestone 3 — Ink viewport.** `<MarkdownViewport>`: path-A composition (spans →
      one ANSI `<Text>`), virtualised visible slice, scroll, resize. **Acceptance demo:
      render a real upstream PR's review comments in an `inbox` detail pane** (data via
      `gh-pr-comments`).
- [ ] Milestone 4 — code syntax highlighting (deferred from M2). Milestone 5 — streaming.
      Milestone 6 — structured diff. Milestone 7 — publish.
