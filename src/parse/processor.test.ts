import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createProcessor, renderBlock } from './processor.js'

const processor = createProcessor({})
const render = (md: string) =>
  renderToStaticMarkup(renderBlock(md, { processor }))

describe('renderBlock', () => {
  it('renders basic markdown', () => {
    const html = render('# Hello')
    expect(html).toContain('<h1>')
    expect(html).toContain('Hello')
  })

  it('renders GFM tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |'
    expect(render(md)).toContain('<table>')
  })

  it('renders GFM strikethrough', () => {
    expect(render('~~deleted~~')).toContain('<del>')
  })

  it('renders GFM task lists', () => {
    expect(render('- [x] done\n- [ ] todo')).toContain('type="checkbox"')
  })

  it('parses math syntax with remark-math', () => {
    expect(render('$$\nE = mc^2\n$$')).toContain('math')
  })

  it('renders inline code', () => {
    const html = render('Use `const`')
    expect(html).toContain('<code>')
    expect(html).toContain('const')
  })

  it('renders fenced code blocks with a language class', () => {
    expect(render('```js\nconst x = 1\n```')).toContain('language-js')
  })

  it('sanitizes raw HTML', () => {
    expect(render('<script>alert("xss")</script>')).not.toContain('<script>')
  })

  it('renders links as native anchors', () => {
    const html = render('[click](https://example.com)')
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
  })

  it('handles empty content', () => {
    expect(render('')).toBeDefined()
  })

  it('enables single dollar math when configured', () => {
    const p = createProcessor({ singleDollarTextMath: true })
    const html = renderToStaticMarkup(
      renderBlock('Inline $x^2$ math', { processor: p }),
    )
    expect(html).toContain('math')
  })

  it('does not parse single dollar math by default', () => {
    expect(render('Price is $5 and $10')).not.toContain('math-inline')
  })
})
