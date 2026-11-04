export type { FootnoteMode, FootnoteRefProps } from './footnote/types.js'
export {
  MERMAID_BLOCK_TAG,
  mermaid,
  rehypeMermaid,
} from './parse/mermaid-block.js'
export { extractLanguage, findCode, textOf } from './parse/processor.js'
export { Streamup } from './streamup.js'
export type {
  PacingConfig,
  StreamupComponents,
  StreamupPlugin,
  StreamupProps,
} from './types.js'
