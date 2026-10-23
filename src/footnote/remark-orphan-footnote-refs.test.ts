import type { Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { describe, expect, it } from 'vitest'
import { remarkOrphanFootnoteRefs } from './remark-orphan-footnote-refs.js'

const gfm = unified().use(remarkParse).use(remarkGfm)
const orphans = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkOrphanFootnoteRefs)

/** The identifiers of every footnote reference in `md`. */
function refs(processor: typeof gfm, md: string): string[] {
  const found: string[] = []
  visit(processor.parse(md) as Root, 'footnoteReference', (node) => {
    found.push(node.identifier)
  })
  return found
}

describe('remarkOrphanFootnoteRefs', () => {
  it('parses a reference without a definition', () => {
    expect(refs(gfm, 'Hello[^1] world')).toEqual([])
    expect(refs(orphans, 'Hello[^1] world')).toEqual(['1'])
  })

  it('parses adjacent references', () => {
    expect(refs(orphans, 'A[^1][^Note]')).toEqual(['1', 'note'])
  })

  it('keeps label escapes', () => {
    expect(refs(orphans, 'A[^a\\]b]')).toEqual(['a\\]b'])
  })

  it.each([
    ['an escaped bracket', '\\[^1]'],
    ['inline code', '`[^1]`'],
    ['a label with whitespace', '[^a b]'],
    ['an empty label', '[^]'],
    ['an unclosed label', '[^1'],
  ])('leaves %s alone', (_, md) => {
    expect(refs(orphans, md)).toEqual([])
  })

  it('leaves defined references and their definitions intact', () => {
    const tree = orphans.parse('Body[^1]\n\n[^1]: def') as Root
    expect(tree.children.map((node) => node.type)).toEqual([
      'paragraph',
      'footnoteDefinition',
    ])
    expect(refs(orphans, 'Body[^1]\n\n[^1]: def')).toEqual(['1'])
  })
})
