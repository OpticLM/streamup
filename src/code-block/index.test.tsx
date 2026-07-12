import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createProcessor, renderBlock } from '../parse/processor.js'
import { CODE_BLOCK_TAG, DefaultCodeBlock, rehypeCodeBlocks } from '.'
import type { CodeBlockProps } from './types.js'

const processor = createProcessor({
  extraRehypePlugins: rehypeCodeBlocks().rehypePlugins,
})

describe('rehypeCodeBlocks', () => {
  it('renders a mapped code-block component with clean language/code props', () => {
    const html = renderToStaticMarkup(
      renderBlock('```js\nconst x = 1\n```', {
        processor,
        components: { 'code-block': DefaultCodeBlock },
      }),
    )
    expect(html).toContain('language-js')
    expect(html).toContain('const x = 1')
  })

  it('produces a code-block element when unmapped (literal custom element)', () => {
    const html = renderToStaticMarkup(
      renderBlock('```js\nconst x = 1\n```', { processor }),
    )
    expect(html).toContain(`<${CODE_BLOCK_TAG}`)
    expect(html).toContain('const x = 1')
  })

  it('leaves inline code untouched', () => {
    const html = renderToStaticMarkup(
      renderBlock('Use `const` here', { processor }),
    )
    expect(html).toContain('<code>')
    expect(html).not.toContain(CODE_BLOCK_TAG)
  })

  it('passes an empty language for unlabeled fenced code', () => {
    const html = renderToStaticMarkup(
      renderBlock('```\nplain\n```', {
        processor,
        components: {
          'code-block': ({ language, code }: CodeBlockProps) =>
            createElement('div', { 'data-lang': language || 'none' }, code),
        },
      }),
    )
    expect(html).toContain('data-lang="none"')
    expect(html).toContain('plain')
  })

  it('escapes HTML inside code content', () => {
    const html = renderToStaticMarkup(
      renderBlock('```\n<script>alert(1)</script>\n```', {
        processor,
        components: { 'code-block': DefaultCodeBlock },
      }),
    )
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('alert(1)')
  })
})
