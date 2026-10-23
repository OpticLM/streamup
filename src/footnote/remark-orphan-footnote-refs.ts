import { markdownLineEndingOrSpace } from 'micromark-util-character'
import { normalizeIdentifier } from 'micromark-util-normalize-identifier'
import { codes, constants } from 'micromark-util-symbol'
import type {
  Code,
  Effects,
  Extension,
  Point,
  State,
  TokenizeContext,
} from 'micromark-util-types'
import type { Processor } from 'unified'

declare module 'micromark-util-types' {
  interface ParseContext {
    /** Normalized labels of the defined footnotes; owned by micromark-extension-gfm-footnote. */
    gfmFootnotes?: string[]
  }

  interface TokenTypeMap {
    orphanFootnoteProbe: 'orphanFootnoteProbe'
  }
}

/**
 * Remark plugin that parses `[^label]` as a footnote reference even when the
 * document doesn't define `label`. Use it after remark-gfm.
 *
 * GFM only recognizes a reference whose label is defined in the same document.
 * Inline footnote mode parses every block on its own, apart from the
 * definitions (which, when streaming, arrive last), so without this plugin a
 * block's references would render as literal text.
 *
 * Rather than re-implement GFM's footnote-call syntax, a probe runs just ahead
 * of it at every `[`: it scans a would-be `[^label]` by the same rules,
 * registers `label` as defined, and always fails — so GFM's own construct then
 * tokenizes the reference as if its definition existed.
 */
export function remarkOrphanFootnoteRefs(this: Processor) {
  const data = this.data()
  const extensions = data.micromarkExtensions ?? []
  data.micromarkExtensions = extensions
  // Constructs added later are tried first, so the probe precedes GFM's call.
  extensions.push(orphanFootnoteProbe)
}

const orphanFootnoteProbe: Extension = {
  text: {
    [codes.leftSquareBracket]: {
      name: 'orphanFootnoteProbe',
      tokenize: tokenizeOrphanFootnoteProbe,
    },
  },
}

function tokenizeOrphanFootnoteProbe(
  this: TokenizeContext,
  effects: Effects,
  _ok: State,
  nok: State,
): State {
  const self = this
  let labelStart: Point
  let size = 0
  return start

  function start(code: Code) {
    effects.enter('orphanFootnoteProbe')
    effects.consume(code)
    return caret
  }

  function caret(code: Code) {
    if (code !== codes.caret) return nok(code)
    effects.consume(code)
    labelStart = self.now()
    return label
  }

  // The label rules of GFM's footnote call: non-empty, at most 999 characters,
  // no whitespace or unescaped brackets.
  function label(code: Code): State | undefined {
    if (code === codes.rightSquareBracket && size > 0) {
      define(self.sliceSerialize({ start: labelStart, end: self.now() }))
      return nok(code)
    }
    if (
      size > constants.linkReferenceSizeMax ||
      code === codes.eof ||
      code === codes.leftSquareBracket ||
      code === codes.rightSquareBracket ||
      markdownLineEndingOrSpace(code)
    ) {
      return nok(code)
    }
    size++
    effects.consume(code)
    return code === codes.backslash ? labelEscape : label
  }

  function labelEscape(code: Code): State | undefined {
    if (
      code === codes.leftSquareBracket ||
      code === codes.backslash ||
      code === codes.rightSquareBracket
    ) {
      size++
      effects.consume(code)
      return label
    }
    return label(code)
  }

  function define(rawLabel: string) {
    const identifier = normalizeIdentifier(rawLabel)
    const defined = self.parser.gfmFootnotes ?? []
    self.parser.gfmFootnotes = defined
    if (!defined.includes(identifier)) defined.push(identifier)
  }
}
