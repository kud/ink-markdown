# Product Requirements Document — Optimised Markdown Renderer for Ink

> Verbatim PRD as authored. `plan.md` is the working handoff and takes precedence
> where the two diverge (it records decisions made after this PRD was written).
> Published package name: **`@kud/ink-markdown`** (the PRD's `@gtv/*` / `terminal-markdown-*`
> names are superseded — see plan.md §Decisions).

## 1. Product name

Working name:

`@gtv/ink-markdown`

Alternative names:

- `ink-markdown-engine`
- `ink-document`
- `ink-md`
- `terminal-markdown`

## 2. Summary

Build a high-performance Markdown rendering engine for Ink 7, designed for persistent terminal applications displaying large, dynamic and code-heavy documents.

The renderer must support:

- large Markdown documents;
- source-code blocks;
- Git diffs;
- streaming AI-generated content;
- viewport-based rendering;
- incremental parsing and layout;
- syntax highlighting;
- custom design-system components;
- alternate-screen Ink applications.

The product should avoid rendering the entire Markdown document as a large React tree. It should instead parse content into stable blocks, calculate terminal-oriented layouts, cache results and mount only the lines visible inside the current viewport.

## 3. Context

Existing Markdown renderers for Ink commonly follow a straightforward model:

```text
Markdown source
→ parse complete document
→ create complete React tree
→ run Yoga layout
→ render complete terminal output
```

This approach is acceptable for small static documents, but becomes expensive when applications display:

- thousands of lines;
- numerous code blocks;
- large Git diffs;
- continuously streamed content;
- multiple panels;
- frequently changing selections;
- terminal resizes;
- syntax-highlighted source code.

The current product ecosystem is built primarily with Ink 7 using alternate-screen rendering. Ink is currently stable and performant enough, but code and diff rendering are likely to become the main scalability constraint.

The purpose of this project is to extend the useful performance envelope of Ink before considering a migration to a different terminal renderer such as OpenTUI.

## 4. Problem statement

Ink applications currently lack a reusable Markdown engine optimised for:

1. large documents;
2. code-oriented content;
3. incremental updates;
4. virtualised scrolling;
5. terminal-specific layout;
6. streaming output.

Naïve Markdown renderers often:

- reparse the entire document after each update;
- recalculate wrapping for every block;
- mount one React component per Markdown node or syntax token;
- highlight code that is outside the viewport;
- recreate large React trees during scrolling;
- perform unnecessary work when only the final streaming block changes.

This can result in:

- high CPU usage;
- input latency;
- slow scrolling;
- delayed rendering during streaming;
- excessive memory consumption;
- flickering or inconsistent frame times;
- poor performance on large diffs.

## 5. Product vision

Provide a terminal-native Markdown document engine that allows Ink applications to render rich, code-heavy documents with predictable performance.

The engine should make this possible:

```tsx
<MarkdownViewport
  source={content}
  width={width}
  height={height}
  scrollOffset={scrollOffset}
/>
```

without requiring the consuming application to manage:

- Markdown parsing;
- block measurement;
- text wrapping;
- viewport slicing;
- syntax-highlight caching;
- streaming reconciliation;
- diff parsing;
- line-level rendering.

## 6. Goals

### 6.1 Primary goals

- Render only the lines visible in the viewport.
- Parse Markdown into stable, independently cacheable blocks.
- Avoid reparsing unchanged blocks.
- Avoid recalculating layout when content and width are unchanged.
- Support incremental streaming updates.
- Support syntax-highlighted fenced code blocks.
- Support first-class Git diff rendering.
- Integrate cleanly with an existing Ink design system.
- Provide predictable keyboard and scrolling integration.
- Remain usable in alternate-screen Ink applications.
- Expose performance instrumentation.

### 6.2 Secondary goals

- Make the core parsing and layout engine renderer-independent.
- Allow a future OpenTUI renderer without redesigning the document model.
- Support custom block renderers.
- Support custom themes and semantic design tokens.
- Support copying and text selection at a later stage.
- Provide reusable primitives for code-review and agent products.

## 7. Non-goals

The first version will not attempt to provide:

- a full web-compatible Markdown renderer;
- arbitrary embedded HTML;
- browser-style CSS;
- complete CommonMark edge-case parity;
- bidirectional text editing;
- a full Markdown editor;
- rich mouse-based text selection;
- image rendering;
- LaTeX rendering;
- embedded interactive widgets inside Markdown;
- identical rendering across Ink and OpenTUI;
- universal abstraction over every terminal framework.

The first version is a document viewer, not an editor.

## 8. Target users

### 8.1 Primary users

Developers building Ink applications that display:

- AI responses;
- code review results;
- Git diffs;
- source files;
- diagnostics;
- documentation;
- command output;
- issue or pull-request descriptions.

### 8.2 Internal use cases

- GTV developer tools;
- GitHub-oriented CLI products;
- MCP clients;
- coding agents;
- terminal-based review tools;
- dashboards showing structured technical content.

## 9. Core use cases

### Use case 1 — Render a static Markdown document

An application provides a Markdown string and displays it within a bounded viewport.

```tsx
<MarkdownViewport source={readme} width={80} height={30} />
```

### Use case 2 — Scroll through a large document

The document may contain tens of thousands of logical lines. Only visible lines and a small overscan region are mounted in Ink.

### Use case 3 — Stream an AI response

New text fragments are appended continuously.

Completed blocks remain immutable. Only the final open block is reparsed and relaid out until it becomes complete.

### Use case 4 — Display highlighted code

Fenced code blocks are syntax highlighted using a configurable highlighter.

Highlighting should occur lazily and preferably only when a code block approaches the viewport.

### Use case 5 — Display a Git diff

A fenced `diff` block or structured diff object is rendered using a dedicated diff model.

The renderer supports:

- additions;
- deletions;
- context lines;
- hunk headers;
- file headers;
- line numbers;
- selected lines;
- collapsed unchanged sections.

### Use case 6 — Customise rendering

Applications can replace default renderers for:

- headings;
- paragraphs;
- links;
- code blocks;
- diffs;
- tables;
- lists;
- quotes.

## 10. Functional requirements

## 10.1 Markdown parsing

The engine must parse at minimum:

- headings;
- paragraphs;
- emphasis;
- strong text;
- inline code;
- fenced code blocks;
- ordered lists;
- unordered lists;
- block quotes;
- thematic breaks;
- links;
- tables;
- task-list items;
- GitHub-flavoured Markdown where practical.

Each top-level block must have a stable identity.

```ts
interface MarkdownBlock {
  id: string
  type: MarkdownBlockType
  sourceStart: number
  sourceEnd: number
  sourceHash: string
}
```

Block identity should remain stable when unrelated sections of the document change.

## 10.2 Document model

The parser must produce a renderer-independent document model.

```ts
interface MarkdownDocument {
  version: number
  blocks: readonly MarkdownBlock[]
  sourceLength: number
}
```

The model must not contain Ink components or React elements.

## 10.3 Layout engine

The layout engine must convert blocks into terminal lines.

```ts
interface BlockLayout {
  blockId: string
  width: number
  height: number
  lines: readonly LayoutLine[]
}
```

A layout line contains one or more styled spans.

```ts
interface LayoutLine {
  id: string
  spans: readonly TextSpan[]
  plainText: string
  displayWidth: number
}
```

Layout must correctly account for:

- terminal width;
- ANSI styling;
- Unicode width;
- wide characters;
- indentation;
- list markers;
- quote prefixes;
- line numbers;
- code wrapping;
- diff prefixes.

## 10.4 Layout caching

Layouts must be cached using at least:

- block identity;
- source hash;
- available width;
- theme identity;
- renderer options.

Example cache key:

```text
blockId:sourceHash:width:themeId:optionsHash
```

Changing selection or scroll offset must not invalidate unrelated layouts.

## 10.5 Viewport virtualisation

The Ink renderer must mount only:

- visible lines;
- configurable overscan above the viewport;
- configurable overscan below the viewport.

```ts
interface ViewportOptions {
  offset: number
  height: number
  overscan?: number
}
```

The engine must maintain an index mapping document line offsets to block layouts.

Finding the first visible block should be no worse than logarithmic in the number of blocks.

## 10.6 Incremental document updates

When the source changes, the engine must:

1. detect unchanged blocks;
2. preserve their block identities;
3. reuse cached layouts;
4. invalidate only changed blocks;
5. recalculate cumulative offsets only where necessary.

For append-only streaming, the engine should avoid reparsing the entire document.

## 10.7 Streaming support

The streaming API should support incremental appends.

```ts
const stream = createMarkdownStream()

stream.append(fragment)
stream.complete()
```

The engine should conceptually distinguish:

```text
completed blocks → immutable
open final block → mutable
incoming buffer  → pending
```

Only the mutable tail should normally be reparsed.

The renderer may debounce or batch very small incoming fragments to maintain stable frame times.

## 10.8 Syntax highlighting

The engine must support configurable syntax highlighting for fenced code blocks.

```ts
interface SyntaxHighlighter {
  highlight(input: {
    code: string
    language?: string
    theme: string
  }): Promise<HighlightedCode> | HighlightedCode
}
```

Requirements:

- lazy highlighting;
- cache by code hash, language and theme;
- adjacent spans with identical styles should be merged;
- only visible code lines should become Ink elements;
- unsupported languages should degrade to plain text;
- highlighting failures must not prevent document rendering.

## 10.9 Diff rendering

Diffs should be treated as first-class structured blocks rather than ordinary coloured text.

```ts
interface DiffBlock {
  type: "diff"
  files: readonly DiffFile[]
}
```

The first version must support unified diff rendering.

Potential later support:

- side-by-side rendering;
- synchronised columns;
- inline word-level changes;
- review comments;
- diagnostics;
- file-tree navigation.

## 10.10 Tables

Tables should support:

- fixed terminal width;
- column sizing;
- truncation;
- optional wrapping;
- header styling;
- horizontal clipping or fallback rendering.

When a table cannot fit, the renderer should degrade predictably rather than corrupting the layout.

## 10.11 Links

Links should support:

- styled label;
- optional URL display;
- OSC 8 terminal hyperlinks where supported;
- fallback plain-text rendering.

## 10.12 Theming

The renderer must consume semantic tokens rather than hard-coded colours.

```ts
interface MarkdownTheme {
  foreground: string
  muted: string
  heading: string
  link: string
  inlineCode: string
  codeBackground?: string
  quote: string
  border: string
  added: string
  removed: string
  context: string
  selectedBackground?: string
}
```

The theme API should integrate with the wider Ink design system.

## 10.13 Custom renderers

Applications must be able to override individual block renderers.

```tsx
<MarkdownViewport
  source={source}
  components={{
    heading: CustomHeading,
    code: ProductCodeBlock,
    diff: ReviewDiffBlock,
    link: ProductLink,
  }}
/>
```

Custom renderers should receive prepared layouts or models where practical, rather than raw Markdown AST nodes.

## 10.14 Scrolling

The renderer must support controlled scrolling.

```tsx
<MarkdownViewport scrollOffset={offset} onScrollOffsetChange={setOffset} />
```

Supported operations:

- line up;
- line down;
- page up;
- page down;
- document start;
- document end;
- jump to block;
- jump to heading;
- ensure selected line is visible.

Keyboard handling may be provided by a separate controller hook.

## 10.15 Resize handling

When terminal width changes:

- parsing must not rerun;
- only width-dependent layouts must be invalidated;
- syntax highlighting should remain cached;
- viewport position should remain stable where possible.

## 10.16 Instrumentation

The engine must expose development metrics.

```ts
interface MarkdownMetrics {
  parseDurationMs: number
  layoutDurationMs: number
  visibleRenderDurationMs: number
  blocksParsed: number
  blocksReused: number
  layoutsCalculated: number
  layoutsReused: number
  mountedLines: number
  totalDocumentLines: number
}
```

Metrics should be accessible through callbacks or development tooling.

## 11. Proposed package structure

```text
packages/
├── terminal-markdown-core/
│   ├── parser/
│   ├── document/
│   ├── blocks/
│   ├── layout/
│   ├── wrapping/
│   ├── viewport/
│   ├── streaming/
│   ├── syntax/
│   ├── diff/
│   └── metrics/
│
├── terminal-markdown-ink/
│   ├── MarkdownViewport.tsx
│   ├── MarkdownLine.tsx
│   ├── MarkdownController.ts
│   ├── hooks/
│   ├── components/
│   └── themes/
│
└── terminal-markdown-test-fixtures/
    ├── markdown/
    ├── code/
    ├── diffs/
    └── snapshots/
```

Possible future package:

```text
terminal-markdown-opentui/
```

## 12. Public API proposal

### Basic rendering

```tsx
import { MarkdownViewport } from "@gtv/terminal-markdown-ink"

;<MarkdownViewport
  source={content}
  width={width}
  height={height}
  scrollOffset={scrollOffset}
/>
```

### Document preparation

```ts
import {
  createMarkdownDocument,
  createMarkdownLayout,
} from "@gtv/terminal-markdown-core"

const document = createMarkdownDocument(source)

const layout = createMarkdownLayout(document, {
  width,
  theme,
})
```

### Prepared layout rendering

```tsx
<MarkdownViewport layout={layout} height={height} scrollOffset={scrollOffset} />
```

### Streaming

```tsx
const stream = useMarkdownStream()

useEffect(() => {
  stream.append(chunk)
}, [chunk])

;<MarkdownViewport document={stream.document} width={width} height={height} />
```

### Custom components

```tsx
<MarkdownViewport
  source={content}
  components={{
    code: CodeViewer,
    diff: DiffViewer,
    table: TableViewer,
  }}
/>
```

## 13. Performance requirements

The following targets apply to representative development machines.

### 13.1 Static documents

For a 10,000-line Markdown document:

- initial parse: under 100 ms preferred;
- first visible render: under 150 ms preferred;
- mounted lines: no more than viewport height plus overscan;
- scrolling input latency: under 50 ms at p95;
- no full-document React tree.

### 13.2 Streaming

For content appended at up to 20 updates per second:

- no complete-document reparse;
- no complete-document relayout;
- stable interaction while streaming;
- updates may be batched to a configurable frame limit.

### 13.3 Code and diffs

For a 5,000-line code or diff block:

- syntax highlighting must not block the UI indefinitely;
- visible lines should render before non-visible lines are processed;
- scrolling should not remount the entire block;
- cached highlighting should survive viewport changes.

### 13.4 Memory

Memory use should scale primarily with:

- source size;
- parsed block model;
- cached layouts;
- highlighted code.

React element count should scale with viewport size rather than document size.

## 14. Quality requirements

- Full TypeScript types.
- ESM support.
- Ink 7 support.
- Node.js support aligned with the main product runtime.
- Deterministic snapshot tests.
- Unicode-width tests.
- Resize tests.
- Streaming tests.
- Large-document benchmarks.
- No unhandled parsing or highlighting failures.
- Graceful fallback for unsupported syntax.
- No hard dependency on a specific design system.

## 15. Testing strategy

### Unit tests

- block parsing;
- stable block identities;
- incremental block replacement;
- line wrapping;
- Unicode width;
- layout cache invalidation;
- viewport slicing;
- diff parsing;
- syntax-span merging;
- streaming tail updates.

### Integration tests

- Markdown to visible terminal output;
- scrolling across block boundaries;
- resize preservation;
- custom component rendering;
- code block loading;
- malformed Markdown;
- incomplete fenced blocks during streaming.

### Performance tests

Fixtures:

- 1,000-line README;
- 10,000-line technical document;
- 5,000-line source file;
- 5,000-line unified diff;
- streaming AI response;
- document containing hundreds of small code blocks.

Metrics:

- parse time;
- layout time;
- frame time;
- CPU during scrolling;
- memory;
- React node count;
- cache-hit ratio.

## 16. Milestones

### Milestone 1 — Core document model

Deliver:

- Markdown parser;
- stable block model;
- paragraphs;
- headings;
- lists;
- quotes;
- fenced code;
- basic tests.

Exit criterion:

A document can be parsed into stable top-level blocks without any Ink dependency.

### Milestone 2 — Terminal layout engine

Deliver:

- terminal wrapping;
- styled spans;
- block layouts;
- Unicode width handling;
- layout cache;
- cumulative block index.

Exit criterion:

A document can be converted into terminal lines for a given width.

### Milestone 3 — Ink viewport renderer

Deliver:

- virtualised visible-line rendering;
- overscan;
- controlled scrolling;
- resize support;
- default theme.

Exit criterion:

A 10,000-line document mounts only viewport-sized Ink content.

### Milestone 4 — Code rendering

Deliver:

- fenced code detection;
- syntax-highlighter adapter;
- lazy highlighting;
- highlighting cache;
- line numbers;
- code wrapping options.

Exit criterion:

Large code blocks remain responsive while scrolling.

### Milestone 5 — Streaming Markdown

Deliver:

- append API;
- mutable-tail parser;
- update batching;
- incomplete-block handling;
- streaming benchmarks.

Exit criterion:

Appending content does not trigger full-document parsing or layout.

### Milestone 6 — Diff support

Deliver:

- unified-diff parser;
- structured diff model;
- addition, deletion and context styles;
- line numbers;
- collapsed context ranges;
- selected-line support.

Exit criterion:

Large diffs can be navigated with stable input latency.

### Milestone 7 — Public package

Deliver:

- documentation;
- examples;
- benchmark report;
- API stabilisation;
- semantic versioning;
- npm publication.

## 17. Success metrics

The project is successful when:

- code-oriented Ink products no longer require ad hoc Markdown implementations;
- documents with thousands of lines remain responsive;
- React node count remains proportional to viewport size;
- streaming content does not reparse the full document;
- the renderer supports the existing design system;
- at least two internal applications adopt it;
- no application needs to migrate to OpenTUI solely because of Markdown or diff rendering;
- the core engine remains reusable by another renderer.

## 18. Risks

### Risk 1 — Overengineering

The project could become a general-purpose document framework before supporting the core use cases.

Mitigation:

Prioritise paragraphs, code, diffs, streaming and viewport rendering.

### Risk 2 — Renderer abstraction becomes restrictive

Attempting to support Ink and OpenTUI immediately could force the API towards the lowest common denominator.

Mitigation:

Keep the core renderer-independent, but optimise the first view implementation specifically for Ink.

### Risk 3 — Syntax highlighting dominates performance

Parsing or highlighting large files may remain expensive even with virtualised rendering.

Mitigation:

Use lazy highlighting, caching, worker processes where appropriate and plain-text fallback.

### Risk 4 — Terminal width correctness

Unicode, emojis, tabs and ANSI styles can produce incorrect measurements.

Mitigation:

Centralise terminal-width calculations and maintain dedicated fixtures.

### Risk 5 — Streaming parser complexity

Incremental Markdown parsing is more difficult than append-only text rendering, especially around incomplete fences and lists.

Mitigation:

Treat completed blocks as immutable and allow the final open region to be reparsed conservatively.

### Risk 6 — Ink itself becomes the bottleneck

Even an optimised document engine may eventually encounter React, Yoga or terminal-rendering limits.

Mitigation:

Maintain renderer-independent document and layout models, performance benchmarks and clear migration thresholds.

## 19. Migration thresholds towards OpenTUI

OpenTUI should be reconsidered when measured evidence shows one or more of the following:

- p95 input latency remains above 50–100 ms despite virtualisation;
- large code or diff views require unacceptable CPU usage;
- Yoga layout becomes a dominant cost;
- React reconciliation dominates frame time;
- multiple independently scrolling panes cannot remain responsive;
- mouse-heavy interaction becomes a core requirement;
- native OpenTUI code or diff components substantially reduce product complexity.

A migration should be driven by benchmark evidence rather than anticipated limitations.

## 20. Open questions

- Which Markdown parser provides the best balance between correctness and incremental reparsing?
- Should syntax highlighting run in the main process, worker threads or a subprocess?
- Should line wrapping happen before or after syntax highlighting?
- Should code blocks default to wrapping or horizontal clipping?
- How much GFM compatibility is required for version one?
- Should unified diffs be accepted as raw text, structured models or both?
- How should viewport anchoring behave after streamed content changes above the current position?
- Should the package own keyboard navigation, or expose only scrolling primitives?
- Which parts belong to the design system rather than the Markdown engine?
- Should layout caches have a configurable memory limit?
- Is OSC 8 hyperlink support desirable in the initial release?

## 21. Initial recommendation

Build the first version around four differentiating capabilities:

1. block-based document parsing;
2. width-aware cached layout;
3. viewport-only Ink rendering;
4. incremental streaming updates.

Code highlighting and unified diff support should follow immediately afterwards, since they represent the principal product use cases and the most likely performance constraints.
