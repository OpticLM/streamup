import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useState } from 'react'
import { CodeBlock } from '../code-block.js'

export type { MermaidConfig } from 'mermaid'

export interface MermaidRendererProps {
  code: string
  config?: MermaidConfig
  /** The fence is still streaming: show the source until it closes. Defaults to `false`. */
  isIncomplete?: boolean
}

export function MermaidRenderer({
  code,
  config,
  isIncomplete = false,
}: MermaidRendererProps) {
  const id = useId().replace(/:/g, '_')
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setFailed(false)
    if (isIncomplete) return
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
  }, [code, id, config, isIncomplete])

  if (isIncomplete || failed || svg === null)
    return (
      <CodeBlock code={code} language="mermaid" isIncomplete={isIncomplete} />
    )

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid produces trusted SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
