import type { Element, Root } from 'hast'

/**
 * Rehype plugin that flattens `<pre><code>` into `<code data-block data-language>`.
 *
 * In the HAST tree produced by remark-rehype, fenced code blocks become
 * `<pre><code>…</code></pre>` while inline code is just `<code>…</code>`.
 * This structural difference is the only way to tell them apart — but
 * once the tree is handed to React components the parent/child
 * relationship is implicit, requiring awkward `cloneElement` hacks.
 *
 * This plugin collapses every `<pre>` whose **single** child is a
 * `<code>` element, promoting that `<code>` to the `<pre>` position
 * and tagging it with `dataBlock: ''` (rendered as the `data-block`
 * attribute) and `dataLanguage` (the language identifier extracted from
 * `className`, rendered as `data-language`). React components can then
 * use `'data-block' in props` to distinguish block code from inline
 * code and `props['data-language']` to read the language without
 * parsing `className`.
 */
export function rehypeCodeBlock(): (tree: Root) => void {
  return (tree: Root) => {
    flatten(tree)
  }
}

function flatten(node: Root | Element): void {
  if (!('tagName' in node)) {
    node.children = node.children.map((child) =>
      child.type === 'element' ? flattenElement(child) : child,
    )
    return
  }

  node.children = node.children.map((child) =>
    child.type === 'element' ? flattenElement(child) : child,
  )
}

function flattenElement(el: Element): Element {
  if (isPreWithSingleCode(el)) {
    const code = el.children[0]
    code.properties ??= {}
    code.properties.dataBlock = ''
    const language = extractLanguage(code.properties.className)
    if (language) {
      code.properties.dataLanguage = language
    }
    return flattenElement(code)
  }

  el.children = el.children.map((child) =>
    child.type === 'element' ? flattenElement(child) : child,
  )
  return el
}

function extractLanguage(className: unknown): string | undefined {
  if (!className) return undefined
  const classes = Array.isArray(className) ? className : [String(className)]
  for (const cls of classes) {
    if (typeof cls === 'string' && cls.startsWith('language-')) {
      return cls.slice('language-'.length)
    }
  }
  return undefined
}

function isPreWithSingleCode(
  node: Element,
): node is Element & { children: [Element] } {
  return (
    node.tagName === 'pre' &&
    node.children.length === 1 &&
    node.children[0]?.type === 'element' &&
    node.children[0].tagName === 'code'
  )
}
