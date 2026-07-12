import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createProcessor, renderBlock } from '../parse/processor.js'
import { katex } from './index.js'

const processor = createProcessor({ extraRehypePlugins: katex().rehypePlugins })
const render = (md: string) =>
  renderToStaticMarkup(renderBlock(md, { processor }))

describe('katex', () => {
  it('renders block math to KaTeX HTML', () => {
    expect(render('$$\nE = mc^2\n$$')).toContain('katex')
  })

  it('renders inline math to KaTeX HTML', () => {
    const p = createProcessor({
      singleDollarTextMath: true,
      extraRehypePlugins: katex().rehypePlugins,
    })
    const html = renderToStaticMarkup(
      renderBlock('Inline $x^2$ here', { processor: p }),
    )
    expect(html).toContain('katex')
  })

  it('renders fenced math (```math) as display', () => {
    expect(render('```math\nE = mc^2\n```')).toContain('katex')
  })

  it('falls back to plain text on invalid TeX', () => {
    const html = render('$$\n\\notARealCommand\n$$')
    expect(html).not.toContain('katex')
    expect(html).toContain('notARealCommand')
  })
})
