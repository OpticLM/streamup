import { createMermaidPlugin } from '@pierre/words/mermaid'
import type { RenderOptions } from 'pele'
import { render } from 'pele'
import { useId, useMemo } from 'react'
import { CodeBlock } from '../code-block.js'

export type { RenderOptions as PeleOptions } from 'pele'

export interface PeleRendererProps {
  /** Mermaid diagram source. */
  code: string
  /**
   * The fence is still streaming. The diagram then grows with each complete
   * line, and a line that does not parse keeps the last diagram. Defaults to
   * `false`: source that does not parse shows as code.
   */
  isIncomplete?: boolean
  /** Options passed to Pele's `render()`. */
  options?: RenderOptions
}

/**
 * Draws Mermaid source as SVG with Pele, through Words' Mermaid plugin
 * (`@pierre/words/mermaid`). Pele renders synchronously, so the diagram is in
 * the first render, on the server too.
 */
export function PeleRenderer({
  code,
  isIncomplete = false,
  options,
}: PeleRendererProps) {
  // Pele's default `idPrefix` is a constant, so inlining several diagrams on
  // one page would repeat their SVG ids. A per-instance prefix keeps them unique.
  const idPrefix = `pele-${useId().replace(/:/g, '_')}`
  // The plugin remembers the last diagram of an open fence, so it lives as
  // long as the block does.
  const plugin = useMemo(
    () => createMermaidPlugin({ render }, { idPrefix, ...options }),
    [idPrefix, options],
  )
  const html = useMemo(
    () => plugin.render({ code, language: 'mermaid', isIncomplete }),
    [plugin, code, isIncomplete],
  )

  if (html === null)
    return <CodeBlock code={code} language="mermaid" isIncomplete={false} />
  // An open fence with no diagram yet shows nothing.
  if (html === '') return null
  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Pele emits sanitized SVG: no scripts or event handlers, and unsafe URL schemes are blocked (https://pele.run/security)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
