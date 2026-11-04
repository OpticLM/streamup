import type { Root } from 'hast'
import type { RenderOptions } from 'pele'
import { useEffect, useId, useState } from 'react'
import type { Plugin } from 'unified'
import { fencedBlockPlugin } from '../parse/fenced-block.js'
import type { StreamupPlugin } from '../types.js'

export type { RenderOptions as PeleOptions } from 'pele'

export interface PeleRendererProps {
  /** Mermaid diagram source. */
  code: string
  /** Options passed to Pele's `render()`. */
  options?: RenderOptions
  /**
   * Whether the source Markdown fence has been closed. While `false` the source
   * is still streaming in, so a prefix that does not parse yet keeps the
   * previous drawing instead of falling back to the source. Defaults to `true`.
   */
  isClosed?: boolean
}

export function PeleRenderer({
  code,
  options,
  isClosed = true,
}: PeleRendererProps) {
  // Pele's default `idPrefix` is a constant, so inlining several diagrams on
  // one page would repeat their SVG ids. A per-instance prefix keeps them unique.
  const idPrefix = `pele-${useId().replace(/:/g, '_')}`
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // `pele/lazy` loads only the diagram module a source needs, so pages
    // without diagrams never download the renderer.
    import('pele/lazy')
      .then((pele) => pele.renderAsync(code, { idPrefix, ...options }))
      .then((res) => {
        if (!cancelled) setSvg(res.svg)
      })
      .catch(() => {
        // A `PeleError`. Half-streamed source often fails to parse: keep the
        // last drawing. Once the fence is closed the source is final, so show it.
        if (!cancelled && isClosed) setSvg(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, idPrefix, options, isClosed])

  if (svg === null) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Pele emits sanitized SVG (no scripts, event handlers, or javascript:/data: URLs)
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export const PELE_BLOCK_TAG = 'pele-block'

/**
 * Rehype plugin that turns ` ```mermaid ` fenced blocks into a custom
 * `<pele-block code="…" isClosed={…}>` element. Map it via
 * `components['pele-block']` (typically to `<PeleRenderer>`). Other fenced
 * languages stay native `<pre><code>`. Runs after `rehype-sanitize`. When Pele
 * cannot render a diagram, `PeleRenderer` falls back to the raw source.
 *
 * It claims the same fences as `mermaid()`, so use one or the other.
 */
export const rehypePele: Plugin<[], Root, Root> = fencedBlockPlugin(
  'mermaid',
  PELE_BLOCK_TAG,
)

/** `StreamupPlugin` wrapper around {@link rehypePele}. */
export function pele(): StreamupPlugin {
  return { rehypePlugins: [rehypePele] }
}
