import { useEffect, useState } from 'react'
import DeveloperPortal from './components/DeveloperPortal.jsx'
import MarkdownContent from './components/MarkdownContent.jsx'
import { loadContent } from './lib/contentStore.js'

const empty = { schemaVersion: 6, articles: [], projects: [], photos: [], materials: [], materialGroups: [] }
export default function App() {
  const [content, setContent] = useState(empty)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => { loadContent().then(setContent).catch(() => setError('无法连接内容服务，请启动 Python 后端。')) }, [])
  return <main className="demo-site">
    <nav><a href="#home">PORTFOLIO STUDIO</a><a href="#projects">项目</a><a href="#articles">文章</a></nav>
    <section id="home"><small>REACT · FASTAPI · SQLITE</small><h1>一个可以自由<br/>填入内容的空间。</h1><p>通用作品集与内容管理演示。所有内容由使用者自行添加。</p><a href="#projects">浏览示例框架 ↓</a></section>
    {error && <p role="alert">{error}</p>}
    <section id="projects"><small>01 / PROJECTS</small><h2>项目展示</h2><div className="demo-cards">{content.projects.length ? content.projects.map(item => <button key={item.id} onClick={() => setSelected(item)}><h3>{item.title}</h3><p>{item.description}</p></button>) : <p>暂无项目。可通过开发者控制台添加。</p>}</div></section>
    <section id="articles"><small>02 / JOURNAL</small><h2>文章归档</h2><div className="demo-cards">{content.articles.length ? content.articles.map(item => <button key={item.id} onClick={() => setSelected(item)}><h3>{item.title}</h3><p>{item.excerpt}</p></button>) : <p>暂无文章。此演示不附带个人写作内容。</p>}</div></section>
    {selected && <section><button onClick={() => setSelected(null)}>关闭详情</button><h2>{selected.title}</h2><MarkdownContent value={selected.body || ''}/></section>}
    <footer>Portfolio Studio · Projects & Journal</footer>
    <DeveloperPortal content={content} onContentChange={setContent}/>
  </main>
}
