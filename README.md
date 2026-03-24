# @opticlm/streamup

A simple, headless React streaming markdown renderer.

## Install

```bash
pnpm add @opticlm/streamup react react-dom
```

## Usage

```tsx
import { Streamup } from '@opticlm/streamup'

// Basic
<Streamup>{'# Hello **world**'}</Streamup>

// Streaming (incomplete markdown)
<Streamup streaming>{'**bold text without clos'}</Streamup>

// Custom components
<Streamup
  components={{
    h1: ({ children }) => <h1 className="text-4xl font-bold">{children}</h1>,
    p: ({ children }) => <p className="my-4 leading-relaxed">{children}</p>,
    code: ({ children, className, ...props }) => {
      const isBlock = 'data-block' in props
      if (isBlock) {
        return <pre className="bg-zinc-900 p-4 rounded"><code>{children}</code></pre>
      }
      return <code className="bg-zinc-100 px-1 rounded">{children}</code>
    },
  }}
>
  {markdown}
</Streamup>
```

## What's included by default

All parsing is always enabled:

- **GFM**: tables, strikethrough, task lists, autolinks
- **Math**: block equtions
- **CJK**: proper emphasis, strikethrough, and autolink handling for Chinese/Japanese/Korean text
- **HTML**: raw HTML with sanitization
- **Footnotes**: reference and definition syntax

## KaTeX rendering

Math syntax is always parsed. To render it with KaTeX, add the plugin:

```bash
pnpm add katex rehype-katex
```

```tsx
import { Streamup } from '@opticlm/streamup'
import { katex } from '@opticlm/streamup/katex'
import 'katex/dist/katex.min.css'

// Default options
<Streamup plugins={[katex()]}>{'$$E = mc^2$$'}</Streamup>

// Custom KaTeX options
<Streamup plugins={[katex({ errorColor: '#ff0000', strict: false })]}>
  {'$$E = mc^2$$'}
</Streamup>
```

## Mermaid diagrams

```bash
pnpm add mermaid
```

```tsx
import { Streamup } from '@opticlm/streamup'
import { withMermaid } from '@opticlm/streamup/mermaid'

// Default
<Streamup components={withMermaid()}>
  {'```mermaid\ngraph TD\n  A-->B\n```'}
</Streamup>

// With mermaid config (theme, flowchart direction, etc.)
<Streamup components={withMermaid({ config: { theme: 'dark' } })}>
  {'```mermaid\ngraph TD\n  A-->B\n```'}
</Streamup>

// With custom fallback code component
<Streamup components={withMermaid({
  config: { theme: 'forest' },
  fallbackCode: MyCodeBlock,
})}>
  {markdown}
</Streamup>
```

Or use the renderer directly:

```tsx
import { MermaidRenderer } from '@opticlm/streamup/mermaid'

<MermaidRenderer code="graph TD; A-->B" config={{ theme: 'dark' }} />
```

## Configuration

### Single-dollar math

By default, only `$$...$$` block math is enabled. Enable `$...$` inline math:

```tsx
<Streamup singleDollarTextMath>{markdown}</Streamup>
```

### URL transform

Transform or remove URLs before rendering:

```tsx
<Streamup urlTransform={(url) => url.replace('http:', 'https:')}>
  {markdown}
</Streamup>

// Remove all links
<Streamup urlTransform={() => null}>{markdown}</Streamup>
```

### Element filtering

Filter which elements are allowed to render. Returning `false` removes the element but keeps its children:

```tsx
<Streamup allowElement={(el) => el.tagName !== 'img'}>
  {markdown}
</Streamup>
```

### Custom sanitization

Replace the default sanitization schema. Spread `defaultSanitizeSchema` to extend it:

```tsx
import { Streamup, defaultSanitizeSchema } from '@opticlm/streamup'

<Streamup sanitizeSchema={{
  ...defaultSanitizeSchema,
  attributes: {
    ...defaultSanitizeSchema.attributes,
    div: ['className', 'style'],
  },
}}>
  {markdown}
</Streamup>
```

### Custom remark/rehype plugins

Add custom remark or rehype plugins via the plugin system:

```tsx
import type { StreamupPlugin } from '@opticlm/streamup'
import myRemarkPlugin from 'remark-my-plugin'
import myRehypePlugin from 'rehype-my-plugin'

const myPlugin: StreamupPlugin = {
  remarkPlugins: [myRemarkPlugin],
  rehypePlugins: [[myRehypePlugin, { option: true }]],
}

<Streamup plugins={[myPlugin]}>{markdown}</Streamup>
```

## Utilities

```ts
import { remend, parseMarkdownIntoBlocks, processMarkdown } from '@opticlm/streamup'

// Heal incomplete markdown (streaming)
remend('**bold')        // '**bold**'
remend('~~strike')      // '~~strike~~'
remend('[link](http')   // '[link](streamup:incomplete-link)'

// Split markdown into blocks for incremental rendering
parseMarkdownIntoBlocks('# Title\n\nParagraph')
// ['# Title\n\n', 'Paragraph\n']

// Low-level: process markdown to React elements
processMarkdown('# Hello', {
  components: myComponents,
  processorOptions: { singleDollarTextMath: true },
  urlTransform: (url) => url,
})
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | `''` | Markdown content |
| `streaming` | `boolean` | `false` | Heal incomplete markdown before rendering |
| `components` | `Partial<Components>` | unstyled HTML | Override rendering for any element |
| `plugins` | `StreamupPlugin[]` | `[]` | Add remark/rehype plugins (e.g. `katex()`) |
| `className` | `string` | — | Class on the wrapper `<div>` |
| `singleDollarTextMath` | `boolean` | `false` | Enable `$...$` inline math syntax |
| `sanitizeSchema` | `SanitizeSchema` | built-in | Custom HTML sanitization schema |
| `urlTransform` | `UrlTransform` | — | Transform or remove URLs |
| `allowElement` | `AllowElement` | — | Filter elements (return `false` to remove) |

## Styling GFM task lists

GFM task lists are rendered with class names from [remark-gfm](https://github.com/remarkjs/remark-gfm):

- `ul.contains-task-list` — the list container
- `li.task-list-item` — each task item (contains an `<input type="checkbox" disabled>`)

```css
ul.contains-task-list {
  list-style: none;
  padding-left: 0;
}

li.task-list-item {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
```

## Components you can override

Every HTML element can be overridden. Each component receives its standard HTML props plus `node` (the HAST element).

Common overrides: `h1`–`h6`, `p`, `a`, `img`, `code`, `pre`, `blockquote`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `ol`, `ul`, `li`, `hr`, `strong`, `em`, `del`, `sup`, `sub`.

## License

MIT
