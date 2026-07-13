# @opticlm/streamup

A headless React streaming markdown renderer. Pass it a Markdown string — change that string as often as you like — and it renders the HTML. No wrappers, no overrides to maintain: the output is plain semantic HTML you can style with [shadcn/typeset](https://ui.shadcn.com/docs/typeset).

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
<div className="typeset typeset-docs">
  <Streamup streaming>{markdown}</Streamup>
</div>
```

## Adaptive typewriter pacing

When `streaming` is on, `Streamup` reveals the document with an adaptive "typewriter" instead of dumping each network chunk as it arrives. Incoming text goes into a buffer decoupled from the UI; a scheduled consumer drains it every `tickMs` (default 33 ms ≈ 30 fps), so the visual output rate stays relatively constant regardless of how bursty or stalled the network is.

The drain rate adapts to the buffer depth (measured in code points):

| Buffer | Rate | Default | Why |
|---|---|---|---|
| `< low` | `slowCps` | 15 cps (≈ 1 char / 2 ticks) | Network stalled — slow down to stretch the remaining tokens and mask the pause |
| `low`…`high` | `normCps` | 30 cps (≈ 1 cp / tick) | Steady typewriter cadence |
| `>= high` | `fastCps` | 120 cps (≈ 4 cp / tick) | Burst arrived — speed up to catch up |

With `scaleFast` (default on), `fastCps` is multiplied by `min(10, buffer / high)` so a large backlog drains in bounded time — without it, a fast model delivering 200–600 cps would outpace 120 cps and the UI would lag ever further behind completion. Fractional cp/tick rates (e.g. 0.5 cp/tick) are realized with a credit accumulator, and emission advances by code point so an emoji is never split across frames.

When `streaming` flips to `false` the buffer flushes instantly — the full document is shown at once, healing off. Pass `pacing={false}` (or `tickMs <= 0`) to disable pacing entirely and render every change synchronously. Tune the bucket with an object:

```tsx
<Streamup streaming pacing={{ tickMs: 16, normCps: 60, fastCps: 200 }}>
  {markdown}
</Streamup>
```

Internally the buffer is split into blocks (paragraphs, code, lists, …); only the trailing block is healed on each tick, and unchanged blocks are cached, so per-tick cost stays flat as the buffer grows. One caveat: documents with footnotes take a single whole-doc block (so the cache can't help) and re-render fully each committing tick — the cost is ~1.5× the old fixed throttle at 30 fps and is configurable via `tickMs`.

## Code blocks

Inline code is always native `<code>`. Fenced (non-inline) code blocks render as native `<pre><code class="language-…">` by default — that's what shadcn/typeset styles, so leave them alone unless you need something custom.

To take over fenced code blocks, add the `rehypeCodeBlocks` plugin and map the `code-block` element it produces to a component. Your component receives a clean `{ language, code }` contract — no digging through the hast node:

```tsx
import { Streamup } from '@opticlm/streamup'
import { rehypeCodeBlocks } from '@opticlm/streamup/code-block'

const plugins = useMemo(() => [rehypeCodeBlocks()], [])
const components = useMemo(
  () => ({ 'code-block': ({ language, code }) => <MyCodeBlock language={language} code={code} /> }),
  [],
)

<Streamup streaming plugins={plugins} components={components}>
  {markdown}
</Streamup>
```

`rehypeCodeBlocks` turns every fenced `<pre><code class="language-x">` into a `<code-block language="x" code="…">` element; `components['code-block']` renders it. If you use `rehypeCodeBlocks` you **must** map `code-block`. The exported `DefaultCodeBlock` renders native `<pre><code>`, so a custom component can delegate the blocks it doesn't care about:

```tsx
import { Streamup } from '@opticlm/streamup'
import { rehypeCodeBlocks, DefaultCodeBlock } from '@opticlm/streamup/code-block'

// Highlight only `ts`; leave every other block as native <pre><code>.
const components = useMemo(
  () => ({
    'code-block': ({ language, code }) =>
      language === 'ts' ? <Highlighter code={code} /> : <DefaultCodeBlock language={language} code={code} />,
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
      return code
        ? <MyCodeBlock language={extractLanguage(code.properties?.className)} code={textOf(code)} />
        : <pre>{children}</pre>
    },
  }),
  [],
)
```

Memoize `components` so its identity stays stable — the streaming block cache keys on it.

## KaTeX

```sh
pnpm add katex
```

```tsx
import { Streamup } from '@opticlm/streamup'
import { katex } from '@opticlm/streamup/katex'
import 'katex/dist/katex.min.css'

const plugins = useMemo(() => [katex()], [])

<Streamup streaming plugins={plugins}>{'$$\nE = mc^2\n$$'}</Streamup>
```

Math is always parsed. `katex()` renders it with KaTeX; on a TeX syntax error the raw source is shown as plain text. Display math is `$$` on its own line(s):

- Block (display): `$$` on its own line(s) — `$$\nE = mc^2\n$$` — or a fenced ` ```math ` block.
- Inline: `$x^2$` — enable with `singleDollarTextMath`. A single-line `$$x$$` is inline math in remark-math; use the multi-line form above for display.

### Why `katex.min.css` is required

KaTeX renders TeX into HTML with its own class names (`.katex`, `.katex-display`, `.base`, `.mfrac`, etc.) and loads custom fonts for math symbols (KaTeX_Main, KaTeX_Math, KaTeX_AMS, KaTeX_Size1–4, …). The CSS file provides:

- `@font-face` declarations for all 13 KaTeX font families.
- Layout and spacing for fractions, superscripts/subscripts, delimiters, matrices, accents, etc.
- Screen-reader accessibility.
- ...

### Which CSS file to import

KaTeX ships several CSS variants in `node_modules/katex/dist/`:

| File | When to use |
|---|---|
| `katex.min.css` | **Default.** `font-display: block` — the browser hides text until the KaTeX font loads, then swaps in. Avoids a flash of unstyled text (FOUT) at the cost of a short invisible period. |
| `katex.css` | Same as above but unminified (useful for debugging). |
| `katex-swap.min.css` | `font-display: swap` — the browser shows a fallback font immediately and swaps to KaTeX when it loads. Better perceived performance on slow connections; may cause a visible style shift. |
| `katex-swap.css` | Same as above, unminified. |

Import **one** of them — that's all that's needed. If you're unsure, use `katex.min.css`.

You can also skip the bundled CSS entirely and write your own styles for the KaTeX classes (see below), or import the CSS in a different way (via a CSS bundler `@import`, a `<link>` tag from a CDN, etc.).

### Display math DOM structure

When KaTeX renders a display-math block, the output HTML structure placed into the document is:

```html
<span class="katex-display">
  <span class="katex">
    <!-- MathML for screen readers, visually hidden -->
    <span class="katex-mathml">…</span>
    <span class="katex-html" aria-hidden="true">
      <!-- one or more inline-blocks per line of math -->
      <span class="base">…</span>
    </span>
  </span>
</span>
```

KaTeX's default CSS styles these as:

| Selector | CSS | Role |
|---|---|---|
| `.katex-display` | `display: block; margin: 1em 0; text-align: center` | Outer block wrapper |
| `.katex-display > .katex` | `display: block; text-align: center; white-space: nowrap` | Internal block container |
| `.katex-display > .katex > .katex-html` | `display: block; position: relative` | Visible rendered output |
| `.katex .base` | `display: inline-block; width: min-content` | Each line of math |
| `.katex .katex-mathml` | `position: absolute; clip-path: inset(50%)` | Visually hidden, accessibility only |

All three wrapper levels (`.katex-display`, `.katex`, `.katex-html`) are `display: block` and each takes 100% width of its parent. The math content (the `.base` inline-blocks) is centered by `text-align: center` inherited from `.katex`.

### Customizing margins and centering

Since the KaTeX classes are plain CSS, override them directly. To control the display block's outer spacing:

```css
.katex-display {
  margin: 1.5em 2rem;
  text-align: left;
}
```

To adjust the base math font size:

```css
.katex {
  font-size: 1.1em;
}
```

## Mermaid

```sh
pnpm add mermaid
```

```tsx
import { Streamup } from '@opticlm/streamup'
import { MermaidRenderer, rehypeMermaid } from '@opticlm/streamup/mermaid'

const config = { theme: 'dark' }
const plugins = useMemo(() => [rehypeMermaid()], [])
const components = useMemo(
  () => ({ 'mermaid-block': ({ code }) => <MermaidRenderer code={code} config={config} /> }),
  [],
)

<Streamup streaming plugins={plugins} components={components}>
  {'```mermaid\nflowchart TD\n  A --> B\n```'}
</Streamup>
```

`rehypeMermaid` turns ` ```mermaid ` fenced blocks into a `<mermaid-block code="…">` element; map it via `components['mermaid-block']` (typically to `MermaidRenderer`). Every other fenced language stays native `<pre><code>` for typeset. On a Mermaid syntax error `MermaidRenderer` falls back to the raw source. Or render directly:

```tsx
import { MermaidRenderer } from '@opticlm/streamup/mermaid'
<MermaidRenderer code="flowchart TD; A-->B" config={{ theme: 'dark' }} />
```

To render mermaid *and* customize other languages, list both plugins — `rehypeMermaid` first, then `rehypeCodeBlocks` and map both `mermaid-block` and `code-block`:

```tsx
const plugins = useMemo(() => [rehypeMermaid(), rehypeCodeBlocks()], [])
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | `''` | Markdown content |
| `streaming` | `boolean` | `false` | Heal incomplete markdown and enable adaptive typewriter pacing (unless `pacing={false}`) |
| `pacing` | `PacingConfig \| boolean` | `undefined` | Adaptive typewriter pacing. `false` (or `tickMs <= 0`) disables it; `undefined` follows `streaming`; an object tunes the leaky bucket (`tickMs`, `low`, `high`, `slowCps`, `normCps`, `fastCps`, `scaleFast`) |
| `components` | `StreamupComponents` | — | Map hast tag names (and custom elements like `code-block`) to React components |
| `plugins` | `StreamupPlugin[]` | `[]` | Add remark/rehype plugins (e.g. `katex()`) |
| `singleDollarTextMath` | `boolean` | `false` | Enable `$...$` inline math syntax |

## Plugins

Add any remark/rehype plugin via `plugins`:

```tsx
import type { StreamupPlugin } from '@opticlm/streamup'
import myRehypePlugin from 'rehype-my-plugin'

const myPlugin: StreamupPlugin = useMemo(() => ({ rehypePlugins: [[myRehypePlugin, { option: true }]] }), [])
<Streamup streaming plugins={[myPlugin]}>{markdown}</Streamup>
```

When combining `katex()`, `rehypeMermaid()`, and `rehypeCodeBlocks()`, list them in that order: each plugin transforms only its target blocks and leaves the rest for the next. `rehypeCodeBlocks` consumes *every* remaining fenced block, so it must come last.

## What's parsed by default

GFM (tables, strikethrough, task lists, autolinks, footnotes), math (block `$$…$$` by default), raw HTML (sanitized), and correct emphasis/strikethrough/autolinks for CJK text.

## Styling GFM task lists

GFM task lists use remark-gfm's class names — `ul.contains-task-list` and `li.task-list-item` (containing `<input type="checkbox" disabled>`).

## License

MIT