import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import type { CodeBlockProps } from '../code-block.js'
import { CodeBlock } from '../code-block.js'
import { Streamup } from '../streamup.js'
import type { PeleRendererProps } from './index.js'
import { PeleRenderer } from './index.js'

// These tests run the real Pele: it is synchronous and needs no DOM.
const FLOWCHART = 'flowchart TD\n  A --> B\n'
// A syntax error: Pele throws a `PeleError`.
const INVALID = 'flowchart TD\n  A -->\n'

afterEach(cleanup)

const html = (props: PeleRendererProps) =>
  renderToStaticMarkup(createElement(PeleRenderer, props))

const components = {
  'code-block': (props: CodeBlockProps) =>
    createElement(
      props.language === 'mermaid' ? PeleRenderer : CodeBlock,
      props,
    ),
}

describe('PeleRenderer', () => {
  it('draws the diagram in the first render, on the server too', () => {
    const out = html({ code: FLOWCHART })
    expect(out).toMatch(
      /^<div><div data-markdown="mermaid"><svg [^>]*class="pele/,
    )
    expect(out).not.toContain('flowchart TD')
  })

  it('shows the source of a closed fence that cannot be rendered', () => {
    expect(html({ code: INVALID })).toBe(
      '<pre><code class="language-mermaid">flowchart TD\n  A --&gt;\n</code></pre>',
    )
  })

  it.each([
    ['closed', `\`\`\`mermaid\n${FLOWCHART}\`\`\``],
    ['still open', `\`\`\`mermaid\n${FLOWCHART}`],
  ])('draws a %s fence mapped through <Streamup>', (_, markdown) => {
    const out = renderToStaticMarkup(
      createElement(Streamup, { streaming: true, components }, markdown),
    )
    expect(out).toContain('class="pele')
  })

  it('leaves other languages to the code block it delegates to', () => {
    const out = renderToStaticMarkup(
      createElement(Streamup, { components }, '```js\nlet a\n```'),
    )
    expect(out).toBe('<pre><code class="language-js">let a\n</code></pre>')
  })

  describe('while the fence is still open', () => {
    const open = (code: string) => html({ code, isIncomplete: true })

    it('shows nothing until a line is complete', () => {
      expect(open('flowchart TD')).toBe('')
    })

    it('keeps the last diagram while a line does not parse', () => {
      const block = (code: string) =>
        createElement(PeleRenderer, { code, isIncomplete: true })
      const { container, rerender } = render(block(FLOWCHART))
      const first = container.innerHTML
      expect(first).toContain('class="pele')

      rerender(block(`${FLOWCHART}  B -->\n`))
      expect(container.innerHTML).toBe(first)

      rerender(block(`${FLOWCHART}  B --> C\n`))
      expect(container.innerHTML).not.toBe(first)
      expect(container.innerHTML).toContain('class="pele')
    })

    it('draws complete lines only', () => {
      expect(open(`${FLOWCHART}  B --> C`)).toBe(open(FLOWCHART))
    })
  })

  it('gives every instance its own SVG id prefix, which options can override', () => {
    // `accTitle`/`accDescr` make Pele emit `id`s (`<prefix>-title`, `-desc`).
    // With Pele's constant default prefix, two such diagrams would collide.
    const code =
      'flowchart TD\n  accTitle: Title\n  accDescr: Description\n  A --> B\n'
    const out = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(PeleRenderer, { code }),
        createElement(PeleRenderer, { code }),
        createElement(PeleRenderer, { code, options: { idPrefix: 'custom' } }),
      ),
    )
    const ids = [...out.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toContain('custom-title') // the option reaches Pele...
    expect(new Set(ids).size).toBe(ids.length) // ...and nothing collides
  })

  it('does not emit scripts or event handlers for hostile diagram source', () => {
    const out = html({
      code: [
        'flowchart TD',
        '  A["<img src=x onerror=alert(1)>"] --> B["<script>alert(1)</script>"]',
        '  click A href "javascript:alert(1)"',
        '  click B href "data:text/html,<script>alert(1)</script>"',
        '',
      ].join('\n'),
    })
    expect(out).toContain('class="pele')
    expect(out).not.toMatch(
      /<script|<img|<foreignObject|onerror|javascript:|data:/i,
    )
  })
})
