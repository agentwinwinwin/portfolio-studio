import { useRef, useState } from 'react'
import { Bold, Code2, Heading2, ImagePlus, Quote } from 'lucide-react'
import MarkdownContent from './MarkdownContent.jsx'

export default function RichTextEditor({ value, onChange, uploadImage, label = '正文' }) {
  const textareaRef = useRef(null)
  const imageInputRef = useRef(null)
  const [mobileView, setMobileView] = useState('edit')
  const [uploading, setUploading] = useState(false)

  const replaceSelection = (before, after = before, placeholder = '') => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholder
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      textarea?.focus()
      const selectionStart = start + before.length
      textarea?.setSelectionRange(selectionStart, selectionStart + selected.length)
    })
  }

  const insertLine = (prefix, placeholder) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? value.length
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    onChange(`${value.slice(0, lineStart)}${prefix}${value.slice(lineStart) || placeholder}`)
    requestAnimationFrame(() => textarea?.focus())
  }

  const addImage = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      const textarea = textareaRef.current
      const at = textarea?.selectionStart ?? value.length
      const paddingBefore = at && !value.slice(0, at).endsWith('\n\n') ? '\n\n' : ''
      const markdown = `${paddingBefore}![${file.name.replace(/\.[^.]+$/, '')}](${url})\n\n`
      onChange(`${value.slice(0, at)}${markdown}${value.slice(at)}`)
      requestAnimationFrame(() => {
        textarea?.focus()
        textarea?.setSelectionRange(at + markdown.length, at + markdown.length)
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rich-editor">
      <div className="rich-editor-head">
        <span>{label} · MARKDOWN</span>
        <div className="rich-editor-tabs">
          <button type="button" className={mobileView === 'edit' ? 'active' : ''} onClick={() => setMobileView('edit')}>编辑</button>
          <button type="button" className={mobileView === 'preview' ? 'active' : ''} onClick={() => setMobileView('preview')}>预览</button>
        </div>
      </div>
      <div className="rich-editor-toolbar" aria-label="正文格式工具栏">
        <button type="button" onClick={() => replaceSelection('**', '**', '加粗文字')} title="加粗"><Bold /></button>
        <button type="button" onClick={() => insertLine('## ', '小标题')} title="二级标题"><Heading2 /></button>
        <button type="button" onClick={() => replaceSelection('`', '`', '代码')} title="行内代码"><Code2 /></button>
        <button type="button" onClick={() => insertLine('> ', '引用内容')} title="引用"><Quote /></button>
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} title="在光标处插入图片"><ImagePlus /><span>{uploading ? '上传中…' : '插入图片'}</span></button>
        <input ref={imageInputRef} type="file" accept="image/*" onChange={addImage} hidden />
      </div>
      <div className="rich-editor-panels" data-mobile-view={mobileView}>
        <textarea ref={textareaRef} value={value} onChange={event => onChange(event.target.value)} placeholder={'从这里开始写作…\n\n选中文字后点击 B 可加粗；将光标放在段落之间，再点击“插入图片”。'} />
        <div className="rich-editor-preview"><MarkdownContent value={value} fallback="预览会显示在这里。" /></div>
      </div>
    </div>
  )
}
