import type { Root } from 'hast'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { rehypeCodeBlock } from './rehype-code-block.js'

function process(md: string): Root {
  const tree = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCodeBlock)
    .runSync(unified().use(remarkParse).parse(md), md) as Root
  return tree
}

function findElement(tree: Root, tagName: string) {
  const results: ElementLike[] = []
  const visit = (node: typeof tree | ElementLike) => {
    if ('children' in node) {
      for (const child of (node as { children: unknown[] }).children) {
        if (child && typeof child === 'object' && 'type' in (child as object)) {
          const el = child as ElementLike
          if (el.type === 'element') results.push(el)
          visit(el)
        }
      }
    }
  }
  visit(tree)
  return results.filter((el) => el.tagName === tagName)
}

interface ElementLike {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children: ElementLike[]
}

describe('rehypeCodeBlock', () => {
  it('flattens fenced code blocks into <code data-block>', () => {
    const tree = process('```js\nconsole.log("hi")\n```')
    const pres = findElement(tree, 'pre')
    const codes = findElement(tree, 'code')
    expect(pres).toHaveLength(0)
    expect(codes).toHaveLength(1)
    expect(codes[0].properties?.dataBlock).toBe('')
    expect(codes[0].properties?.dataLanguage).toBe('js')
    expect(codes[0].properties?.className).toContain('language-js')
  })

  it('marks unlanguaged code blocks with data-block but not data-language', () => {
    const tree = process('```\nplain code\n```')
    const pres = findElement(tree, 'pre')
    const codes = findElement(tree, 'code')
    expect(pres).toHaveLength(0)
    expect(codes).toHaveLength(1)
    expect(codes[0].properties?.dataBlock).toBe('')
    expect(codes[0].properties?.dataLanguage).toBeUndefined()
  })

  it('does not flatten <pre> with non-code content', () => {
    const md = 'Some text\n\n```\ncode\n```'
    const tree = process(md)
    const pres = findElement(tree, 'pre')
    expect(pres).toHaveLength(0) // the only pre is from the code block, flattened
    const codes = findElement(tree, 'code')
    expect(codes).toHaveLength(1)
    expect(codes[0].properties?.dataBlock).toBe('')
  })

  it('does not add data-block to inline code', () => {
    const tree = process('Use `const` keyword')
    const codes = findElement(tree, 'code')
    expect(codes).toHaveLength(1)
    expect(codes[0].properties?.dataBlock).toBeUndefined()
  })

  it('handles mixed inline and block code', () => {
    const tree = process('Use `foo`:\n\n```js\nbar\n```')
    const codes = findElement(tree, 'code')
    expect(codes).toHaveLength(2)
    const inline = codes.find((c) => c.properties?.dataBlock === undefined)
    const block = codes.find((c) => c.properties?.dataBlock === '')
    expect(inline).toBeDefined()
    expect(block).toBeDefined()
    expect(block?.properties?.dataLanguage).toBe('js')
    expect(block?.properties?.className).toContain('language-js')
    expect(inline?.properties?.dataLanguage).toBeUndefined()
  })
})
