import pierreLight from '@pierre/highlights/themes/pierre-light'
import { createHighlightsPlugin } from '@pierre/words/highlights'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CodeBlockProps } from './code-block.js'
import { CodeBlock } from './code-block.js'
import { Streamup } from './streamup.js'
import type { StreamupProps } from './types.js'

const render = (md: string, props: StreamupProps = {}) =>
  renderToStaticMarkup(createElement(Streamup, props, md))

// Shows exactly what a `code-block` component receives.
const Probe = ({ code, language, isIncomplete }: CodeBlockProps) =>
  createElement('i', {
    'data-code': code,
    'data-language': language,
    'data-incomplete': String(isIncomplete),
  })
const probe = (md: string, streaming = false) =>
  render(md, { streaming, components: { 'code-block': Probe } })

describe('code blocks', () => {
  it('render as native <pre><code> by default', () => {
    expect(render('```js\nconst x = 1\n```')).toBe(
      '<pre><code class="language-js">const x = 1\n</code></pre>',
    )
    expect(render('```\nplain\n```')).toBe('<pre><code>plain\n</code></pre>')
  })

  it('hand every fence to components["code-block"]', () => {
    expect(probe('```ts title="a.ts"\nlet a\n```')).toBe(
      '<i data-code="let a\n" data-language="ts" data-incomplete="false"></i>',
    )
    expect(probe('    indented\n')).toContain('data-language=""')
  })

  it('leave inline code alone', () => {
    expect(probe('Use `const` here')).toBe('<p>Use <code>const</code> here</p>')
  })

  it('reach a fence wherever it sits', () => {
    const out = probe(
      '> ```a\n> x\n> ```\n\n- ```b\n  y\n  ```\n\n- a\n  - ```c\n    z\n    ```',
    )
    expect([...out.matchAll(/data-language="(\w)"/g)].map((m) => m[1])).toEqual(
      ['a', 'b', 'c'],
    )
  })

  it('mark a fence as incomplete only while it streams', () => {
    expect(probe('```ts\nlet a\n', true)).toContain('data-incomplete="true"')
    expect(probe('```ts\nlet a\n```', true)).toContain(
      'data-incomplete="false"',
    )
    // The document ended inside the fence: the block is final.
    expect(probe('```ts\nlet a')).toContain('data-incomplete="false"')
  })

  it.each([
    ['a blockquote', '> ```ts\n> let a\n> ```'],
    ['a list', '- ```ts\n  let a\n  ```'],
    ['a nested list', '- a\n  - ```ts\n    let a\n    ```'],
  ])('see a fence closed inside %s as complete', (_, markdown) => {
    expect(probe(markdown, true)).toContain('data-incomplete="false"')
    // ...and the same fence without its closing line as still streaming.
    const open = markdown.split('\n').slice(0, -1).join('\n')
    expect(probe(open, true)).toContain('data-incomplete="true"')
  })

  it('see a fence its container ends as complete', () => {
    expect(probe('> ```ts\n> let a\n\nafter', true)).toContain(
      'data-incomplete="false"',
    )
  })

  it('hold back the LF of a line still being written', () => {
    expect(probe('```ts\nlet a\nlet', true)).toContain('data-code="let a\nlet"')
    expect(probe('```ts\nlet a\nlet\n', true)).toContain(
      'data-code="let a\nlet\n"',
    )
    expect(probe('- ```ts\n  let', true)).toContain('data-code="let"')
  })

  it('mark a streaming fence in the default rendering', () => {
    expect(render('```js\nlet', { streaming: true })).toBe(
      '<pre data-markdown-incomplete=""><code class="language-js">let</code></pre>',
    )
  })

  it('escape the code', () => {
    expect(render('```\n<script>alert(1)</script>\n```')).toBe(
      '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;\n</code></pre>',
    )
  })
})

describe('CodeBlock', () => {
  const highlighter = createHighlightsPlugin({ theme: pierreLight })
  const highlighted = (code: string, language: string) =>
    renderToStaticMarkup(
      createElement(CodeBlock, {
        code,
        language,
        isIncomplete: false,
        highlighter,
      }),
    )

  it('fills <code> with a Words highlighter', () => {
    expect(highlighted('const a = 1\n', 'ts')).toMatch(
      /^<pre><code class="language-ts"><span style="color:#[0-9a-f]+">const <\/span>.*<\/code><\/pre>$/s,
    )
  })

  it('keeps a language the highlighter does not know as plain text', () => {
    expect(highlighted('<b>\n', 'nope')).toBe(
      '<pre><code class="language-nope">&lt;b&gt;\n</code></pre>',
    )
  })

  it('escapes code the highlighter colours', () => {
    expect(highlighted('"<b>"\n', 'ts')).not.toContain('<b>')
  })
})
