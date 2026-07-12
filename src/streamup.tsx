import type { ReactNode } from 'react'
import { Fragment, useMemo, useRef } from 'react'
import type { PluggableList } from 'unified'
import { splitBlocks } from './parse/blocks.js'
import type { MdProcessor } from './parse/processor.js'
import { createProcessor, renderBlock } from './parse/processor.js'
import type { StreamupProps } from './types.js'
import { useThrottle } from './useThrottle.js'

export function Streamup({
  children,
  streaming = false,
  throttleMs = 50,
  components,
  plugins,
  singleDollarTextMath,
}: StreamupProps) {
  const markdown = children ?? ''
  const source = useThrottle(markdown, streaming ? throttleMs : 0)

  const extraRemarkPlugins = useMemo<PluggableList>(
    () => (plugins ?? []).flatMap((p) => p.remarkPlugins ?? []),
    [plugins],
  )
  const extraRehypePlugins = useMemo<PluggableList>(
    () => (plugins ?? []).flatMap((p) => p.rehypePlugins ?? []),
    [plugins],
  )

  const processor = useMemo<MdProcessor>(
    () =>
      createProcessor({
        extraRemarkPlugins,
        extraRehypePlugins,
        singleDollarTextMath,
      }),
    [extraRemarkPlugins, extraRehypePlugins, singleDollarTextMath],
  )

  const blocks = useMemo(
    () => splitBlocks(source, processor, streaming),
    [source, processor, streaming],
  )

  const cacheRef = useRef({
    processor,
    components,
    map: new Map<string, ReactNode>(),
  })
  const rendered = useMemo(() => {
    if (
      cacheRef.current.processor !== processor ||
      cacheRef.current.components !== components
    ) {
      cacheRef.current = {
        processor,
        components,
        map: new Map<string, ReactNode>(),
      }
    }
    const cache = cacheRef.current.map
    const next = new Map<string, ReactNode>()
    const result = blocks.map((block) => {
      const cached = cache.get(block)
      if (cached) {
        next.set(block, cached)
        return cached
      }
      const element = renderBlock(block, { processor, components })
      next.set(block, element)
      return element
    })
    cacheRef.current.map = next
    return result
  }, [blocks, processor, components])

  return (
    <>
      {rendered.map((element, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blocks are positional during streaming
        <Fragment key={i}>{element}</Fragment>
      ))}
    </>
  )
}
