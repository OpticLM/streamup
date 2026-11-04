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

  it('renders a diagram streamed through <Streamup>', async () => {
    const { container } = render(
      createElement(
        Streamup,
        { plugins: [pele()], components: { [PELE_BLOCK_TAG]: peleBlock } },
        `\`\`\`mermaid\n${FLOWCHART}\n\`\`\``,
      ),
    )

    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )
  })

  it('does not render an unclosed block', async () => {
    const { container } = render(
      createElement(PeleRenderer, { code: FLOWCHART, isClosed: false }),
    )
    await settle()

    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('pre')).not.toBeNull()
    expect(container.textContent).toContain('flowchart')
  })

  it('renders once the fence closes', async () => {
    const { container, rerender } = render(
      createElement(PeleRenderer, { code: FLOWCHART, isClosed: false }),
    )
    await settle()
    expect(container.querySelector('svg')).toBeNull()

    rerender(createElement(PeleRenderer, { code: FLOWCHART, isClosed: true }))
    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )
    expect(container.querySelector('pre')).toBeNull()
  })

  it('falls back to the raw source when the diagram cannot be rendered', async () => {
    const { renderAsync } = await import('pele/lazy')
    await expect(renderAsync(INVALID)).rejects.toMatchObject({
      name: 'PeleError',
    })

    const { container } = render(createElement(PeleRenderer, { code: INVALID }))
    await settle()

    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('pre')).not.toBeNull()
    expect(container.textContent).toContain('flowchart')
  })

  it('drops a previous diagram when the new source is invalid', async () => {
    const { container, rerender } = render(
      createElement(PeleRenderer, { code: FLOWCHART }),
    )
    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )

    rerender(createElement(PeleRenderer, { code: INVALID }))
    await waitFor(() => expect(container.querySelector('svg')).toBeNull())
    expect(container.querySelector('pre')).not.toBeNull()
  })

  it('passes options through to Pele', async () => {
    const styleOf = (container: HTMLElement) =>
      container.querySelector('svg.pele')?.getAttribute('style') ?? ''

    const fluid = render(createElement(PeleRenderer, { code: FLOWCHART }))
    await waitFor(() => expect(styleOf(fluid.container)).not.toBe(''))
    // Pele sizes diagrams fluidly by default...
    expect(styleOf(fluid.container)).toContain('max-width')

    const fixed = render(
      createElement(PeleRenderer, {
        code: FLOWCHART,
        options: { responsive: false },
      }),
    )
    await waitFor(() =>
      expect(fixed.container.querySelector('svg.pele')).not.toBeNull(),
    )
    // ...and `responsive: false` turns that off.
    expect(styleOf(fixed.container)).not.toContain('max-width')
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
    expect(ids).toHaveLength(6)
    expect(new Set(ids).size).toBe(6)
    expect(ids).toContain('custom-title')
    expect(ids).toContain('custom-desc')
    expect(ids.filter((id) => !id.startsWith('custom-'))).toEqual(
      expect.arrayContaining([expect.stringMatching(/^pele-[\w-]+-title$/)]),
    )
  })

  it('does not emit scripts or event handlers for hostile diagram source', async () => {
    const code = [
      'flowchart TD',
      '  A["<img src=x onerror=alert(1)>"] --> B["<script>alert(1)</script>"]',
      '  click A href "javascript:alert(1)"',
    ].join('\n')
    const { container } = render(createElement(PeleRenderer, { code }))
    await waitFor(() =>
      expect(container.querySelector('svg.pele')).not.toBeNull(),
    )

    expect(container.querySelector('script, img, foreignObject')).toBeNull()
    expect(container.innerHTML).not.toMatch(/onerror|javascript:/i)
  })
})
