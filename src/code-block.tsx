import type { CodeHighlighterPlugin, CodeOptions } from '@pierre/words/html'

/**
 * Props of `components['code-block']`: one fenced code block, in the shape
 * Words hands its own code plugins (`CodeOptions`).
 *
 * - `code`: the block's lines, each ending with LF. While the fence is still
 *   streaming, the last line has no LF until it is complete.
 * - `language`: the first word of the info string, or `''`.
 * - `isIncomplete`: the fence is still open and more text is coming.
 */
export type CodeBlockProps = CodeOptions

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
}: CodeBlockRendererProps) {
  const className = language ? `language-${language}` : undefined
  const html = highlighter?.highlight({ code, language, isIncomplete }) ?? null
  return (
    <pre data-markdown-incomplete={isIncomplete ? '' : undefined}>
      {html === null ? (
        <code className={className}>{code}</code>
      ) : (
        <code
          className={className}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a highlighter returns escaped code wrapped in its own spans
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </pre>
  )
}
