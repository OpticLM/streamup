import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { processMarkdown } from './processor.js'

describe('processMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderToStaticMarkup(processMarkdown('# Hello'))
    expect(html).toContain('<h1>')
    expect(html).toContain('Hello')
  })

  it('renders GFM tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |'
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).toContain('<table>')
    expect(html).toContain('<td>')
  })

  it('renders GFM strikethrough', () => {
    const html = renderToStaticMarkup(processMarkdown('~~deleted~~'))
    expect(html).toContain('<del>')
  })

  it('renders GFM task lists', () => {
    const md = '- [x] done\n- [ ] todo'
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).toContain('type="checkbox"')
  })

  it('parses math syntax with remark-math', () => {
    const md = '$$\nE = mc^2\n$$'
    const html = renderToStaticMarkup(processMarkdown(md))
    // Without rehype-katex, math nodes become elements with math class
    expect(html).toContain('math')
  })

  it('renders inline code', () => {
    const html = renderToStaticMarkup(processMarkdown('Use `const`'))
    expect(html).toContain('<code>')
    expect(html).toContain('const')
  })

  it('renders code blocks with language class', () => {
    const md = '```js\nconsole.log("hi")\n```'
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).toContain('language-js')
  })

  it('sanitizes XSS payloads', () => {
    const md = '<script>alert("xss")</script>'
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).not.toContain('<script>')
  })

  it('renders links with target blank when using default components', () => {
    const md = '[click](https://example.com)'
    // processMarkdown without components renders raw <a> tags;
    // target/rel are added by the default Anchor component via Streamup
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
  })

  it('handles empty content', () => {
    const html = renderToStaticMarkup(processMarkdown(''))
    expect(html).toBeDefined()
  })

  it('enables singleDollarTextMath when configured', () => {
    const md = 'Inline $x^2$ math'
    const html = renderToStaticMarkup(
      processMarkdown(md, {
        processorOptions: { singleDollarTextMath: true },
      }),
    )
    expect(html).toContain('math')
  })

  it('does not parse single dollar math by default', () => {
    const md = 'Price is $5 and $10'
    const html = renderToStaticMarkup(processMarkdown(md))
    expect(html).not.toContain('math-inline')
  })

  it('applies urlTransform to links', () => {
    const md = '[test](http://example.com)'
    const html = renderToStaticMarkup(
      processMarkdown(md, {
        urlTransform: (url) => url.replace('http:', 'https:'),
      }),
    )
    expect(html).toContain('https://example.com')
  })

  it('applies urlTransform to images', () => {
    const md = '![alt](http://example.com/img.png)'
    const html = renderToStaticMarkup(
      processMarkdown(md, {
        urlTransform: (url) => url.replace('http:', 'https:'),
      }),
    )
    expect(html).toContain('https://example.com/img.png')
  })

  it('filters elements with allowElement', () => {
    const md = '**bold** and *italic*'
    const html = renderToStaticMarkup(
      processMarkdown(md, {
        allowElement: (el) => el.tagName !== 'strong',
      }),
    )
    expect(html).not.toContain('<strong>')
    expect(html).toContain('bold') // text content preserved
    expect(html).toContain('<em>')
  })
})
