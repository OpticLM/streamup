# @opticlm/streamup

A headless React streaming markdown renderer. Pass it a Markdown string — change that string as often as you like — and it renders the HTML. No wrappers, no overrides to maintain: the output is plain semantic HTML you can style with [shadcn/typeset](https://ui.shadcn.com/docs/typeset).

Markdown is parsed by [Words](https://diffs.com/words), Pierre's streaming Markdown renderer written in WebAssembly.

## Install

```sh
pnpm add @opticlm/streamup react react-dom
```

## Usage

```tsx
// Static
<Streamup>{'# Hello **world**'}</Streamup>

// Streaming: heal incomplete markdown and reveal it with an adaptive typewriter
<Streamup streaming>
  {'**bold text without a closing'}
</Streamup>
```

Wrap it in a styled container and the inner HTML is plain semantic elements:

```tsx
;<div className="typeset typeset-docs">
  <Streamup streaming>{markdown}</Streamup>
</div>
```

## Adaptive typewriter pacing

When `streaming` is on, `Streamup` reveals the document with an adaptive "typewriter" instead of dumping each network chunk as it arrives. Incoming text goes into a buffer decoupled from the UI; a scheduled consumer drains it every `tickMs` (default 33 ms ≈ 30 fps), so the visual output rate stays relatively constant regardless of how bursty or stalled the network is.

The drain rate adapts to the buffer depth (measured in code points):

| Buffer       | Rate      | Default                     | Why                                                                            |
| ------------ | --------- | --------------------------- | ------------------------------------------------------------------------------ |
| `< low`      | `slowCps` | 15 cps (≈ 1 char / 2 ticks) | Network stalled — slow down to stretch the remaining tokens and mask the pause |
| `low`…`high` | `normCps` | 30 cps (≈ 1 cp / tick)      | Steady typewriter cadence                                                      |
| `>= high`    | `fastCps` | 120 cps (≈ 4 cp / tick)     | Burst arrived — speed up to catch up                                           |

With `scaleFast` (default on), `fastCps` is multiplied by `min(10, buffer / high)` so a large backlog drains in bounded time — without it, a fast model delivering 200–600 cps would outpace 120 cps and the UI would lag ever further behind completion. Fractional cp/tick rates (e.g. 0.5 cp/tick) are realized with a credit accumulator, and emission advances by code point so an emoji is never split across frames.

When `streaming` flips to `false` the buffer flushes instantly — the full document is shown at once, healing off. Pass `pacing={false}` (or `tickMs <= 0`) to disable pacing entirely and render every change synchronously. Tune the bucket with an object:

```tsx
;<Streamup streaming pacing={{ tickMs: 16, normCps: 60, fastCps: 200 }}>
  {markdown}
</Streamup>
```

Internally a Words session renders the revealed text to HTML, keeping completed blocks and reparsing only the unfinished end. Streamup splits that HTML into its top-level blocks (paragraphs, code, lists, …) and caches the React element of each, so per-tick cost stays flat as the buffer grows. Once a footnote or link reference definition appears, Words renders the whole document on every tick; unchanged blocks still come from the cache.

While streaming, a code fence that hasn't closed yet renders as `<pre data-markdown-incomplete>`, and a link still waiting for its URL as `<a data-markdown-incomplete>`, in case you want to style them.

## Code blocks

Inline code is native `<code>`. Every fenced code block renders through `components['code-block']`, which receives the block in the shape Words hands its own code plugins (`CodeOptions`):

| Prop           | Type      | Description                                                                                                   |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `code`         | `string`  | The block's lines, each ending with LF. While the fence streams, its last line has no LF until it is complete |
| `language`     | `string`  | The first word of the info string, or `''`                                                                    |
| `isIncomplete` | `boolean` | The fence is still open and more text is coming                                                               |

The default is `CodeBlock`: native `<pre><code class="language-…">`, which is what shadcn/typeset styles, marked `<pre data-markdown-incomplete>` while the fence streams.

### Syntax highlighting

`CodeBlock` takes a Words code highlighter. To highlight with [`@pierre/highlights`](https://www.npmjs.com/package/@pierre/highlights), install it and use Words' `createHighlightsPlugin`:

```sh
pnpm add @pierre/highlights
```

```tsx
import { CodeBlock, type CodeBlockProps, Streamup } from '@opticlm/streamup'
import pierreLight from '@pierre/highlights/themes/pierre-light'
import { createHighlightsPlugin } from '@pierre/words/highlights'

// Create both once, outside the render.
const highlighter = createHighlightsPlugin({ theme: pierreLight })
const components = {
  'code-block': (props: CodeBlockProps) => (
    <CodeBlock {...props} highlighter={highlighter} />
  ),
}

<Streamup streaming components={components}>
  {markdown}
</Streamup>
```

Each token becomes a `<span>` colored by the theme, and a language the highlighter does not know stays plain text. The theme's background is not applied, so pick a theme that suits your code background.

### Your own component

Map `code-block` to any component, and delegate to `CodeBlock` for the parts you don't change:

```tsx
const components = {
  'code-block': (props: CodeBlockProps) => (
    <figure>
      <figcaption>
        {props.language} <CopyButton text={props.code} />
      </figcaption>
      <CodeBlock {...props} highlighter={highlighter} />
    </figure>
  ),
}
```

Keep `components` stable — define it outside the component, or memoize it — since the streaming block cache keys on it.

These props are Words' `CodeOptions`, so a renderer written for Words' `plugins.renderers` takes them as they are: call its `render(props)` from your component and set the HTML it returns.

## Math

Math needs no extra package and no CSS: Words renders TeX to SVG.

```tsx
;<Streamup>
  {
    'Inline $e^{i\\pi} + 1 = 0$, and display:\n\n$$\n\\sum_{n=1}^\\infty \\frac{1}{n^2}\n$$'
  }
</Streamup>
```

- Inline: `$x^2$`. As in Pandoc, the opening `$` needs a non-space after it, and the closing `$` a non-space before it and no digit after it, so `$5 and $10` stays text.
- Display: `$$…$$`, a block from a line starting with `$$` to a line ending with `$$`, or a fenced ` ```math ` block.

Each formula is an `<svg role="img" aria-label="…TeX…">` drawn in `currentColor`, inline or as a centered block. Glyphs come from the system math font; the layout uses the metrics of STIX Two Math, which Apple systems include, and other math fonts work with small spacing differences. A formula Words cannot lay out shows as code.

STIX Two has a small x-height, so math reads small next to sans-serif text. Scale it up as KaTeX does:

```css
.typeset svg[font-family*="Math"] {
  font-size: 1.3em;
}
```

Pass `math={false}` to leave dollar signs as text.

## Mermaid

A ` ```mermaid ` fence is a code block like any other, with `language` `'mermaid'`. Streamup ships two components to draw it, [Pele](#pele), which Words itself uses, and [Mermaid.js](#mermaidjs): map `code-block` to one of them for `mermaid`, and to `CodeBlock` for the rest.

### Pele

[Pele](https://pele.run) is a dependency-free renderer for Mermaid syntax that draws plain SVG. `PeleRenderer` draws through Words' own Mermaid plugin, `@pierre/words/mermaid`.

```sh
pnpm add pele
```

````tsx
import { CodeBlock, type CodeBlockProps, Streamup } from '@opticlm/streamup'
import { PeleRenderer } from '@opticlm/streamup/pele'

const components = {
  'code-block': (props: CodeBlockProps) =>
    props.language === 'mermaid' ? (
      <PeleRenderer {...props} />
    ) : (
      <CodeBlock {...props} />
    ),
}

<Streamup streaming components={components}>
  {'```mermaid\nflowchart TD\n  A --> B\n```'}
</Streamup>
````

Pele renders synchronously, so a diagram is there in the first render, in server-rendered HTML too, and its source never flashes. While the fence streams, the diagram grows with each complete line, and a line that does not parse keeps the last diagram; an open fence with no diagram yet shows nothing. Once the fence closes, source Pele cannot render (a syntax error, an unsupported diagram type, a size limit) shows as code. `@opticlm/streamup/pele` imports all of Pele, so load the component lazily if your bundle size matters. Or render directly:

```tsx
import { PeleRenderer } from '@opticlm/streamup/pele'
;<PeleRenderer code="flowchart TD; A-->B" options={{ fontSize: 14 }} />
```

`options` takes any of [Pele's render options](https://pele.run/api):

```tsx
;<PeleRenderer {...props} options={options} />
```

Memoize `options`, since a new object redraws the diagram and forgets the last one of an open fence. Each diagram gets its own `idPrefix` so several can share a page without clashing SVG ids; set `idPrefix` in `options` to choose your own.

Pele draws with CSS variables instead of a `theme` option. Set them on `.pele` or any ancestor, and they apply without re-rendering ([all variables](https://pele.run/theming)):

```css
.pele {
  --pele-font: ui-sans-serif, system-ui, sans-serif;
  --pele-accent: #5b7bd5;
}

@media (prefers-color-scheme: dark) {
  .pele {
    --pele-bg: #1b1b1b;
    --pele-fg: #e6e6e6;
    --pele-surface: #2a2a2a;
    --pele-border: #6e6e6e;
    --pele-line: #e6e6e6;
  }
}
```

Pele's `package.json` declares `engines.node >= 20`.

### Mermaid.js

```sh
pnpm add mermaid
```

```tsx
import { MermaidRenderer } from '@opticlm/streamup/mermaid'

const config = { theme: 'dark' }
const components = {
  'code-block': (props: CodeBlockProps) =>
    props.language === 'mermaid' ? (
      <MermaidRenderer {...props} config={config} />
    ) : (
      <CodeBlock {...props} />
    ),
}
```

`MermaidRenderer` shows the source until the fence closes, then draws on the client; on a Mermaid syntax error it keeps showing the source. Or render directly:

```tsx
import { MermaidRenderer } from '@opticlm/streamup/mermaid'
;<MermaidRenderer code="flowchart TD; A-->B" config={{ theme: 'dark' }} />
```

## Footnotes

By default footnotes render the GFM way: numbered references linking to a `<section data-footnotes>` at the end of the document. A reference shows as `[^label]` text until its definition arrives.

`footnotes="inline"` drops that section and renders every reference through your `footnote-ref` component, which receives the footnote's content — for a tooltip, a popover, a sidenote:

```tsx
import type { FootnoteRefProps } from '@opticlm/streamup'

const components = useMemo(
  () => ({
    'footnote-ref': ({ label, children }: FootnoteRefProps) => (
      <Popover content={children ?? 'Loading…'}>
        <sup>{label}</sup>
      </Popover>
    ),
  }),
  [],
)

<Streamup streaming footnotes="inline" components={components}>
  {markdown}
</Streamup>
```

`label` is the footnote's number once its definition has arrived, as GFM shows it, and the label as written (`note` for `[^note]`) before that. `children` is the rendered footnote content, `undefined` until its definition starts streaming in — or for good, if the document never defines the label. The content is block-level (a definition renders as `<p>…</p>`) while the reference sits inside a paragraph, so render it where blocks are allowed, such as a popover portal, rather than straight into the text. In inline mode you **must** map `footnote-ref`.

Every `[^label]` renders as a reference from the start, so no footnote syntax flashes as text: an unfinished `[^label` or definition opening at the end of the stream is held back. The definitions feed a footnote store, and each reference subscribes to its own footnote, so a footnote's content streams into its references while the rest of the document stays untouched.

## Props

| Prop         | Type                      | Default     | Description                                                                                                                                                                                                   |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children`   | `string`                  | `''`        | Markdown content                                                                                                                                                                                              |
| `streaming`  | `boolean`                 | `false`     | Heal incomplete markdown and enable adaptive typewriter pacing (unless `pacing={false}`)                                                                                                                      |
| `pacing`     | `PacingConfig \| boolean` | `undefined` | Adaptive typewriter pacing. `false` (or `tickMs <= 0`) disables it; `undefined` follows `streaming`; an object tunes the leaky bucket (`tickMs`, `low`, `high`, `slowCps`, `normCps`, `fastCps`, `scaleFast`) |
| `components` | `StreamupComponents`      | —           | Map tag names to React components, including Streamup's own [`code-block`](#code-blocks) and [`footnote-ref`](#footnotes)                                                                                     |
| `math`       | `boolean`                 | `true`      | Render [math](#math) as SVG                                                                                                                                                                                   |
| `footnotes`  | `'section' \| 'inline'`   | `'section'` | Render footnotes as a trailing GFM section, or [inline](#footnotes) through `components['footnote-ref']`                                                                                                      |

## Customizing the output

`components` is the one way to change what Streamup renders. Map any tag Words emits to a React component, or one of Streamup's own elements: `code-block` for [fenced code](#code-blocks) and `footnote-ref` for [inline footnotes](#footnotes). Native tags also receive the element's hast `node`. As in Words' own React component, Markdown goes straight to HTML, so there are no remark or rehype plugins.

## What's parsed by default

CommonMark and GFM (tables, task lists, strikethrough, autolinks, footnotes), math, and correct emphasis/strikethrough/autolinks for CJK text.

Raw HTML is not rendered: its tags are dropped and their text stays, so `H<sub>2</sub>O` reads `H2O` and `<kbd>Ctrl</kbd>` reads `Ctrl`. Links and images keep only `http`, `https` and relative URLs (links also `mailto`, `tel`, `xmpp`, `irc`, `ircs`).

## Responsive tables

Streamup emits plain `<table>`, which [shadcn/typeset](https://ui.shadcn.com/docs/typeset) styles as a real table that wraps to fit. To scroll a wide table horizontally instead, typeset wants it wrapped in a `typeset-scroll` container. Override `table` to add it:

```tsx
const components = {
  table: ({ node, ...props }) => (
    <div className="typeset-scroll">
      <table {...props} />
    </div>
  ),
}
```

`node` is the hast element; leave it out of the props you spread onto `<table>`.

## License

MIT
