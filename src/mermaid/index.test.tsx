import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import { MermaidRenderer, withMermaid } from './index.js'

describe('withMermaid', () => {
  it('routes mermaid flowchart to MermaidRenderer', () => {
    const md = '```mermaid\nflowchart TD\n    A --> B\n```'
    const html = renderToStaticMarkup(
      createElement(Streamup, { components: withMermaid() }, md),
    )
    expect(html).not.toContain('language-mermaid')
    expect(html).toContain('flowchart')
  })

  it('routes mermaid pie chart to MermaidRenderer', () => {
    const md =
      '```mermaid\npie title Pets\n    "Dogs" : 386\n    "Cats" : 85\n```'
    const html = renderToStaticMarkup(
      createElement(Streamup, { components: withMermaid() }, md),
    )
    expect(html).not.toContain('language-mermaid')
    expect(html).toContain('pie title Pets')
    expect(html).toContain('&quot;Dogs&quot;')
  })

  it('passes non-mermaid code blocks to fallback', () => {
    const md = '```js\nconsole.log("hi")\n```'
    const html = renderToStaticMarkup(
      createElement(Streamup, { components: withMermaid() }, md),
    )
    expect(html).toContain('language-js')
    expect(html).toContain('console.log')
  })
})

describe('MermaidRenderer', () => {
  it('renders raw code as fallback in SSR', () => {
    const html = renderToStaticMarkup(
      createElement(MermaidRenderer, {
        code: 'pie title Test\n    "A" : 50\n    "B" : 50',
      }),
    )
    expect(html).toContain('<pre>')
    expect(html).toContain('pie title Test')
  })
})
