import { useMemo } from 'react'
import remend from 'remend'
import type { PluggableList } from 'unified'
import { parseMarkdownIntoBlocks } from './parse/blocks.js'
import type { ProcessMarkdownOptions } from './parse/processor.js'
import { processMarkdown } from './parse/processor.js'
import { defaultComponents } from './render/defaults.js'
import type { StreamupProps } from './types.js'

export function Streamup({
  children,
  streaming = false,
  components,
  plugins,
  className,
  singleDollarTextMath,
  sanitizeSchema,
  urlTransform,
  allowElement,
}: StreamupProps) {
  const markdown = children ?? ''

  const healed = useMemo(
    () => (streaming ? remend(markdown) : markdown),
    [streaming, markdown],
  )

  const mergedComponents = useMemo(
    () => ({ ...defaultComponents, ...components }),
    [components],
  )

  const extraRehypePlugins = useMemo<PluggableList>(() => {
    if (!plugins?.length) return []
    return plugins.flatMap((p) => p.rehypePlugins ?? [])
  }, [plugins])

  const extraRemarkPlugins = useMemo<PluggableList>(() => {
    if (!plugins?.length) return []
    return plugins.flatMap((p) => p.remarkPlugins ?? [])
  }, [plugins])

  const blocks = useMemo(() => parseMarkdownIntoBlocks(healed), [healed])

  const processOptions = useMemo<ProcessMarkdownOptions>(
    () => ({
      components: mergedComponents,
      processorOptions: {
        extraRemarkPlugins,
        extraRehypePlugins,
        singleDollarTextMath,
        sanitizeSchema,
      },
      urlTransform,
      allowElement,
    }),
    [
      mergedComponents,
      extraRemarkPlugins,
      extraRehypePlugins,
      singleDollarTextMath,
      sanitizeSchema,
      urlTransform,
      allowElement,
    ],
  )

  return (
    <div className={className}>
      {blocks.map((block, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional during streaming
        <div key={`block-${i}`}>{processMarkdown(block, processOptions)}</div>
      ))}
    </div>
  )
}
