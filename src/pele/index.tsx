import type { RenderOptions } from 'pele'
import { useEffect, useId, useState } from 'react'

export type { RenderOptions as PeleOptions } from 'pele'

export interface PeleRendererProps {
  /** Mermaid diagram source. */
  code: string
  /** Options passed to Pele's `render()`. */
  options?: RenderOptions
  /**
   * Whether the source Markdown fence has been closed. While `false` the source
   * is still streaming in, so a prefix that does not parse yet keeps the
   * previous drawing (or the source, if nothing has been drawn). Once `true`,
   * source that does not parse is shown as code. Defaults to `true`.
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
        // Pele threw (a `PeleError`) or its chunk failed to load. Half-streamed
        // source often fails to parse: keep the last drawing. Once the fence is
        // closed the source is final, so show it. Any later update retries.
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Pele emits sanitized SVG: no scripts or event handlers, and unsafe URL schemes are blocked (https://pele.run/security)
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
