import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('Streamup streaming optimizations', () => {
  afterEach(() => {
    cleanup()
  })

  describe('tail-only remend', () => {
    it('heals trailing **bold even when settled blocks precede it', () => {
      // After the split-first reorder, remend runs only on the trailing
      // block. The prior settled blocks (heading, first paragraph) must
      // not prevent the tail heal from firing.
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
      // remend closes the fence; the code element should now render
      expect(html).toMatch(/<code[^>]*>/)
    })

    it('heals trailing unclosed block math', () => {
      const md = 'intro\n\n$$E=mc^2'
      const html = renderToStaticMarkup(
        createElement(Streamup, { streaming: true }, md),
      )
      // remark-math wraps math content in elements with a math className
      expect(html).toContain('math')
    })

    it('leaves mid-buffer unclosed syntax alone', () => {
      // The trailing block here is `final text` (fully closed). The
      // unclosed ** belongs to a non-trailing paragraph, so tail-only
      // heal does not patch it. Critically, the final paragraph must
      // not receive a phantom ** appended by a full-buffer scan.
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
      // remend returns the input by reference when nothing needs healing;
      // the short-circuit in streamup.tsx preserves the parsed array.
      const html = renderToStaticMarkup(
        createElement(Streamup, { streaming: true }, '# Hello\n\n**bold**'),
      )
      expect(html).toContain('<h1>')
      expect(html).toContain('<strong>bold</strong>')
    })

    it('does not heal when streaming is false', () => {
      // The split-first reorder must still gate on the `streaming` flag.
      const html = renderToStaticMarkup(
        createElement(Streamup, { streaming: false }, '# Title\n\n**bold'),
      )
      expect(html).not.toContain('<strong>')
    })
  })

  describe('useDeferredValue path', () => {
    it('renders the latest markdown after a rerender', () => {
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true }, '# First'),
      )
      expect(container.querySelector('h1')?.textContent).toBe('First')

      rerender(
        createElement(Streamup, { streaming: true }, '# First\n\n**bold**'),
      )
      expect(container.querySelector('h1')?.textContent).toBe('First')
      expect(container.querySelector('strong')?.textContent).toBe('bold')
    })

    it('catches up to the latest input after rapid sequential updates', () => {
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true }, 'a'),
      )
      rerender(createElement(Streamup, { streaming: true }, 'ab'))
      rerender(createElement(Streamup, { streaming: true }, 'abc'))
      rerender(createElement(Streamup, { streaming: true }, 'abcd'))
      // useDeferredValue may defer intermediate renders, but the final
      // commit must converge on the latest input.
      expect(container.textContent).toContain('abcd')
    })

    it('preserves DOM identity for settled blocks across chunks', () => {
      // The block cache returns a stable React element reference for an
      // unchanged block. Combined with stable positional Fragment keys,
      // the underlying DOM node should not be remounted when new blocks
      // arrive after it.
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true }, '# Title\n\nbody'),
      )
      const firstH1 = container.querySelector('h1')
      expect(firstH1?.textContent).toBe('Title')

      rerender(
        createElement(
          Streamup,
          { streaming: true },
          '# Title\n\nbody\n\nmore body',
        ),
      )
      const nextH1 = container.querySelector('h1')
      expect(nextH1).toBe(firstH1)
    })

    it('preserves DOM identity for a settled block as the tail moves past it', () => {
      // The streaming case: a block was the tail (with partial content),
      // then settled with completed content, then a new tail follows.
      // The completed block's DOM should still survive the transition.
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true }, '# Done\n\nsecond'),
      )
      const settledH1 = container.querySelector('h1')

      rerender(
        createElement(
          Streamup,
          { streaming: true },
          '# Done\n\nsecond\n\nthird paragraph',
        ),
      )
      expect(container.querySelector('h1')).toBe(settledH1)
      expect(container.textContent).toContain('third paragraph')
    })
  })

  describe('DOM shape', () => {
    it('does not wrap individual blocks in extra <div>s', () => {
      // Fragment-based composition: only the outer wrapper div appears
      // around the content, no per-block divs.
      const md = '# A\n\n# B\n\n# C'
      const html = renderToStaticMarkup(
        createElement(Streamup, { className: 'wrap' }, md),
      )
      expect(html).toBe(
        '<div class="wrap"><h1>A</h1><h1>B</h1><h1>C</h1></div>',
      )
    })
  })
})
