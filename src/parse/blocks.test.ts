import { createHtmlSession } from '@pierre/words'
import { describe, expect, it } from 'vitest'
import { holdPendingFootnote, splitDocument, splitHtml } from './blocks.js'

const words = (md: string, incomplete = false) =>
  createHtmlSession().render(md, { incomplete, math: true }).html

describe('splitHtml', () => {
  it('splits a document into its top-level elements', () => {
    expect(splitHtml(words('# A\n\nB\n\n---\n\n- c\n  - d'))).toEqual([
      '<h1>A</h1>',
      '<p>B</p>',
      '<hr />',
      '<ul>\n<li>c\n<ul>\n<li>d</li>\n</ul>\n</li>\n</ul>',
    ])
  })

  it('keeps void and self-closing elements inside their block', () => {
    const md = '- [x] a  \n  b ![i](https://x.y/i.png)\n\nafter'
    const blocks = splitHtml(words(md))
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toBe('<p>after</p>')
  })

  it('reads tag-like text and attribute values as text', () => {
    const md =
      '[x](https://a.b/ "t<i>t>le/") `</p>` $a<b>c$\n\n```\n</pre>\n```'
    const blocks = splitHtml(words(md))
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toMatch(/^<pre>.*<\/pre>$/s)
  })

  it('keeps an open code fence as one block', () => {
    expect(splitHtml(words('intro\n\n```js\nlet a\n\nlet b', true))).toEqual([
      '<p>intro</p>',
      '<pre data-markdown-incomplete><code class="language-js">let a\n\nlet b\n</code></pre>',
    ])
  })

  it('handles empty input', () => {
    expect(splitHtml(words(''))).toEqual([])
  })
})

describe('splitDocument', () => {
  const md = 'A[^1] B[^note].\n\n[^1]: One.\n\n[^note]: Two *b*.\n\n    Para.'

  it('keeps the footnote section as a block in section mode', () => {
    const { blocks, footnotes } = splitDocument(words(md))
    expect(blocks).toHaveLength(2)
    expect(blocks[1]).toMatch(/^<section class="footnotes" data-footnotes>/)
    expect(footnotes.size).toBe(0)
  })

  it('lifts each footnote out of the body in inline mode', () => {
    const { blocks, footnotes } = splitDocument(words(md), 'inline')
    expect(blocks).toHaveLength(1)
    expect(footnotes).toEqual(
      new Map([
        ['1', '<p>One.</p>'],
        ['2', '<p>Two <em>b</em>.</p>\n<p>Para.</p>'],
      ]),
    )
  })

  it('drops every backref, including those of repeated references', () => {
    const { footnotes } = splitDocument(
      words('A[^1] B[^1]\n\n[^1]: One.'),
      'inline',
    )
    expect(footnotes.get('1')).toBe('<p>One.</p>')
  })

  it('leaves out a definition with no content yet', () => {
    const { footnotes } = splitDocument(words('A[^1]\n\n[^1]:', true), 'inline')
    expect(footnotes.size).toBe(0)
  })
})

describe('holdPendingFootnote', () => {
  it.each(['[', '[^', '[^2', '[^2]'])(
    'holds back the opening of a definition (%s)',
    (opening) => {
      expect(holdPendingFootnote(`A[^1].\n\n[^1]: One.\n\n${opening}`)).toBe(
        'A[^1].\n\n[^1]: One.\n\n',
      )
    },
  )

  it('holds back an unclosed reference', () => {
    expect(holdPendingFootnote('Claim[^1')).toBe('Claim')
  })

  it('leaves complete references and other brackets alone', () => {
    for (const md of ['Claim[^1]', 'A [link', 'a[b', 'x [^1]: y'])
      expect(holdPendingFootnote(md)).toBe(md)
  })
})
