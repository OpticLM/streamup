import { cleanup, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mermaid } from '../parse/mermaid-block.js'
import { Streamup } from '../streamup.js'
import { PeleRenderer } from './index.js'

// These tests run the real Pele: it is synchronous and needs no DOM.
const FLOWCHART = 'flowchart TD\n  A --> B'
// A syntax error: Pele throws a `PeleError`.
const INVALID = 'flowchart TD\n  A -->'

// Load Pele up front so "nothing was rendered" checks below only have to wait
// out a render, not a first-time module load.
beforeAll(async () => {
  await import('pele/lazy')
})

afterEach(cleanup)

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

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
        {
          plugins: [mermaid()],
          components: { 'mermaid-block': PeleRenderer },
        },
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
