import type { ComponentType, ReactNode } from 'react'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { FootnoteStore, useFootnote } from './store.js'
import type { FootnoteRefProps } from './types.js'

interface FootnoteContextValue {
  store: FootnoteStore
  Component?: ComponentType<FootnoteRefProps>
}

const FootnoteContext = createContext<FootnoteContextValue | null>(null)

/** Numbers of the footnotes whose content encloses the current subtree. */
const FootnoteTrail = createContext<readonly string[]>([])

export interface FootnoteProviderProps {
  /** The rendered footnotes of the latest render, by number. */
  footnotes: ReadonlyMap<string, ReactNode>
  /** Renders each reference: `components['footnote-ref']`. */
  component?: ComponentType<FootnoteRefProps>
  children?: ReactNode
}

/** Owns the footnote store of one document and feeds it every render. */
export function FootnoteProvider({
  footnotes,
  component,
  children,
}: FootnoteProviderProps) {
  // Seeded with the first render, so the first (and server) render already
  // shows every footnote; later renders sync after commit.
  const [store] = useState(() => new FootnoteStore(footnotes))
  useLayoutEffect(() => store.sync(footnotes), [store, footnotes])
  const value = useMemo(
    () => ({ store, Component: component }),
    [store, component],
  )
  return <FootnoteContext value={value}>{children}</FootnoteContext>
}

export interface FootnoteRefElementProps {
  label: string
  /** The footnote's number, once Words has linked the reference to it. */
  footnote?: string
}

/**
 * Stands in for every `<footnote-ref>` element: reads its footnote from the
 * store and hands it to `components['footnote-ref']`. A footnote that cites
 * itself, directly or not, renders that inner reference without content.
 */
export function FootnoteRef({ label, footnote }: FootnoteRefElementProps) {
  const { store, Component } = useFootnoteContext()
  const trail = useContext(FootnoteTrail)
  const content = useFootnote(store, footnote)
  if (!Component) return null
  if (
    footnote === undefined ||
    content === undefined ||
    trail.includes(footnote)
  )
    return <Component label={label} />
  return (
    <Component label={label}>
      <FootnoteTrail value={[...trail, footnote]}>{content}</FootnoteTrail>
    </Component>
  )
}

function useFootnoteContext(): FootnoteContextValue {
  const context = useContext(FootnoteContext)
  if (!context) throw new Error('FootnoteRef must render in a FootnoteProvider')
  return context
}
