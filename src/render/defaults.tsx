import { Children, isValidElement, type JSX, type ReactElement } from 'react'
import type { Components, ExtraProps } from '../types.js'

type WithNode<P> = P & ExtraProps

function H1({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h1']>) {
  return <h1 {...props} />
}

function H2({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h2']>) {
  return <h2 {...props} />
}

function H3({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h3']>) {
  return <h3 {...props} />
}

function H4({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h4']>) {
  return <h4 {...props} />
}

function H5({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h5']>) {
  return <h5 {...props} />
}

function H6({ node: _, ...props }: WithNode<JSX.IntrinsicElements['h6']>) {
  return <h6 {...props} />
}

function Paragraph({
  children,
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['p']>) {
  const childArray = Children.toArray(children)
  const validChildren = childArray.filter(
    (child) => child !== null && child !== undefined && child !== '',
  )

  if (validChildren.length === 1 && isValidElement(validChildren[0])) {
    const child = validChildren[0] as ReactElement<
      Record<string, unknown> & ExtraProps
    >
    const childNode = child.props.node as { tagName?: string } | undefined

    if (childNode?.tagName === 'img') {
      return <>{children}</>
    }

    if (childNode?.tagName === 'code' && 'data-block' in child.props) {
      return <>{children}</>
    }
  }

  return <p {...props}>{children}</p>
}

function Strong({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['strong']>) {
  return <strong {...props} />
}

function Em({ node: _, ...props }: WithNode<JSX.IntrinsicElements['em']>) {
  return <em {...props} />
}

function Del({ node: _, ...props }: WithNode<JSX.IntrinsicElements['del']>) {
  return <del {...props} />
}

function Anchor({ node: _, ...props }: WithNode<JSX.IntrinsicElements['a']>) {
  return <a target="_blank" rel="noreferrer" {...props} />
}

function Img({
  node: _,
  alt = '',
  ...props
}: WithNode<JSX.IntrinsicElements['img']>) {
  return <img alt={alt} {...props} />
}

function Ol({ node: _, ...props }: WithNode<JSX.IntrinsicElements['ol']>) {
  return <ol {...props} />
}

function Ul({ node: _, ...props }: WithNode<JSX.IntrinsicElements['ul']>) {
  return <ul {...props} />
}

function Li({ node: _, ...props }: WithNode<JSX.IntrinsicElements['li']>) {
  return <li {...props} />
}

function Hr({ node: _, ...props }: WithNode<JSX.IntrinsicElements['hr']>) {
  return <hr {...props} />
}

function Blockquote({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['blockquote']>) {
  return <blockquote {...props} />
}

function Table({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['table']>) {
  return <table {...props} />
}

function Thead({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['thead']>) {
  return <thead {...props} />
}

function Tbody({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['tbody']>) {
  return <tbody {...props} />
}

function Tr({ node: _, ...props }: WithNode<JSX.IntrinsicElements['tr']>) {
  return <tr {...props} />
}

function Th({ node: _, ...props }: WithNode<JSX.IntrinsicElements['th']>) {
  return <th {...props} />
}

function Td({ node: _, ...props }: WithNode<JSX.IntrinsicElements['td']>) {
  return <td {...props} />
}

function Sup({ node: _, ...props }: WithNode<JSX.IntrinsicElements['sup']>) {
  return <sup {...props} />
}

function Sub({ node: _, ...props }: WithNode<JSX.IntrinsicElements['sub']>) {
  return <sub {...props} />
}

function Section({
  node: _,
  ...props
}: WithNode<JSX.IntrinsicElements['section']>) {
  return <section {...props} />
}

function Code({
  node: _,
  children,
  className,
  ...props
}: WithNode<JSX.IntrinsicElements['code']>) {
  if ('data-block' in props) {
    const {
      'data-block': __,
      'data-language': language = '',
      ...rest
    } = props as Record<string, unknown>
    return (
      <pre>
        <code
          className={className}
          data-language={language as string}
          {...rest}
        >
          {children}
        </code>
      </pre>
    )
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

function Pre({ node: _, ...props }: WithNode<JSX.IntrinsicElements['pre']>) {
  return <pre {...props} />
}

export const defaultComponents: Components = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  p: Paragraph,
  strong: Strong,
  em: Em,
  del: Del,
  a: Anchor,
  img: Img,
  ol: Ol,
  ul: Ul,
  li: Li,
  hr: Hr,
  blockquote: Blockquote,
  table: Table,
  thead: Thead,
  tbody: Tbody,
  tr: Tr,
  th: Th,
  td: Td,
  sup: Sup,
  sub: Sub,
  section: Section,
  code: Code,
  pre: Pre,
}
