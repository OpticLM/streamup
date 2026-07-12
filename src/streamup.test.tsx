import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rehypeCodeBlocks } from './code-block/index.js'
import type { CodeBlockProps } from './code-block/types.js'
import { extractLanguage, findCode, textOf } from './parse/processor.js'
import { Streamup } from './streamup.js'

describe('Streamup', () => {
  it('renders basic markdown', () => {
    const html = renderToStaticMarkup(createElement(Streamup, null, '# Hello'))
    expect(html).toContain('<h1>')
    expect(html).toContain('Hello')
  })

  it('renders paragraphs', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, null, 'Hello world'),
    )
    expect(html).toContain('<p>')
  })

  it('renders blocks with no wrapper element', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, null, '# A\n\n# B\n\n# C'),
    )
    expect(html).toBe('<h1>A</h1><h1>B</h1><h1>C</h1>')
  })

  it('handles empty children', () => {
    const html = renderToStaticMarkup(createElement(Streamup, null))
    expect(html).toBeDefined()
  })

  it('heals incomplete markdown in streaming mode', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, '**bold'),
    )
    expect(html).toContain('<strong>')
  })

  it('does not heal markdown when streaming is false', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: false }, '**not closed'),
    )
    expect(html).not.toContain('<strong>')
  })

  it('renders multiple blocks', () => {
    const md = '# Title\n\nParagraph\n\n- item'
    const html = renderToStaticMarkup(createElement(Streamup, null, md))
    expect(html).toContain('<h1>')
    expect(html).toContain('<p>')
    expect(html).toContain('<li>')
  })

  it('renders GFM features', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |'
    const html = renderToStaticMarkup(createElement(Streamup, null, md))
    expect(html).toContain('<table>')
  })

  it('enables single dollar math with singleDollarTextMath', () => {
    const md = 'Inline $x^2$ math'
    const html = renderToStaticMarkup(
      createElement(Streamup, { singleDollarTextMath: true }, md),
    )
    expect(html).toContain('math')
  })

  it('sanitizes raw HTML', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, null, '<script>alert("xss")</script>'),
    )
    expect(html).not.toContain('<script>')
  })

  it('renders a code-block component mapped via rehypeCodeBlocks', () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          plugins: [rehypeCodeBlocks()],
          components: {
            'code-block': ({ language, code }: CodeBlockProps) =>
              createElement('pre', { 'data-lang': language }, code),
          },
        },
        '```js\nconst x = 1\n```',
      ),
    )
    expect(html).toContain('data-lang="js"')
    expect(html).toContain('const x = 1')
  })

  it('supports overriding pre directly via components (native path)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          components: {
            pre: ({ node, children }) => {
              const code = node ? findCode(node) : undefined
              if (code) {
                return createElement(
                  'pre',
                  { 'data-lang': extractLanguage(code.properties?.className) },
                  textOf(code),
                )
              }
              return createElement('pre', null, children)
            },
          },
        },
        '```js\nconst x = 1\n```',
      ),
    )
    expect(html).toContain('data-lang="js"')
    expect(html).toContain('const x = 1')
  })

  it('renders native pre>code with language class by default', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, null, '```js\nconst x = 1\n```'),
    )
    expect(html).toContain('language-js')
    expect(html).toContain('const x = 1')
    expect(html).toContain('<pre>')
  })

  it('handles unlabeled fenced code via rehypeCodeBlocks', () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          plugins: [rehypeCodeBlocks()],
          components: {
            'code-block': ({ language, code }: CodeBlockProps) =>
              createElement('div', { 'data-lang': language || 'none' }, code),
          },
        },
        '```\nplain code\n```',
      ),
    )
    expect(html).toContain('data-lang="none"')
    expect(html).toContain('plain code')
  })
})

describe('Streamup streaming', () => {
  afterEach(() => {
    cleanup()
  })

  it('heals trailing **bold even when settled blocks precede it', () => {
    const md = '# Heading\n\nfirst para\n\n**bo'
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, md),
    )
    expect(html).toContain('<h1>')
    expect(html).toContain('first para')
    expect(html).toContain('<strong>bo</strong>')
  })

  it('heals trailing unclosed inline code', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, 'before `code-open'),
    )
    expect(html).toMatch(/<code>code-open<\/code>/)
  })

  it('heals trailing unclosed fenced code block', () => {
    const md = '# Title\n\n```js\nconsole.log'
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, md),
    )
    expect(html).toContain('console.log')
    expect(html).toMatch(/<code[^>]*>/)
  })

  it('heals trailing unclosed block math', () => {
    const md = 'intro\n\n$$E=mc^2'
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, md),
    )
    expect(html).toContain('math')
  })

  it('leaves mid-buffer unclosed syntax alone', () => {
    const md = '**unclosed paragraph\n\nfinal text'
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, md),
    )
    expect(html).not.toContain('<strong>')
    expect(html).not.toContain('final text**')
    expect(html).toContain('final text')
  })

  it('progressively renders a chunked stream', () => {
    const chunks = [
      '#',
      '# T',
      '# Ti',
      '# Title',
      '# Title\n\n',
      '# Title\n\n**bo',
      '# Title\n\n**bold',
      '# Title\n\n**bold**',
      '# Title\n\n**bold**\n\nplai',
      '# Title\n\n**bold**\n\nplain',
    ]
    for (const md of chunks) {
      const html = renderToStaticMarkup(
        createElement(Streamup, { streaming: true }, md),
      )
      expect(html).toBeTruthy()
    }
    const finalHtml = renderToStaticMarkup(
      createElement(
        Streamup,
        { streaming: true },
        '# Title\n\n**bold**\n\nplain',
      ),
    )
    expect(finalHtml).toContain('<h1>')
    expect(finalHtml).toContain('Title')
    expect(finalHtml).toContain('<strong>bold</strong>')
    expect(finalHtml).toContain('plain')
  })

  it('is a no-op when the tail is already closed', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: true }, '# Hello\n\n**bold**'),
    )
    expect(html).toContain('<h1>')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('does not heal when streaming is false', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { streaming: false }, '# Title\n\n**bold'),
    )
    expect(html).not.toContain('<strong>')
  })

  it('renders the latest markdown after a rerender (throttleMs=0)', () => {
    const { container, rerender } = render(
      createElement(Streamup, { streaming: true, throttleMs: 0 }, '# First'),
    )
    expect(container.querySelector('h1')?.textContent).toBe('First')
    rerender(
      createElement(
        Streamup,
        { streaming: true, throttleMs: 0 },
        '# First\n\n**bold**',
      ),
    )
    expect(container.querySelector('h1')?.textContent).toBe('First')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('catches up to the latest input after rapid sequential updates (throttleMs=0)', () => {
    const { container, rerender } = render(
      createElement(Streamup, { streaming: true, throttleMs: 0 }, 'a'),
    )
    rerender(createElement(Streamup, { streaming: true, throttleMs: 0 }, 'ab'))
    rerender(createElement(Streamup, { streaming: true, throttleMs: 0 }, 'abc'))
    rerender(
      createElement(Streamup, { streaming: true, throttleMs: 0 }, 'abcd'),
    )
    expect(container.textContent).toContain('abcd')
  })

  it('preserves DOM identity for settled blocks across chunks (throttleMs=0)', () => {
    const { container, rerender } = render(
      createElement(
        Streamup,
        { streaming: true, throttleMs: 0 },
        '# Title\n\nbody',
      ),
    )
    const firstH1 = container.querySelector('h1')
    expect(firstH1?.textContent).toBe('Title')
    rerender(
      createElement(
        Streamup,
        { streaming: true, throttleMs: 0 },
        '# Title\n\nbody\n\nmore body',
      ),
    )
    expect(container.querySelector('h1')).toBe(firstH1)
  })

  it('preserves DOM identity for a settled block as the tail moves past it (throttleMs=0)', () => {
    const { container, rerender } = render(
      createElement(
        Streamup,
        { streaming: true, throttleMs: 0 },
        '# Done\n\nsecond',
      ),
    )
    const settledH1 = container.querySelector('h1')
    rerender(
      createElement(
        Streamup,
        { streaming: true, throttleMs: 0 },
        '# Done\n\nsecond\n\nthird paragraph',
      ),
    )
    expect(container.querySelector('h1')).toBe(settledH1)
    expect(container.textContent).toContain('third paragraph')
  })

  it('throttles re-renders to the latest value after throttleMs', () => {
    vi.useFakeTimers()
    try {
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, throttleMs: 50 }, '# First'),
      )
      expect(container.querySelector('h1')?.textContent).toBe('First')
      rerender(
        createElement(
          Streamup,
          { streaming: true, throttleMs: 50 },
          '# First\n\n**bold**',
        ),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, throttleMs: 50 },
          '# First\n\n**bold**\n\nmore',
        ),
      )
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(container.querySelector('h1')?.textContent).toBe('First')
      expect(container.querySelector('strong')?.textContent).toBe('bold')
      expect(container.textContent).toContain('more')
    } finally {
      vi.useRealTimers()
    }
  })
})
