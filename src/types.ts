import type { ReactNode } from 'react'
import type { PluggableList } from 'unified'

export interface StreamupPlugin {
  remarkPlugins?: PluggableList
  rehypePlugins?: PluggableList
}

export type CodeBlockComponent = (props: {
  language: string
  code: string
}) => ReactNode | null | undefined

export interface StreamupProps {
  children?: string
  streaming?: boolean
  throttleMs?: number
  codeBlock?: CodeBlockComponent
  plugins?: StreamupPlugin[]
  singleDollarTextMath?: boolean
}
