import type { Options as RehypeKatexOptions } from 'rehype-katex'
import rehypeKatex from 'rehype-katex'
import type { StreamupPlugin } from '../types.js'

export type KatexOptions = RehypeKatexOptions

/**
 * Create a KaTeX plugin with custom options.
 *
 * ```tsx
 * import { katex } from '@opticlm/streamup/katex'
 * <Streamup plugins={[katex({ errorColor: '#ff0000' })]}>
 * ```
 */
export function katex(options?: KatexOptions): StreamupPlugin {
  return {
    rehypePlugins: [[rehypeKatex, { errorColor: '#cc0000', ...options }]],
  }
}
