import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import type { StreamupComponents } from '../types.js'
import { CODE_BLOCK_TAG, codeBlocks, DefaultCodeBlock } from '.'
import type { CodeBlockProps } from './types.js'

const plugins = [codeBlocks()]
const render = (md: string, components?: StreamupComponents) =>
  renderToStaticMarkup(createElement(Streamup, { plugins, components }, md))

describe('rehypeCodeBlocks', () => {
  it('renders a mapped code-block component with clean language/code props', () => {
    const html = render('```js\nconst x = 1\n```', {
      'code-block': DefaultCodeBlock,
    })
    expect(html).toBe(
      '<pre><code class="language-js">const x = 1\n</code></pre>',
    )
  })

  it('produces a code-block element when unmapped (literal custom element)', () => {
    const html = render('```js\nconst x = 1\n```')
    expect(html).toContain(`<${CODE_BLOCK_TAG}`)
    expect(html).toContain('const x = 1')
  })

  it('leaves inline code untouched', () => {
    const html = render('Use `const` here')
    expect(html).toContain('<code>')
    expect(html).not.toContain(CODE_BLOCK_TAG)
  })

  it('passes an empty language for unlabeled fenced code', () => {
    const html = render('```\nplain\n```', {
      'code-block': ({ language, code }: CodeBlockProps) =>
        createElement('div', { 'data-lang': language || 'none' }, code),
    })
    expect(html).toContain('data-lang="none"')
    expect(html).toContain('plain')
  })

  it('escapes HTML inside code content', () => {
    const html = render('```\n<script>alert(1)</script>\n```', {
      'code-block': DefaultCodeBlock,
    })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('alert(1)')
  })
})
