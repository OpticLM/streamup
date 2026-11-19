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

Inline code is always native `<code>`. Fenced (non-inline) code blocks render as native `<pre><code class="language-…">` by default — that's what shadcn/typeset styles, so leave them alone unless you need something custom.

To take over fenced code blocks, add the `codeBlocks` plugin and map the `code-block` element it produces to a component. Your component receives a clean `{ language, code }` contract — no digging through the hast node:

```tsx
import { Streamup } from '@opticlm/streamup'
import { codeBlocks } from '@opticlm/streamup/code-block'

const plugins = useMemo(() => [codeBlocks()], [])
const components = useMemo(
  () => ({ 'code-block': ({ language, code }) => <MyCodeBlock language={language} code={code} /> }),
  [],
)

<Streamup streaming plugins={plugins} components={components}>
  {markdown}
</Streamup>
```

`codeBlocks` turns every fenced `<pre><code class="language-x">` into a `<code-block language="x" code="…">` element; `components['code-block']` renders it. If you use `codeBlocks` you **must** map `code-block`. The exported `DefaultCodeBlock` renders native `<pre><code>`, so a custom component can delegate the blocks it doesn't care about:

```tsx
import { Streamup } from '@opticlm/streamup'
import { DefaultCodeBlock } from '@opticlm/streamup/code-block'

// Highlight only `ts`; leave every other block as native <pre><code>.
const components = useMemo(
  () => ({
    'code-block': ({ language, code }) =>
      language === 'ts' ? (
        <Highlighter code={code} />
      ) : (
        <DefaultCodeBlock language={language} code={code} />
      ),
  }),
  [],
)
```

You can also override any native element directly through `components` to pair with your own rehype plugins. Override `pre` and use the exported `findCode` / `extractLanguage` / `textOf` helpers to read the block:

```tsx
import { Streamup, findCode, extractLanguage, textOf } from '@opticlm/streamup'

const components = useMemo(
  () => ({
    pre: ({ node, children }) => {
      const code = node ? findCode(node) : undefined
      return code ? (
        <MyCodeBlock
          language={extractLanguage(code.properties?.className)}
          code={textOf(code)}
        />
      ) : (
        <pre>{children}</pre>
      )
    },
  }),
  [],
)
```

Memoize `components` so its identity stays stable — the streaming block cache keys on it.

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

The `mermaid()` plugin turns ` ```mermaid ` fenced blocks into a `<mermaid-block code="…" isClosed={…}>` element and leaves every other fenced language as native `<pre><code>` for typeset. It only finds the diagram; whatever you map to `components['mermaid-block']` draws it. Streamup ships two renderers, [Mermaid.js](#mermaidjs) and [Pele](#pele). `isClosed` is false until the closing fence has arrived.

### Mermaid.js

```sh
pnpm add mermaid
```

````tsx
import { Streamup, mermaid } from '@opticlm/streamup'
import { MermaidRenderer } from '@opticlm/streamup/mermaid'

const config = { theme: 'dark' }
const plugins = useMemo(() => [mermaid()], [])
const components = useMemo(
  () => ({
    'mermaid-block': ({ code, isClosed }) => (
      <MermaidRenderer code={code} config={config} isClosed={isClosed} />
    ),
  }),
  [],
)

<Streamup streaming plugins={plugins} components={components}>
  {'```mermaid\nflowchart TD\n  A --> B\n```'}
</Streamup>
````

`MermaidRenderer` waits for the closing fence before rendering, and on a Mermaid syntax error it falls back to the raw source. Or render directly:

```tsx
import { MermaidRenderer } from '@opticlm/streamup/mermaid'
;<MermaidRenderer code="flowchart TD; A-->B" config={{ theme: 'dark' }} />
```

### Pele

[Pele](https://pele.run) is a dependency-free renderer for Mermaid syntax that draws plain SVG. It reads the same fences, so the plugin stays `mermaid()` and only the renderer you map changes:

```sh
pnpm add pele
```

````tsx
import { Streamup, mermaid } from '@opticlm/streamup'
import { PeleRenderer } from '@opticlm/streamup/pele'

const plugins = useMemo(() => [mermaid()], [])
const components = useMemo(() => ({ 'mermaid-block': PeleRenderer }), [])

<Streamup streaming plugins={plugins} components={components}>
  {'```mermaid\nflowchart TD\n  A --> B\n```'}
</Streamup>
````

Diagrams are drawn _while they stream_. Until the closing fence arrives, source that does not parse yet keeps the previous drawing on screen (or the source itself, if nothing has been drawn). Once the fence closes, source Pele still cannot render (a syntax error, an unsupported diagram type, a size limit) is shown as code. Rendering is client-side: server-rendered HTML contains the source, and `pele/lazy` is only downloaded once a diagram appears, one diagram type at a time. Or render directly:

```tsx
import { PeleRenderer } from '@opticlm/streamup/pele'
;<PeleRenderer code="flowchart TD; A-->B" options={{ fontSize: 14 }} />
```

`options` takes any of [Pele's render options](https://pele.run/api). To pass it while mapping, wrap the renderer:

```tsx
'mermaid-block': ({ code, isClosed }) => (
  <PeleRenderer code={code} isClosed={isClosed} options={options} />
)
```

Memoize `options` if you can, since a new object re-renders the diagram. Each diagram gets its own `idPrefix` so several can share a page without clashing SVG ids; set `idPrefix` in `options` to choose your own.

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

### With code blocks

To draw diagrams _and_ customize other languages, list both plugins — `mermaid` first, then `codeBlocks` — and map both `mermaid-block` and `code-block`:

```tsx
const plugins = useMemo(() => [mermaid(), codeBlocks()], [])
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
| `components` | `StreamupComponents`      | —           | Map hast tag names (and custom elements like `code-block`) to React components                                                                                                                                |
| `plugins`    | `StreamupPlugin[]`        | `[]`        | Add rehype plugins (e.g. `mermaid()`)                                                                                                                                                                         |
| `math`       | `boolean`                 | `true`      | Render [math](#math) as SVG                                                                                                                                                                                   |
| `footnotes`  | `'section' \| 'inline'`   | `'section'` | Render footnotes as a trailing GFM section, or [inline](#footnotes) through `components['footnote-ref']`                                                                                                      |

## Plugins

Add any rehype plugin via `plugins`. It runs on the HAST of each block Words renders. There is no Markdown syntax tree, so remark plugins don't apply.

```tsx
import type { StreamupPlugin } from '@opticlm/streamup'
import myRehypePlugin from 'rehype-my-plugin'

const myPlugin: StreamupPlugin = useMemo(() => ({ rehypePlugins: [[myRehypePlugin, { option: true }]] }), [])
<Streamup streaming plugins={[myPlugin]}>{markdown}</Streamup>
```

When combining `mermaid()` and `codeBlocks()`, list them in that order: `mermaid` transforms only mermaid fences and leaves the rest, while `codeBlocks` consumes _every_ remaining fenced block, so it must come last.

## What's parsed by default

CommonMark and GFM (tables, task lists, strikethrough, autolinks, footnotes), math, and correct emphasis/strikethrough/autolinks for CJK text.

Raw HTML is not rendered: its tags are dropped and their text stays, so `H<sub>2</sub>O` reads `H2O` and `<kbd>Ctrl</kbd>` reads `Ctrl`. Links and images keep only `http`, `https` and relative URLs (links also `mailto`, `tel`, `xmpp`, `irc`, `ircs`).

## Responsive tables

Streamup emits plain `<table>`, which [shadcn/typeset](https://ui.shadcn.com/docs/typeset) styles as a real table that wraps to fit. To scroll a wide table horizontally instead, typeset wants it wrapped in a `typeset-scroll` container:

```html
<div class="typeset-scroll">
  <table>...</table>
</div>
```

A small rehype plugin does that for every table. Add `unist-util-visit` (`pnpm add unist-util-visit`) and write:

```ts
// rehype-scroll-tables.ts
import type { Root } from 'hast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

export const rehypeScrollTables: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'table' || !parent || index === undefined) return
    parent.children[index] = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['typeset-scroll'] },
      children: [node],
    }
    // Continue at the next sibling — don't descend into the wrapper we just made.
    return SKIP
  })
}
```

Returning `SKIP` is what keeps this from looping forever: without it `visit` would walk into the new `<div>`, find the same `<table>`, and wrap it again.

Then pass it through `plugins`:

```tsx
import { Streamup } from '@opticlm/streamup'
import { rehypeScrollTables } from './rehype-scroll-tables'

const plugins = useMemo(() => [{ rehypePlugins: [rehypeScrollTables] }], [])

<Streamup streaming plugins={plugins}>{markdown}</Streamup>
```

It works for any wide block, not just tables, so that you could widen the condition to wrap `pre` too:

```ts
if (node.tagName !== 'table' && node.tagName !== 'pre') return
```

If you'd rather not add a plugin, override the element instead:

```tsx
const components = useMemo(
  () => ({
    table: ({ node, ...props }) => (
      <div className="typeset-scroll">
        <table {...props} />
      </div>
    ),
  }),
  [],
)
```

## License

MIT
