import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Streamup } from '../streamup.js'
import { MermaidRenderer, rehypeMermaid } from './index.js'

const mermaidBlock = ({ code }: { code: string }) =>
  createElement(MermaidRenderer, { code })

// Mock `mermaid` so we can drive the render promise and assert how
// MermaidRenderer initializes it, without pulling d3/SVG layout into jsdom.
const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}))
vi.mock('mermaid', () => ({ default: mermaidMock }))

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

describe('MermaidRenderer (client effect)', () => {
  afterEach(() => {
    cleanup()
    mermaidMock.initialize.mockReset()
    mermaidMock.render.mockReset()
  })

  it('suppresses mermaid error rendering and falls back to raw code on a syntax error', async () => {
    // Simulate a parse failure: mermaid.render rejects.
    mermaidMock.render.mockRejectedValue(new Error('syntax error'))
    const code = 'flowchart TD\n    A ->> B'

    const { container } = render(createElement(MermaidRenderer, { code }))
    // Flush the dynamic-import promise chain so the .catch runs inside act.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // suppressErrorRendering must be on so mermaid doesn't paint its own
    // "Syntax error" SVG into document.body and ruin the page layout.
    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ suppressErrorRendering: true }),
    )
    expect(mermaidMock.render).toHaveBeenCalledWith(expect.any(String), code)
    // Fallback: raw source shown as a code block, not the error diagram.
    expect(container.querySelector('pre')).not.toBeNull()
    expect(container.textContent).toContain('flowchart')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders the mermaid svg on success', async () => {
    mermaidMock.render.mockResolvedValue({ svg: '<svg class="ok"></svg>' })

    const { container } = render(
      createElement(MermaidRenderer, { code: 'flowchart TD\n  A --> B' }),
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(container.querySelector('svg.ok')).not.toBeNull()
    expect(container.querySelector('pre')).toBeNull()
  })
})
