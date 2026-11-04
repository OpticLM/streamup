import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useState } from 'react'

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
