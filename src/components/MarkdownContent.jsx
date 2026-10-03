import { Fragment } from 'react'

const safeUrl = value => {
  const url = String(value || '').trim()
  return /^(https?:\/\/|\/)/i.test(url) ? url : ''
}

const inlinePattern = /(!\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g

function Inline({ text }) {
  const nodes = []
  let cursor = 0
  let match
  inlinePattern.lastIndex = 0
  while ((match = inlinePattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    if (match[1].startsWith('!')) {
      const src = safeUrl(match[3])
      if (src) nodes.push(<img className="markdown-inline-image" src={src} alt={match[2] || ''} loading="lazy" decoding="async" key={`${match.index}-image`} />)
    } else if (match[4]) nodes.push(<strong key={`${match.index}-strong`}>{match[4]}</strong>)
    else if (match[5]) nodes.push(<code key={`${match.index}-code`}>{match[5]}</code>)
    else if (match[6]) {
      const href = safeUrl(match[7])
      nodes.push(href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} key={`${match.index}-link`}>{match[6]}</a> : match[6])
    }
    cursor = inlinePattern.lastIndex
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)
}

export default function MarkdownContent({ value = '', fallback = '' }) {
  const source = (value || fallback || '').replace(/\r\n/g, '\n')
  const lines = source.split('\n')
  const blocks = []
  let paragraph = []
  let code = []
  let inCode = false

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
    paragraph = []
  }

  lines.forEach(line => {
    if (line.trim().startsWith('```')) {
      flushParagraph()
      if (inCode) {
        blocks.push({ type: 'code', text: code.join('\n') })
        code = []
      }
      inCode = !inCode
      return
    }
    if (inCode) {
      code.push(line)
      return
    }
    if (!line.trim()) {
      flushParagraph()
      return
    }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (image) {
      flushParagraph()
      blocks.push({ type: 'image', alt: image[1], src: safeUrl(image[2]) })
      return
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      blocks.push({ type: `h${heading[1].length}`, text: heading[2] })
      return
    }
    if (/^>\s?/.test(line)) {
      flushParagraph()
      blocks.push({ type: 'quote', text: line.replace(/^>\s?/, '') })
      return
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph()
      blocks.push({ type: 'list', text: line.replace(/^[-*]\s+/, '') })
      return
    }
    paragraph.push(line)
  })
  flushParagraph()
  if (code.length) blocks.push({ type: 'code', text: code.join('\n') })

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        if (block.type === 'image') return block.src ? <figure key={index}><img src={block.src} alt={block.alt} loading="lazy" decoding="async" />{block.alt && <figcaption>{block.alt}</figcaption>}</figure> : null
        if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>
        if (block.type === 'quote') return <blockquote key={index}><Inline text={block.text} /></blockquote>
        if (block.type === 'list') return <ul key={index}><li><Inline text={block.text} /></li></ul>
        if (block.type === 'h1') return <h2 key={index}><Inline text={block.text} /></h2>
        if (block.type === 'h2') return <h3 key={index}><Inline text={block.text} /></h3>
        if (block.type === 'h3') return <h4 key={index}><Inline text={block.text} /></h4>
        return <p key={index}>{block.text.split('\n').map((line, lineIndex) => <Fragment key={lineIndex}><Inline text={line} />{lineIndex < block.text.split('\n').length - 1 && <br />}</Fragment>)}</p>
      })}
    </div>
  )
}
