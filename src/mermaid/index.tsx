import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useState } from 'react'

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
        mermaid.initialize({ startOnLoad: false, ...config })
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

export interface MermaidCodeBlockOptions {
  config?: MermaidConfig
}

export function mermaidCodeBlock(options?: MermaidCodeBlockOptions) {
  const config = options?.config
  return ({ language, code }: { language: string; code: string }) =>
    language === 'mermaid' ? (
      <MermaidRenderer code={code} config={config} />
    ) : undefined
}
