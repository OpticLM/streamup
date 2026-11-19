import type { Root } from 'hast'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import type { StreamupProps } from '../types.js'

const render = (md: string, props: StreamupProps = {}) =>
  renderToStaticMarkup(createElement(Streamup, props, md))

describe('rendering', () => {
  it('renders GFM', () => {
    const html = render(
      '| A | B |\n|---|:-:|\n| 1 | 2 |\n\n~~gone~~ `code`\n\n- [x] done',
    )
    expect(html).toContain('<th style="text-align:center">B</th>')
    expect(html).toContain('<del>gone</del> <code>code</code>')
    expect(html).toContain('<input disabled="" type="checkbox" checked=""/>')
  })

  it('renders fenced code with a language class', () => {
    expect(render('```js\nconst x = 1\n```')).toBe(
      '<pre><code class="language-js">const x = 1\n</code></pre>',
    )
  })

  it('renders math as SVG, and leaves it as text without `math`', () => {
    expect(render('$x^2$ and\n\n$$\nE = mc^2\n$$')).toMatch(
      /^<p><svg [^>]*aria-label="x\^2".*<\/svg> and<\/p><svg [^>]*aria-label="E = mc\^2\n"/s,
    )
    expect(render('Price: $5 and $10')).toBe('<p>Price: $5 and $10</p>')
    expect(render('$x^2$', { math: false })).toBe('<p>$x^2$</p>')
  })

  it('lets emphasis open and close next to CJK text', () => {
    expect(render('中文**强调**中文')).toBe(
      '<p>中文<strong>强调</strong>中文</p>',
    )
  })

  it('ends an autolink at CJK punctuation', () => {
    expect(render('见 https://example.com/路径。下一句')).toBe(
      '<p>见 <a href="https://example.com/%E8%B7%AF%E5%BE%84">https://example.com/路径</a>。下一句</p>',
    )
    expect(render('www.example.com，好')).toBe(
      '<p><a href="http://www.example.com">www.example.com</a>，好</p>',
    )
  })

  it('omits raw HTML and keeps its text', () => {
    expect(render('H<sub>2</sub>O <script>alert(1)</script>')).toBe(
      '<p>H2O alert(1)</p>',
    )
  })

  it('drops unsafe URLs and keeps safe ones', () => {
    const html = render(
      '[a](javascript:alert(1)) [b](https://x.y) [c](/rel) [d](mailto:a@b.c) ![e](data:image/png;base64,x)',
    )
    expect(html).toBe(
      '<p><a>a</a> <a href="https://x.y">b</a> <a href="/rel">c</a> <a href="mailto:a@b.c">d</a> <img alt="e"/></p>',
    )
  })

  it('marks syntax that is still streaming', () => {
    expect(render('[a link', { streaming: true })).toBe(
      '<p><a data-markdown-incomplete="">a link</a></p>',
    )
    expect(render('```js\nlet', { streaming: true })).toContain(
      '<pre data-markdown-incomplete="">',
    )
  })

  it('runs rehype plugins on every block', () => {
    const tags: string[] = []
    const probe = () => (tree: Root) => {
      visit(tree, 'element', (node) => {
        tags.push(node.tagName)
      })
    }
    render('# A\n\nB', { plugins: [{ rehypePlugins: [probe] }] })
    expect(tags).toEqual(['h1', 'p'])
  })
})

describe('footnotes', () => {
  it('links every reference and backref to a matching id', () => {
    const html = render(
      'Alpha[^1], beta[^1], gamma[^note].\n\n[^1]: first.\n[^note]: second.',
    )
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    expect(fragments).toHaveLength(6)
    for (const fragment of fragments) {
      expect(ids.has(fragment), `no id for href #${fragment}`).toBe(true)
    }
  })

  it('shows a reference without a definition as text', () => {
    expect(render('Body[^1].')).toBe('<p>Body[^1].</p>')
  })
})
