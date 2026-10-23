import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { createProcessor } from '../parse/processor.js'

const processor = createProcessor({ footnotes: 'inline' })

function run(md: string): Root {
  return processor.runSync(processor.parse(md), md) as Root
}

function elements(tree: Root, tagName: string): Element[] {
  const found: Element[] = []
  visit(tree, 'element', (node) => {
    if (node.tagName === tagName) found.push(node)
  })
  return found
}

describe('rehypeInlineFootnotes', () => {
  it('turns a reference into a footnote-ref element', () => {
    const tree = run('Body[^1] text.')
    expect(elements(tree, 'sup')).toEqual([])
    expect(elements(tree, 'footnote-ref').map((el) => el.properties)).toEqual([
      { label: '1' },
    ])
  })

  it('keeps the label as written', () => {
    const tree = run('A[^Note] and B[^note]')
    expect(
      elements(tree, 'footnote-ref').map((el) => el.properties.label),
    ).toEqual(['Note', 'note'])
  })

  it('drops the footnote section', () => {
    const tree = run('Body[^1].\n\n[^1]: The def.')
    expect(elements(tree, 'section')).toEqual([])
    expect(elements(tree, 'footnote-ref')).toHaveLength(1)
  })

  it('leaves raw HTML footnote markup alone', () => {
    const tree = run('<sup><a href="#x" data-footnote-ref>1</a></sup>')
    expect(elements(tree, 'footnote-ref')).toEqual([])
    expect(elements(tree, 'sup')).toHaveLength(1)
  })

  it('runs before user rehype plugins', () => {
    const seen: string[] = []
    const probe = () => (tree: Root) => {
      visit(tree, 'element', (node) => {
        seen.push(node.tagName)
      })
    }
    const withProbe = createProcessor({
      footnotes: 'inline',
      extraRehypePlugins: [probe],
    })
    withProbe.runSync(withProbe.parse('A[^1]'), 'A[^1]')
    expect(seen).toContain('footnote-ref')
  })
})
