import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import { MermaidRenderer, rehypeMermaid } from './index.js'

const mermaidBlock = ({ code }: { code: string }) =>
  createElement(MermaidRenderer, { code })

describe('rehypeMermaid', () => {
  it('routes mermaid flowchart to MermaidRenderer via components (SSR fallback)', () => {
    const md = '```mermaid\nflowchart TD\n    A --> B\n```'
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          streaming: true,
          plugins: [rehypeMermaid()],
          components: { 'mermaid-block': mermaidBlock },
        },
        md,
      ),
    )
    // SSR: useEffect does not run, so MermaidRenderer returns its <pre><code>
    // fallback. The diagram source is present; the language class is not
    // (rehypeMermaid consumed the block instead of emitting native code).
    expect(html).not.toContain('language-mermaid')
    expect(html).toContain('flowchart')
  })

  it('routes a mermaid pie chart through the fallback', () => {
    const md =
      '```mermaid\npie title Pets\n    "Dogs" : 386\n    "Cats" : 85\n```'
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          streaming: true,
          plugins: [rehypeMermaid()],
          components: { 'mermaid-block': mermaidBlock },
        },
        md,
      ),
    )
    expect(html).not.toContain('language-mermaid')
    expect(html).toContain('pie title Pets')
    expect(html).toContain('&quot;Dogs&quot;')
  })

  it('leaves non-mermaid code blocks as native <pre><code>', () => {
    const md = '```js\nconsole.log("hi")\n```'
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          streaming: true,
          plugins: [rehypeMermaid()],
          components: { 'mermaid-block': mermaidBlock },
        },
        md,
      ),
    )
    // rehypeMermaid ignores non-mermaid, so the native <pre><code class="language-js">.
    expect(html).toContain('language-js')
    expect(html).toContain('console.log')
  })
})

describe('MermaidRenderer', () => {
  it('renders raw code as the fallback in SSR', () => {
    const html = renderToStaticMarkup(
      createElement(MermaidRenderer, {
        code: 'pie title Test\n    "A" : 50\n    "B" : 50',
      }),
    )
    expect(html).toContain('<pre>')
    expect(html).toContain('pie title Test')
  })
})
