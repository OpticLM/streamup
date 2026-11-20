import type { CodeHighlighterPlugin, CodeOptions } from '@pierre/words/html'
import type { ReactNode } from 'react'

/**
 * Props of `components['code-block']`: one fenced code block, in the shape
 * Words hands its own code plugins (`CodeOptions`).
 *
 * - `code`: the block's lines, each ending with LF. While the fence is still
 *   streaming, the last line has no LF until it is complete.
 * - `language`: the first word of the info string, or `''`.
 * - `isIncomplete`: the fence is still open and more text is coming.
 * - `children`: the caret, while the stream ends in this block and
 *   `Streamup`'s `caret` is on. Render it at the end of the code, or leave
 *   it out.
 */
export type CodeBlockProps = CodeOptions & { children?: ReactNode }

export interface CodeBlockRendererProps extends CodeBlockProps {
  /**
   * Fills `<code>` with highlighted HTML, such as Words'
   * `createHighlightsPlugin()` from `@pierre/words/highlights`. A language it
   * does not know stays plain text.
   */
  highlighter?: CodeHighlighterPlugin
}

/**
 * The default `code-block`: native `<pre><code class="language-x">`, which
 * shadcn/typeset styles. A fence that is still streaming is marked
 * `<pre data-markdown-incomplete>`.
 */
export function CodeBlock({
  code,
  language,
  isIncomplete,
  highlighter,
  children,
}: CodeBlockRendererProps) {
  // A caret sits at the end of the last line rather than on a new one, so
  // the block does not lose a line when the fence closes.
  const text =
    children != null && code.endsWith('\n') ? code.slice(0, -1) : code
  const className = language ? `language-${language}` : undefined
  const html =
    highlighter?.highlight({ code: text, language, isIncomplete }) ?? null
  return (
    <pre data-markdown-incomplete={isIncomplete ? '' : undefined}>
      <code className={className}>
        {html === null ? (
          text
        ) : (
          <span
            // biome-ignore lint/security/noDangerouslySetInnerHtml: a highlighter returns escaped code wrapped in its own spans
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {children}
      </code>
    </pre>
  )
}
