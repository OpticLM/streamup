import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { Streamup } from './streamup.js'
import type { StreamupProps } from './types.js'

afterEach(cleanup)

const TOKEN = '<span data-markdown="token">'
const CARET =
  '<span data-markdown="caret" data-shape="block" aria-hidden="true"></span>'

/** Mount a stream that reveals each change at once, and update it in place. */
function stream(props: StreamupProps = {}) {
  const element = (markdown: string, streaming: boolean) =>
    createElement(Streamup, { pacing: false, ...props, streaming }, markdown)
  const { container, rerender } = render(element('', true))
  return {
    update(markdown: string, streaming = true) {
      rerender(element(markdown, streaming))
      return container.innerHTML
    },
  }
}

const plain = (markdown: string) =>
  renderToStaticMarkup(createElement(Streamup, null, markdown))

describe('animated', () => {
  it('wraps each arrival of text in its own token, and keeps earlier ones', () => {
    const s = stream({ animated: true })
    expect(s.update('Hello')).toBe(`<p>${TOKEN}Hello</span></p>`)
    // The space arrived with `wor`, so it fades with it.
    expect(s.update('Hello **wor')).toBe(
      `<p>${TOKEN}Hello</span>${TOKEN} </span><strong>${TOKEN}wor</span></strong></p>`,
    )
  })

  it('fades a new block whole', () => {
    const s = stream({ animated: true })
    s.update('One')
    expect(s.update('One\n\nTwo')).toBe(
      `<p>${TOKEN}One</span></p><p>${TOKEN}Two</span></p>`,
    )
  })

  it('leaves code blocks and math alone', () => {
    const s = stream({ animated: true })
    const html = s.update('$x^2$ and\n\n```js\nlet a')
    expect(html).toContain(`${TOKEN} and</span>`)
    expect(html.match(/<svg.*<\/svg>/s)?.[0]).not.toContain('data-markdown')
    expect(html).toContain('<code class="language-js">let a</code>')
  })

  it('never wraps whitespace between elements', () => {
    const s = stream({ animated: true })
    expect(s.update('- a\n- b')).toBe(
      `<ul>\n<li>${TOKEN}a</span></li>\n<li>${TOKEN}b</span></li>\n</ul>`,
    )
  })

  it('does not fade text already on screen when the stream starts', () => {
    const s = stream({ animated: true })
    s.update('Shown', false)
    expect(s.update('Shown\n\nNew')).toBe(
      `<p>Shown</p><p>${TOKEN}New</span></p>`,
    )
  })

  it('does nothing unless streaming', () => {
    expect(
      renderToStaticMarkup(
        createElement(Streamup, { animated: true, caret: 'block' }, 'Hi'),
      ),
    ).toBe('<p>Hi</p>')
  })
})

describe('caret', () => {
  const at = (markdown: string, props: StreamupProps = {}) =>
    stream({ caret: 'block', ...props }).update(markdown)

  it('sits at the end of the last paragraph', () => {
    expect(at('One\n\nTwo **b')).toBe(
      `<p>One</p><p>Two <strong>b</strong>${CARET}</p>`,
    )
  })

  it('goes into the deepest last block', () => {
    expect(at('- a\n  - b')).toContain(`<li>b${CARET}</li>`)
    expect(at('| a |\n|---|\n| b |')).toContain(`<td>b${CARET}</td>`)
  })

  it('sits at the end of the last line of code', () => {
    expect(at('```js\nlet a\n')).toBe(
      `<pre data-markdown-incomplete=""><code class="language-js">let a${CARET}</code></pre>`,
    )
  })

  it('stays out of the footnote section', () => {
    expect(at('A[^1] b\n\n[^1]: Note.')).toMatch(
      new RegExp(`^<p>A<sup.*</sup> b${CARET}</p><section`),
    )
  })

  it('takes the circle shape', () => {
    expect(at('Hi', { caret: 'circle' })).toContain('data-shape="circle"')
  })
})

describe('the finished document', () => {
  it('is the same HTML as without the effects', () => {
    const markdown =
      '# Title\n\nSome **bold** text and `code`.\n\n- a\n- b\n\n```js\nlet a = 1\n```\n\nEnd.'
    const s = stream({ animated: true, caret: 'block' })
    for (let i = 1; i <= markdown.length; i++) s.update(markdown.slice(0, i))
    expect(s.update(markdown)).toContain(TOKEN)
    expect(s.update(markdown, false)).toBe(plain(markdown))
  })
})
