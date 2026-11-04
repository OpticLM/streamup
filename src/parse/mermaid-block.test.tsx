import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Streamup } from '../streamup.js'
import { MERMAID_BLOCK_TAG, mermaid } from './mermaid-block.js'

// Stands in for a renderer, so these tests only see what the plugin hands over.
const Block = ({ code, isClosed }: { code: string; isClosed: boolean }) =>
  createElement('i', { 'data-closed': String(isClosed) }, code)

const html = (markdown: string) =>
  renderToStaticMarkup(
    createElement(
      Streamup,
      {
        streaming: true,
        plugins: [mermaid()],
        components: { [MERMAID_BLOCK_TAG]: Block },
      },
      markdown,
    ),
  )

describe('mermaid', () => {
  it('hands each mermaid fence to components["mermaid-block"]', () => {
    const out = html('```mermaid\npie title Pets\n    "Dogs" : 386\n```')
    // The plugin consumed the block, so there is no native code element.
    expect(out).not.toContain('language-mermaid')
    expect(out).toContain('pie title Pets')
    expect(out).toContain('&quot;Dogs&quot;')
  })

  it('marks whether the fence is closed', () => {
    expect(html('```mermaid\nflowchart TD\n    A --> B')).toContain(
      'data-closed="false"',
    )
    expect(html('```mermaid\nflowchart TD\n    A --> B\n```')).toContain(
      'data-closed="true"',
    )
  })

  it.each([
    ['a blockquote', '> ```mermaid\n> flowchart TD\n>   A --> B\n> ```'],
    ['a list', '- ```mermaid\n  flowchart TD\n    A --> B\n  ```'],
    [
      'a nested list',
      '- a\n  - ```mermaid\n    flowchart TD\n      A --> B\n    ```',
    ],
  ])('sees a fence closed inside %s as closed', (_, markdown) => {
    expect(html(markdown)).toContain('data-closed="true"')
    // ...and the same fence without its closing line is still open.
    const open = markdown.split('\n').slice(0, -1).join('\n')
    expect(html(open)).toContain('data-closed="false"')
  })

  it('replaces every mermaid fence in place, wherever it sits', () => {
    const out = html(
      [
        '```mermaid\nflowchart TD\n  A --> B\n```',
        '```mermaid\npie title Pets\n  "Dogs" : 1\n```',
        '```js\nconst kept = true\n```',
        '> ```mermaid\n> sequenceDiagram\n>   A->>B: hi\n> ```',
      ].join('\n\n'),
    )

    // Every fence is found, other fences are untouched, and order is kept.
    const at = [
      'flowchart TD',
      'pie title Pets',
      'const kept',
      'sequenceDiagram',
    ].map((text) => out.indexOf(text))
    expect(at).not.toContain(-1)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(out).not.toContain('language-mermaid')
  })

  it('leaves non-mermaid code blocks as native <pre><code>', () => {
    const out = html('```js\nconsole.log("hi")\n```')
    expect(out).toContain('language-js')
    expect(out).toContain('console.log')
  })
})
