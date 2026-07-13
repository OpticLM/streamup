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

  it('renders the latest markdown after a rerender (pacing=false)', () => {
    const { container, rerender } = render(
      createElement(Streamup, { streaming: true, pacing: false }, '# First'),
    )
    expect(container.querySelector('h1')?.textContent).toBe('First')
    rerender(
      createElement(
        Streamup,
        { streaming: true, pacing: false },
        '# First\n\n**bold**',
      ),
    )
    expect(container.querySelector('h1')?.textContent).toBe('First')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('catches up to the latest input after rapid sequential updates (pacing=false)', () => {
    const { container, rerender } = render(
      createElement(Streamup, { streaming: true, pacing: false }, 'a'),
    )
    rerender(createElement(Streamup, { streaming: true, pacing: false }, 'ab'))
    rerender(createElement(Streamup, { streaming: true, pacing: false }, 'abc'))
    rerender(
      createElement(Streamup, { streaming: true, pacing: false }, 'abcd'),
    )
    expect(container.textContent).toContain('abcd')
  })

  it('preserves DOM identity for settled blocks across chunks (pacing=false)', () => {
    const { container, rerender } = render(
      createElement(
        Streamup,
        { streaming: true, pacing: false },
        '# Title\n\nbody',
      ),
    )
    const firstH1 = container.querySelector('h1')
    expect(firstH1?.textContent).toBe('Title')
    rerender(
      createElement(
        Streamup,
        { streaming: true, pacing: false },
        '# Title\n\nbody\n\nmore body',
      ),
    )
    expect(container.querySelector('h1')).toBe(firstH1)
  })

  it('preserves DOM identity for a settled block as the tail moves past it (pacing=false)', () => {
    const { container, rerender } = render(
      createElement(
        Streamup,
        { streaming: true, pacing: false },
        '# Done\n\nsecond',
      ),
    )
    const settledH1 = container.querySelector('h1')
    rerender(
      createElement(
        Streamup,
        { streaming: true, pacing: false },
        '# Done\n\nsecond\n\nthird paragraph',
      ),
    )
    expect(container.querySelector('h1')).toBe(settledH1)
    expect(container.textContent).toContain('third paragraph')
  })
})

describe('Streamup adaptive pacing', () => {
  afterEach(() => {
    cleanup()
  })

  it('reveals content at the NORM rate (low <= buffer < high)', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: false,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, 'A'),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `A${'B'.repeat(20)}`,
        ),
      )
      // buffer 20 -> NORM, normCps 20, tickMs 100 -> 2 cp/tick
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('ABB')
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('ABBBB')
    } finally {
      vi.useRealTimers()
    }
  })

  it('slows to 1 char every 2 ticks when the buffer is nearly empty (< low)', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: false,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, 'A'),
      )
      // buffer 3 (< low=5) -> SLOW, slowCps 5, tickMs 100 -> 0.5 cp/tick -> 1 char / 2 ticks
      rerender(createElement(Streamup, { streaming: true, pacing }, 'ABCD'))
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('A') // credit 0.5 -> 0 emitted
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('AB') // credit 1.0 -> 1 emitted
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('AB') // credit 0.5 -> 0 emitted
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('ABC') // credit 1.0 -> 1 emitted
    } finally {
      vi.useRealTimers()
    }
  })

  it('drains a burst at the FAST rate (buffer >= high)', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: false,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, 'Z'),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `Z${'C'.repeat(101)}`,
        ),
      )
      // buffer 101 (>= high=50) -> FAST, fastCps 40, tickMs 100 -> 4 cp/tick
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe(`Z${'C'.repeat(4)}`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('scaleFast drains a large buffer in bounded time', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: true,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, 'Z'),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `Z${'C'.repeat(501)}`,
        ),
      )
      // buffer 500 -> scale min(10, 500/50)=10 -> 40*10=400 cps -> 40 cp/tick
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe(`Z${'C'.repeat(40)}`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes remaining content instantly when pacing is disabled', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: false,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, 'A'),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `A${'B'.repeat(20)}`,
        ),
      )
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('ABB') // mid-reveal
      // disable pacing (stream complete) -> snap to full received
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing: false },
          `A${'B'.repeat(20)}`,
        ),
      )
      expect(container.textContent).toBe(`A${'B'.repeat(20)}`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes the full document when streaming ends with default pacing', () => {
    vi.useFakeTimers()
    try {
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true }, 'A'),
      )
      rerender(
        createElement(Streamup, { streaming: true }, `A${'B'.repeat(20)}`),
      )
      // default pacing: tickMs 33, normCps 30 -> 0.99 cp/tick -> first tick emits 0
      act(() => {
        vi.advanceTimersByTime(33)
      })
      expect(container.textContent).toBe('A')
      // stream ends -> streaming false -> default pacing disables -> flush
      rerender(
        createElement(Streamup, { streaming: false }, `A${'B'.repeat(20)}`),
      )
      expect(container.textContent).toBe(`A${'B'.repeat(20)}`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reveals emoji whole, never splitting a surrogate pair', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 10,
        fastCps: 40,
        scaleFast: true,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, ''),
      )
      rerender(createElement(Streamup, { streaming: true, pacing }, 'a😀bcdef'))
      // normCps 10, tickMs 100 -> 1 cp/tick
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('a')
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('a😀')
      expect(container.textContent).not.toContain('�')
    } finally {
      vi.useRealTimers()
    }
  })

  it('clamps displayed when received shrinks below it', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 20,
        fastCps: 40,
        scaleFast: true,
      }
      const { container, rerender } = render(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `A${'B'.repeat(10)}`,
        ),
      )
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          `A${'B'.repeat(20)}`,
        ),
      )
      // reveal some (NORM 2 cp/tick)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      // shrink received below displayed
      rerender(createElement(Streamup, { streaming: true, pacing }, 'AB'))
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.textContent).toBe('AB')
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves DOM identity for a settled block while pacing reveals the tail', () => {
    vi.useFakeTimers()
    try {
      const pacing = {
        tickMs: 100,
        low: 5,
        high: 50,
        slowCps: 5,
        normCps: 100,
        fastCps: 40,
        scaleFast: false,
      }
      const { container, rerender } = render(
        createElement(Streamup, { streaming: true, pacing }, '# Title\n\nbody'),
      )
      const title = container.querySelector('h1')
      expect(title?.textContent).toBe('Title')
      // grow the trailing paragraph; the h1 must stay the same node
      rerender(
        createElement(
          Streamup,
          { streaming: true, pacing },
          '# Title\n\nbody growing',
        ),
      )
      // buffer 8, NORM 100cps -> 10 cp/tick -> emit min(10,8)=8 -> full reveal in 1 tick
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(container.querySelector('h1')).toBe(title)
      expect(container.textContent).toContain('growing')
    } finally {
      vi.useRealTimers()
    }
  })
})
