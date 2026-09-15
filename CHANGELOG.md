# Changelog

All notable changes to this project are documented here.

---

## 0.3.1 — 2026-09-15

### Fixes

- A theme colour given as a hex value, such as `#FF8C00`, now actually renders instead of coming out unstyled. `MarkdownTheme` accepts the same strings Ink's `<Text color>` does — names and hexes alike — but the ANSI composer looked up every colour as a Chalk property, and a hex isn't one, so it silently resolved to nothing. Hexes now route through `chalk.hex()` / `chalk.bgHex()`. Found via cockpit's ticket drill, whose orange links and cyan inline code had been rendering plain since the theme was introduced. ([ee1a531](https://github.com/kud/ink-markdown/commit/ee1a5319edb1312baa7dfd76f60369c2e0825466))

---

## 0.3.0 — 2026-09-11

### Highlights

- Pipe tables now render as a proper block instead of being flattened into a run of piped-together text. Two or more consecutive `| … |` lines are recognised as a `table` — a lone pipe-delimited line still reads as prose. Columns pad to their widest cell and are joined by two spaces with no vertical rule; the separator row becomes a single muted `─` segment per column beneath a bold, heading-coloured header, and `---:` right-aligns a column. Every row stays on one line: when a table would overflow the viewport, its widest column shrinks first (ending in `…`, never below its header's width), and only once every column is at its floor does a row clip like an ordinary code line — no column disappears silently. Empty cells stay blank, including a blank leading header cell for a row-label column, and inline markup still works inside cells. ([0d383d2](https://github.com/kud/ink-markdown/commit/0d383d2507666650e935f33a7d449a4c835d3381))
- Link text may now contain one level of nested square brackets, such as `[[TAP] Flowthrough → Restore](https://…)` — the shape Jira produces for ticket-prefixed titles. The inline parser previously failed to match this pattern and left the whole thing rendered as raw markup instead of a link. ([0d383d2](https://github.com/kud/ink-markdown/commit/0d383d2507666650e935f33a7d449a4c835d3381))

---

## 0.2.0 — 2026-09-11

### Highlights

- Blocks in a rendered document now get a blank line between them — a bold paragraph standing in for a heading no longer runs straight into the list beneath it. Lists stay tight internally, code fences stay whole, and thematic breaks get air on both sides; the spacing is computed at document level, so viewport scrolling and per-block layout stay correct. Line counts in any test that snapshots them will shift accordingly. ([cf4093a](https://github.com/kud/ink-markdown/commit/cf4093a834cadacef782b2378bab561b5ab00fd6))
- Bare `http(s)://` URLs are now recognised and styled as links automatically, matching the look of an explicit `[text](url)`. Trailing punctuation and a wrapping closing parenthesis are kept outside the link, and an explicit link around a URL still takes precedence. ([cf4093a](https://github.com/kud/ink-markdown/commit/cf4093a834cadacef782b2378bab561b5ab00fd6))

---
