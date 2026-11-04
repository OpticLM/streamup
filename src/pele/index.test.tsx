import { cleanup, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import type { PeleRendererProps } from './index.js'
import { PELE_BLOCK_TAG, PeleRenderer, pele } from './index.js'

// These tests run the real Pele: it is synchronous and needs no DOM.
const FLOWCHART = 'flowchart TD\n  A --> B'
// A syntax error: Pele throws a `PeleError`.
const INVALID = 'flowchart TD\n  A -->'

const peleBlock = ({ code, isClosed }: PeleRendererProps) =>
  createElement(PeleRenderer, { code, isClosed })

const streamupHtml = (
  md: string,
  components = { [PELE_BLOCK_TAG]: peleBlock },
) =>
  renderToStaticMarkup(
    createElement(
      Streamup,
      { streaming: true, plugins: [pele()], components },
      md,
    ),
  )

// Load Pele up front so "nothing was rendered" checks below only have to wait
// out a render, not a first-time module load.
beforeAll(async () => {
  await import('pele/lazy')
})

afterEach(cleanup)

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

describe('pele', () => {
  it('routes mermaid fences to PeleRenderer via components (SSR fallback)', () => {
    const html = streamupHtml('```mermaid\nflowchart TD\n    A --> B\n```')
    // SSR: effects do not run, so PeleRenderer shows its <pre><code> fallback.
    // The block was consumed, so the language class is gone.
    expect(html).not.toContain('language-mermaid')
    expect(html).toContain('flowchart')
  })

  it('emits <pele-block>, not <mermaid-block>', () => {
    const html = streamupHtml(
      '```mermaid\npie title Pets\n    "Dogs" : 386\n```',
      {
        [PELE_BLOCK_TAG]: ({ code }: PeleRendererProps) =>
          createElement('div', { 'data-tag': 'pele' }, code),
      },
    )
    expect(html).toContain('data-tag="pele"')
    expect(html).toContain('pie title Pets')
  })

  it('marks whether the mermaid fence is closed', () => {
    const state = (md: string) =>
      streamupHtml(md, {
        [PELE_BLOCK_TAG]: ({ isClosed }: PeleRendererProps) =>
          createElement('div', { 'data-closed': String(isClosed) }),
      })

    expect(state('```mermaid\nflowchart TD\n    A --> B')).toContain(
      'data-closed="false"',
    )
    expect(state('```mermaid\nflowchart TD\n    A --> B\n```')).toContain(
      'data-closed="true"',
    )
  })

  it('replaces every mermaid fence in place, wherever it sits', () => {
    const md = [
      '```mermaid\nflowchart TD\n  A --> B\n```',
      '```mermaid\npie title Pets\n  "Dogs" : 1\n```',
      '```js\nconst kept = true\n```',
      '> ```mermaid\n> sequenceDiagram\n>   A->>B: hi\n> ```',
    ].join('\n\n')
    const html = streamupHtml(md, {
      [PELE_BLOCK_TAG]: ({ code }: PeleRendererProps) =>
        createElement('i', null, code.split('\n')[0]),
    })

    expect(html).toContain('<i>flowchart TD</i>')
    expect(html).toContain('<i>pie title Pets</i>')
    expect(html).toContain('<i>sequenceDiagram</i>')
    expect(html).toContain('const kept = true') // other fences are untouched
    expect(html).not.toContain('language-mermaid')
    expect(html.indexOf('flowchart')).toBeLessThan(html.indexOf('pie title'))
  })

  it('leaves non-mermaid code blocks as native <pre><code>', () => {
    const html = streamupHtml('```js\nconsole.log("hi")\n```')
    expect(html).toContain('language-js')
    expect(html).toContain('console.log')
  })
})

describe('PeleRenderer', () => {
  it('renders raw code as the fallback in SSR', () => {
    const html = renderToStaticMarkup(
      createElement(PeleRenderer, { code: 'pie title Test\n    "A" : 50' }),
    )
    expect(html).toContain('<pre>')
    expect(html).toContain('pie title Test')
  })

  it('renders the diagram as inline SVG', async () => {
    const { container } = render(
      createElement(PeleRenderer, { code: FLOWCHART }),
    )

    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )
    expect(container.querySelector('pre')).toBeNull()
    expect(container.textContent).not.toContain('flowchart TD')
  })

  it.each([
    ['closed', `\`\`\`mermaid\n${FLOWCHART}\n\`\`\``],
    ['still open', `\`\`\`mermaid\n${FLOWCHART}`],
  ])('draws a %s fence streamed through <Streamup>', async (_, markdown) => {
    const { container } = render(
      createElement(
        Streamup,
        { plugins: [pele()], components: { [PELE_BLOCK_TAG]: peleBlock } },
        markdown,
      ),
    )

    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )
  })

  describe('while the fence is still open', () => {
    const open = (code: string, isClosed = false) =>
      createElement(PeleRenderer, { code, isClosed })

    it('shows the source until something parses', async () => {
      const { container } = render(open(INVALID))
      await settle()

      expect(container.querySelector('svg')).toBeNull()
      expect(container.querySelector('pre')).not.toBeNull()
      expect(container.textContent).toContain('flowchart')
    })

    it('keeps the last drawing while a prefix does not parse', async () => {
      const { container, rerender } = render(open(FLOWCHART))
      await waitFor(() =>
        expect(container.querySelector('svg.pele')).not.toBeNull(),
      )
      const first = container.innerHTML

      rerender(open(`${FLOWCHART}\n  B -->`)) // cut off mid-statement
      await settle()
      expect(container.innerHTML).toBe(first)

      rerender(open(`${FLOWCHART}\n  B --> C`))
      await waitFor(() => expect(container.innerHTML).not.toBe(first))
      expect(container.querySelector('svg.pele')).not.toBeNull()
    })

    it('shows the source if the fence closes on source that does not parse', async () => {
      const { container, rerender } = render(open(FLOWCHART))
      await waitFor(() =>
        expect(container.querySelector('svg.pele')).not.toBeNull(),
      )

      rerender(open(INVALID, true))
      await waitFor(() => expect(container.querySelector('svg')).toBeNull())
      expect(container.querySelector('pre')).not.toBeNull()
    })
  })

  it('shows the source of a closed fence that cannot be rendered', async () => {
    const { container } = render(createElement(PeleRenderer, { code: INVALID }))
    await settle()

    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('pre')).not.toBeNull()
    expect(container.textContent).toContain('flowchart')
  })

  it('gives every instance its own SVG id prefix, which options can override', async () => {
    // `accTitle`/`accDescr` make Pele emit `id`s (`<prefix>-title`, `-desc`).
    // With Pele's constant default prefix, two such diagrams would collide.
    const code =
      'flowchart TD\n  accTitle: Title\n  accDescr: Description\n  A --> B'
    const { container } = render(
      createElement(
        'div',
        null,
        createElement(PeleRenderer, { code }),
        createElement(PeleRenderer, { code }),
        createElement(PeleRenderer, { code, options: { idPrefix: 'custom' } }),
      ),
    )
    await waitFor(() =>
      expect(container.querySelectorAll('svg.pele')).toHaveLength(3),
    )

    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
    expect(ids).toContain('custom-title') // the option reaches Pele...
    expect(new Set(ids).size).toBe(ids.length) // ...and nothing collides
  })

  it('does not emit scripts or event handlers for hostile diagram source', async () => {
    const code = [
      'flowchart TD',
      '  A["<img src=x onerror=alert(1)>"] --> B["<script>alert(1)</script>"]',
      '  click A href "javascript:alert(1)"',
      '  click B href "data:text/html,<script>alert(1)</script>"',
    ].join('\n')
    const { container } = render(createElement(PeleRenderer, { code }))
    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )

    expect(container.querySelector('script, img, foreignObject')).toBeNull()
    expect(container.innerHTML).not.toMatch(/onerror|javascript:|data:/i)
  })
})
