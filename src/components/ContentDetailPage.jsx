import { ArrowLeft, ArrowUpRight, Copy, FolderKanban, PenLine } from 'lucide-react'
import MarkdownContent from './MarkdownContent.jsx'

export default function ContentDetailPage({ type, item, onBack }) {
  const project = type === 'projects'
  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href)
  }

  if (!item) {
    return (
      <main className="detail-page detail-page--missing">
        <div><span>404 / CONTENT</span><h1>这篇内容不存在。</h1><button onClick={onBack}><ArrowLeft />返回作品集</button></div>
      </main>
    )
  }

  return (
    <main className={`detail-page detail-page--${project ? 'project' : 'article'}`}>
      <header className="detail-nav">
        <button onClick={onBack}><ArrowLeft />返回作品集</button>
        <span>DEMO / {project ? 'PROJECT' : 'ARTICLE'}</span>
        <button onClick={copyLink}><Copy />复制链接</button>
      </header>
      <article>
        <div className="detail-hero">
          <div className="detail-hero-rail">
            <div className="detail-type">{project ? <FolderKanban /> : <PenLine />} {project ? 'PROJECT CASE' : 'FIELD NOTE'}</div>
            <span>{project ? 'CASE STUDY' : 'DEVELOPMENT NOTE'} / DEMO</span>
          </div>
          <div className="detail-hero-main">
            <h1>{item.title}</h1>
            <p>{project ? item.subtitle : item.excerpt}</p>
            <div className="detail-meta">
              {project ? <><span>{item.metric || 'PROJECT'}</span>{item.tags?.map(tag => <span key={tag}>{tag}</span>)}</> : <><span>{item.date}</span>{item.tags?.map(tag => <span key={tag}>{tag}</span>)}</>}
            </div>
          </div>
        </div>

        {item.image || item.cover ? <img className="detail-cover" src={item.image || item.cover} alt={`${item.title} 封面`} /> : <div className="detail-cover detail-cover--generated"><div><span>SYSTEM RECORD</span><small>{project ? 'BUILD / SHIP / ITERATE' : 'THINK / WRITE / SHARE'}</small></div><b>{project ? 'CASE' : 'NOTE'}</b></div>}

        <div className="detail-layout">
          <aside>
            <span>CONTENT INDEX</span>
            <strong>{project ? '项目详情' : '文章正文'}</strong>
            <small>DEMO PORTFOLIO<br />PYTHON / AGENT / DATA</small>
            {project && item.href && <a href={item.href} target="_blank" rel="noreferrer">访问项目 <ArrowUpRight /></a>}
          </aside>
          <div className="detail-prose">
            {project && item.description && <p className="detail-lead">{item.description}</p>}
            <MarkdownContent value={item.body} fallback={project ? '' : item.excerpt} />
          </div>
        </div>
      </article>
      <footer className="detail-footer"><button onClick={onBack}><ArrowLeft />返回全部内容</button><span>END / {project ? 'PROJECT' : 'ARTICLE'}</span></footer>
    </main>
  )
}
