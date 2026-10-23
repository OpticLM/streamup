import { normalizeIdentifier } from 'micromark-util-normalize-identifier'
import type { ComponentType, ReactNode } from 'react'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { FootnoteStore, useFootnote } from './store.js'
import type { FootnoteRefProps, Footnotes } from './types.js'

interface FootnoteContextValue {
  store: FootnoteStore
  Component?: ComponentType<FootnoteRefProps>
}

const FootnoteContext = createContext<FootnoteContextValue | null>(null)

/** Identifiers of the footnotes whose content encloses the current subtree. */
const FootnoteTrail = createContext<readonly string[]>([])

export interface FootnoteProviderProps {
  /** The rendered footnotes of the latest parse. */
  footnotes: Footnotes<ReactNode>
  /** Renders each reference: `components['footnote-ref']`. */
  component?: ComponentType<FootnoteRefProps>
  children?: ReactNode
}

/** Owns the footnote store of one document and feeds it every parse. */
export function FootnoteProvider({
  footnotes,
  component,
  children,
}: FootnoteProviderProps) {
  // Seeded with the first parse, so the first (and server) render already
  // shows every settled footnote; later parses sync after commit.
  const [store] = useState(() => new FootnoteStore(footnotes))
  useLayoutEffect(() => store.sync(footnotes), [store, footnotes])
  const value = useMemo(
    () => ({ store, Component: component }),
    [store, component],
  )
  return <FootnoteContext value={value}>{children}</FootnoteContext>
}

/**
 * Stands in for every `<footnote-ref>` element: reads its footnote from the
 * store and hands it to `components['footnote-ref']`. A footnote that cites
 * itself, directly or not, renders that inner reference without content.
 */
export function FootnoteRef({ label }: Pick<FootnoteRefProps, 'label'>) {
  const { store, Component } = useFootnoteContext()
  const trail = useContext(FootnoteTrail)
  // The identifier mdast-util-gfm-footnote derives from the same label.
  const identifier = normalizeIdentifier(label).toLowerCase()
  const content = useFootnote(store, identifier)
  if (!Component) return null
  if (content === undefined || trail.includes(identifier))
    return <Component label={label} />
  return (
    <Component label={label}>
      <FootnoteTrail value={[...trail, identifier]}>{content}</FootnoteTrail>
    </Component>
  )
}

function useFootnoteContext(): FootnoteContextValue {
  const context = useContext(FootnoteContext)
  if (!context) throw new Error('FootnoteRef must render in a FootnoteProvider')
  return context
}
