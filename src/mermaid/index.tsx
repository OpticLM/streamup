import type { Root } from 'hast'
import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useState } from 'react'
import type { Plugin } from 'unified'
import { fencedBlockPlugin } from '../parse/fenced-block.js'
import type { StreamupPlugin } from '../types.js'

export type { MermaidConfig } from 'mermaid'

export interface MermaidRendererProps {
  code: string
  config?: MermaidConfig
  /** Whether the source Markdown fence has been closed. Defaults to `true`. */
  isClosed?: boolean
}

export function MermaidRenderer({
  code,
  config,
  isClosed = true,
}: MermaidRendererProps) {
  const id = useId().replace(/:/g, '_')
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setFailed(false)
    if (!isClosed) return
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
  }, [code, id, config, isClosed])

  if (!isClosed || failed || svg === null) {
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

/**
 * Rehype plugin that turns ` ```mermaid ` fenced blocks into a custom
 * `<mermaid-block code="…">` element. Map it via `components['mermaid-block']`
 * (typically to `<MermaidRenderer>`). Non-mermaid code stays native
 * `<pre><code>` for typeset. Runs after `rehype-sanitize`. On a Mermaid syntax
 * error, `MermaidRenderer` falls back to the raw source.
 */
export const rehypeMermaid: Plugin<[], Root, Root> = fencedBlockPlugin(
  'mermaid',
  MERMAID_BLOCK_TAG,
)

/** `StreamupPlugin` wrapper around {@link rehypeMermaid}. */
export function mermaid(): StreamupPlugin {
  return { rehypePlugins: [rehypeMermaid] }
}
