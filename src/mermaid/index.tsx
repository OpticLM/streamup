import type { MermaidConfig } from 'mermaid'
import { useEffect, useId, useRef, useState } from 'react'
import type { Components } from '../types.js'

export type { MermaidConfig } from 'mermaid'

interface MermaidRendererProps {
  code: string
  config?: MermaidConfig
}

export function MermaidRenderer({ code, config }: MermaidRendererProps) {
  const id = useId().replace(/:/g, '_')
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastValidSvg = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const mermaid = await import('mermaid')
        mermaid.default.initialize({
          startOnLoad: false,
          ...config,
        })
        const { svg: renderedSvg } = await mermaid.default.render(
          `mermaid-${id}`,
          code,
        )
        if (!cancelled) {
          setSvg(renderedSvg)
          lastValidSvg.current = renderedSvg
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          if (lastValidSvg.current) {
            setSvg(lastValidSvg.current)
          }
        }
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [code, id, config])

  if (error && !svg) {
    return (
      <div>
        <p>Mermaid rendering error: {error}</p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      ref={containerRef}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid produces trusted SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export interface WithMermaidOptions {
  /** Mermaid configuration (theme, flowchart direction, etc.) */
  config?: MermaidConfig
  /** Custom code component for non-mermaid code blocks */
  fallbackCode?: Components['code']
}

/**
 * Create component overrides that render mermaid code blocks as diagrams.
 *
 * ```tsx
 * import { withMermaid } from '@opticlm/streamup/mermaid'
 * <Streamup components={withMermaid({ config: { theme: 'dark' } })}>
 * ```
 */
export function withMermaid(options?: WithMermaidOptions): Partial<Components> {
  const { config, fallbackCode } = options ?? {}

  return {
    code: ({ children, className, node: _, ...props }) => {
      const isBlock = 'data-block' in props
      const language = className?.replace(/^language-/, '') ?? ''

      if (isBlock && language === 'mermaid' && typeof children === 'string') {
        return <MermaidRenderer code={children} config={config} />
      }

      if (fallbackCode) {
        const FallbackCode = fallbackCode
        return (
          // @ts-expect-error -- component union type
          <FallbackCode className={className} {...props}>
            {children}
          </FallbackCode>
        )
      }

      if (!isBlock) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      }

      const { 'data-block': __, ...rest } = props as Record<string, unknown>
      return (
        <pre>
          <code className={className} data-language={language} {...rest}>
            {children}
          </code>
        </pre>
      )
    },
  }
}
