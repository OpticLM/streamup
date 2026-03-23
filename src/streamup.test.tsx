import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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

  it('applies className to wrapper', () => {
    const html = renderToStaticMarkup(
      createElement(Streamup, { className: 'my-class' }, 'Hi'),
    )
    expect(html).toContain('class="my-class"')
  })

  it('renders with custom components', () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        {
          components: {
            h1: ({ children }) =>
              createElement('div', { className: 'title' }, children),
          },
        },
        '# Custom',
      ),
    )
    expect(html).toContain('class="title"')
    expect(html).not.toContain('<h1>')
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
    // Without remend, ** at start without closing just renders as text
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

  it('transforms URLs with urlTransform', () => {
    const md = '[link](http://example.com)'
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        { urlTransform: (url: string) => url.replace('http:', 'https:') },
        md,
      ),
    )
    expect(html).toContain('https://example.com')
    expect(html).not.toContain('http://example.com')
  })

  it('removes URLs when urlTransform returns null', () => {
    const md = '[link](http://evil.com)'
    const html = renderToStaticMarkup(
      createElement(Streamup, { urlTransform: () => null }, md),
    )
    expect(html).not.toContain('href')
  })

  it('filters elements with allowElement', () => {
    const md = '**bold** and *italic*'
    const html = renderToStaticMarkup(
      createElement(
        Streamup,
        { allowElement: (el) => el.tagName !== 'em' },
        md,
      ),
    )
    expect(html).toContain('<strong>')
    expect(html).not.toContain('<em>')
    // The italic text content should still be present (unwrapped)
    expect(html).toContain('italic')
  })
})
