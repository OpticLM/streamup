import type { ElementContent, Root } from 'hast'
import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useState } from 'react'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { findCode, textOf } from '../parse/processor.js'
import type { StreamupPlugin } from '../types.js'

export type { MermaidConfig } from 'mermaid'

interface MermaidRendererProps {
  code: string
  config?: MermaidConfig
}

export function MermaidRenderer({ code, config }: MermaidRendererProps) {
  const id = useId().replace(/:/g, '_')
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setFailed(false)
    import('mermaid')
      .then((mod) => {
        if (cancelled) return
        const mermaid = mod.default
        mermaid.initialize({
          startOnLoad: false,
          ...config,
          suppressErrorRendering: true,
        })
        return mermaid.render(`mermaid-${id}`, code)
      })
      .then((res) => {
        if (!cancelled && res) setSvg(res.svg)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [code, id, config])

  if (failed || svg === null) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid produces trusted SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export const MERMAID_BLOCK_TAG = 'mermaid-block'

const isMermaid = (classes: unknown): boolean =>
  Array.isArray(classes) && classes.includes('language-mermaid')

interface Replacement {
  siblings: ElementContent[]
  index: number
  node: ElementContent
}

/**
 * Rehype plugin that turns ` ```mermaid ` fenced blocks into a custom
 * `<mermaid-block code="…">` element. Map it via `components['mermaid-block']`
 * (typically to `<MermaidRenderer>`). Non-mermaid code stays native
 * `<pre><code>` for typeset. Runs after `rehype-sanitize`. On a Mermaid syntax
 * error, `MermaidRenderer` falls back to the raw source.
 */
export const rehypeMermaidPlugin: Plugin<[], Root, Root> = () => (tree) => {
  const replacements: Replacement[] = []
  visit(tree, 'element', (el, index, parent) => {
    if (!parent || index === null || index === undefined) return
    if (el.tagName !== 'pre') return
    const code = findCode(el)
    if (!code || !isMermaid(code.properties?.className)) return
    replacements.push({
      siblings: parent.children as ElementContent[],
      index,
      node: {
        type: 'element',
        tagName: MERMAID_BLOCK_TAG,
        properties: { code: textOf(code) },
        children: [],
      },
    })
  })
  replacements.sort((a, b) => b.index - a.index)
  for (const r of replacements) r.siblings.splice(r.index, 1, r.node)
}

/** `StreamupPlugin` wrapper around {@link rehypeMermaidPlugin}. */
export function rehypeMermaid(): StreamupPlugin {
  return { rehypePlugins: [rehypeMermaidPlugin] }
}
