import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Code2, Download, FileText, Folder, FolderKanban, FolderPlus, ImagePlus, Images, Layers3, LogOut, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { closeDeveloperSession, createDeveloperPassword, getDeveloperStatus, verifyDeveloperPassword } from '../lib/developerAuth.js'
import { compressImage, loadContent, makeId, migrateLegacyContent, saveContent } from '../lib/contentStore.js'
import RichTextEditor from './RichTextEditor.jsx'

const blankArticle = () => ({ title: '', excerpt: '', body: '', tags: '', date: new Date().toISOString().slice(0, 10), cover: '', screenshots: [] })
const blankProject = () => ({ title: '', subtitle: '', description: '', body: '', screenshots: [], metric: '', tags: '', href: '', image: '' })
const blankPhoto = () => ({ title: '', images: [] })
const blankMaterial = groupId => ({ title: '', groupId: groupId || '', images: [] })

const tabCopy = {
  photos: { overline: 'PHOTO ARCHIVE', heading: '相片管理', add: '相片' },
  materials: { overline: 'VISUAL VAULT', heading: '素材库管理', add: '素材' },
  articles: { overline: 'WRITING', heading: '文章管理', add: '文章' },
  projects: { overline: 'PORTFOLIO', heading: '项目管理', add: '项目' },
}

export default function DeveloperPortal({ content, onContentChange }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState('photos')
  const [editor, setEditor] = useState(null)
  const [articleForm, setArticleForm] = useState(blankArticle())
  const [projectForm, setProjectForm] = useState(blankProject())
  const [photoForm, setPhotoForm] = useState(blankPhoto())
  const [materialForm, setMaterialForm] = useState(blankMaterial())
  const [groupForm, setGroupForm] = useState({ id: '', name: '' })
  const [collapsedGroups, setCollapsedGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getDeveloperStatus()
      .then(status => {
        setAuthenticated(status.authenticated)
        setNeedsSetup(status.setupRequired)
      })
      .catch(() => {
        setAuthenticated(false)
        setNeedsSetup(false)
      })
  }, [])

  useEffect(() => {
    if (!authOpen && !portalOpen) return undefined
    const close = event => {
      if (event.key !== 'Escape') return
      if (editor) setEditor(null)
      else if (portalOpen) setPortalOpen(false)
      else setAuthOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [authOpen, editor, portalOpen])

  useEffect(() => {
    document.body.classList.toggle('modal-open', authOpen || portalOpen)
    return () => document.body.classList.remove('modal-open')
  }, [authOpen, portalOpen])

  const openDeveloperMode = async () => {
    setAuthError('')
    setUsername('')
    setPassword('')
    try {
      const status = await getDeveloperStatus()
      setAuthenticated(status.authenticated)
      setNeedsSetup(status.setupRequired)
      if (status.authenticated) setPortalOpen(true)
      else setAuthOpen(true)
    } catch {
      setNeedsSetup(false)
      setAuthError('后端服务未连接，请先启动完整项目')
      setAuthOpen(true)
    }
  }

  const submitAuth = async event => {
    event.preventDefault()
    setAuthError('')
    try {
      if (needsSetup) await createDeveloperPassword(username, password)
      else if (!(await verifyDeveloperPassword(username, password))) throw new Error('账号或密码不正确')
      const serverContent = await loadContent()
      const migratedContent = await migrateLegacyContent(serverContent)
      onContentChange(migratedContent)
      setAuthenticated(true)
      setAuthOpen(false)
      setPortalOpen(true)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const commit = async nextContent => {
    setSaving(true)
    setNotice('')
    try {
      const savedContent = await saveContent(nextContent)
      onContentChange(savedContent)
      setNotice('已保存到服务端数据库')
      window.setTimeout(() => setNotice(''), 2200)
    } catch (error) {
      console.error(error)
      setNotice(error.message || '保存失败，请检查后端服务')
      throw error
    } finally {
      setSaving(false)
    }
  }

  const startNew = (type, groupId = '') => {
    setTab(type)
    setEditor({ type, id: null })
    if (type === 'articles') setArticleForm(blankArticle())
    else if (type === 'projects') setProjectForm(blankProject())
    else if (type === 'photos') setPhotoForm(blankPhoto())
    else setMaterialForm(blankMaterial(groupId || content.materialGroups?.[0]?.id))
  }

  const toggleMaterialGroup = id => {
    setCollapsedGroups(current => current.includes(id) ? current.filter(groupId => groupId !== id) : [...current, id])
  }

  const startEdit = (type, item) => {
    setTab(type)
    setEditor({ type, id: item.id })
    if (type === 'articles') setArticleForm({ ...item, tags: item.tags?.join(', ') || '', screenshots: item.screenshots || [] })
    else if (type === 'projects') setProjectForm({ ...item, body: item.body || '', screenshots: item.screenshots || [], tags: item.tags?.join(', ') || '' })
    else if (type === 'photos') setPhotoForm({ title: item.title || '', images: [item.image] })
    else setMaterialForm({ title: item.title || '', groupId: item.groupId || content.materialGroups?.[0]?.id || '', images: [item.image] })
  }

  const removeItem = async (type, id) => {
    if (!window.confirm('确定删除这条内容吗？删除后无法撤销。')) return
    await commit({ ...content, [type]: content[type].filter(item => item.id !== id) })
  }

  const readImage = async file => {
    setUploading(true)
    try {
      return await compressImage(file)
    } finally {
      setUploading(false)
    }
  }

  const downloadImage = async item => {
    try {
      const response = await fetch(item.image, { credentials: 'include' })
      if (!response.ok) throw new Error('图片下载失败')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${(item.title || 'portfolio-image').replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-|-$/g, '') || 'portfolio-image'}.webp`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setNotice('图片已下载到本地')
      window.setTimeout(() => setNotice(''), 1800)
    } catch (error) {
      setNotice(error.message || '图片下载失败')
    }
  }

  const openGroupManager = (group = null) => {
    setTab('materials')
    setGroupForm(group ? { id: group.id, name: group.name } : { id: '', name: '' })
    setEditor({ type: 'materialGroups', id: group?.id || null })
  }

  const submitGroup = async event => {
    event.preventDefault()
    const name = groupForm.name.trim()
    if (!name) return
    const materialGroups = groupForm.id
      ? content.materialGroups.map(group => group.id === groupForm.id ? { ...group, name } : group)
      : [...content.materialGroups, { id: makeId(), name, createdAt: new Date().toISOString() }]
    await commit({ ...content, materialGroups })
    setGroupForm({ id: '', name: '' })
    setEditor({ type: 'materialGroups', id: null })
  }

  const removeGroup = async id => {
    if (content.materialGroups.length <= 1) {
      setNotice('素材库至少需要保留一个分组')
      return
    }
    if (!window.confirm('删除分组后，其中的素材会移动到第一个分组。确定继续吗？')) return
    const materialGroups = content.materialGroups.filter(group => group.id !== id)
    const fallback = materialGroups[0].id
    const materials = content.materials.map(item => item.groupId === id ? { ...item, groupId: fallback } : item)
    await commit({ ...content, materialGroups, materials })
  }

  const submitArticle = async event => {
    event.preventDefault()
    const record = {
      ...articleForm,
      cover: articleForm.cover || '',
      screenshots: articleForm.screenshots.filter(Boolean),
      id: editor.id || makeId(),
      tags: articleForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      createdAt: articleForm.createdAt || new Date().toISOString(),
    }
    const exists = content.articles.some(item => item.id === record.id)
    const articles = exists ? content.articles.map(item => item.id === record.id ? record : item) : [record, ...content.articles]
    await commit({ ...content, articles })
    setEditor(null)
  }

  const submitProject = async event => {
    event.preventDefault()
    const record = {
      ...projectForm,
      image: projectForm.image || '',
      screenshots: (projectForm.screenshots || []).filter(Boolean),
      id: editor.id || makeId(),
      tags: projectForm.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      createdAt: projectForm.createdAt || new Date().toISOString(),
    }
    const exists = content.projects.some(item => item.id === record.id)
    const projects = exists ? content.projects.map(item => item.id === record.id ? record : item) : [record, ...content.projects]
    await commit({ ...content, projects })
    setEditor(null)
  }

  const submitPhoto = async event => {
    event.preventDefault()
    const images = photoForm.images.filter(Boolean)
    if (!images.length) {
      setNotice('请先选择至少一张相片')
      return
    }

    let photos
    if (editor.id) {
      photos = content.photos.map(item => item.id === editor.id ? {
        ...item,
        title: photoForm.title.trim(),
        image: images[0],
      } : item)
    } else {
      const records = images.map((image, index) => ({
        id: makeId(),
        title: photoForm.title.trim() ? `${photoForm.title.trim()}${images.length > 1 ? ` ${String(index + 1).padStart(2, '0')}` : ''}` : '',
        image,
        createdAt: new Date().toISOString(),
      }))
      photos = [...records, ...content.photos]
    }
    await commit({ ...content, photos })
    setEditor(null)
  }

  const submitMaterial = async event => {
    event.preventDefault()
    const images = materialForm.images.filter(Boolean)
    if (!images.length) {
      setNotice('请先选择至少一张素材图片')
      return
    }
    let materials
    if (editor.id) {
      materials = content.materials.map(item => item.id === editor.id ? { ...item, title: materialForm.title.trim(), groupId: materialForm.groupId, image: images[0] } : item)
    } else {
      const records = images.map((image, index) => ({
        id: makeId(),
        title: materialForm.title.trim() ? `${materialForm.title.trim()}${images.length > 1 ? ` ${String(index + 1).padStart(2, '0')}` : ''}` : '',
        image,
        groupId: materialForm.groupId || content.materialGroups?.[0]?.id,
        createdAt: new Date().toISOString(),
      }))
      materials = [...records, ...content.materials]
    }
    await commit({ ...content, materials })
    setEditor(null)
  }

  const logout = async () => {
    await closeDeveloperSession().catch(() => {})
    setAuthenticated(false)
    setPortalOpen(false)
    setEditor(null)
  }

  return (
    <>
      <button className={`developer-entry ${authenticated ? 'developer-entry--active' : ''}`} onClick={openDeveloperMode}>
        <Code2 size={16} />
        <span>{authenticated ? 'DEV CONSOLE' : 'DEVELOPER MODE'}</span>
        <i />
      </button>

      {authOpen && (
        <div className="dev-backdrop" onMouseDown={event => event.target === event.currentTarget && setAuthOpen(false)}>
          <div className="dev-auth" role="dialog" aria-modal="true" aria-labelledby="dev-auth-title">
            <button className="dev-close" onClick={() => setAuthOpen(false)} aria-label="关闭"><X /></button>
            <div className="dev-auth-mark"><Code2 /></div>
            <span className="dev-overline">SERVER CONTENT SYSTEM / OWNER ONLY</span>
            <h2 id="dev-auth-title">{needsSetup ? '创建开发者密码' : '进入开发者模式'}</h2>
            <p>{needsSetup ? '首次使用需要设置服务端开发者密码。' : '验证身份后才能管理相片、素材、文章与项目。'}</p>
            <form onSubmit={submitAuth}>
              <label>开发者账号<input type="text" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" minLength="3" required placeholder="请输入唯一账号" autoFocus /></label>
              <label>开发者密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={needsSetup ? 'new-password' : 'current-password'} minLength="6" required placeholder="至少 6 位" /></label>
              {authError && <div className="dev-error">{authError}</div>}
              <button type="submit" className="dev-primary">{needsSetup ? '设置并进入' : '登录'} <span>→</span></button>
            </form>
            <small>密码由后端加密保存，内容写入 SQLite，图片保存到服务端文件目录。</small>
          </div>
        </div>
      )}

      {portalOpen && (
        <div className="dev-console-backdrop">
          <aside className="dev-console" role="dialog" aria-modal="true" aria-label="开发者控制台">
            <header className="dev-console-head">
              <div><span>OWNER / SERVER CMS</span><strong>DEVELOPER CONSOLE</strong></div>
              <button onClick={() => setPortalOpen(false)} aria-label="关闭控制台"><X /></button>
            </header>

            <div className="dev-console-tabs">
              <button className={tab === 'photos' ? 'active' : ''} onClick={() => { setTab('photos'); setEditor(null) }}><Images size={17} />相片 <span>{content.photos.length}</span></button>
              <button className={tab === 'materials' ? 'active' : ''} onClick={() => { setTab('materials'); setEditor(null) }}><Layers3 size={17} />素材库 <span>{content.materials.length}</span></button>
              <button className={tab === 'articles' ? 'active' : ''} onClick={() => { setTab('articles'); setEditor(null) }}><FileText size={17} />文章 <span>{content.articles.length}</span></button>
              <button className={tab === 'projects' ? 'active' : ''} onClick={() => { setTab('projects'); setEditor(null) }}><FolderKanban size={17} />项目 <span>{content.projects.length}</span></button>
              <button className="dev-logout" onClick={logout}><LogOut size={16} />退出</button>
            </div>

            <div className="dev-console-body">
              {!editor && (
                <>
                  <div className="dev-list-head">
                    <div><span>{tabCopy[tab].overline}</span><h3>{tabCopy[tab].heading}</h3></div>
                    <div className="dev-list-actions">
                      {tab === 'materials' && <button className="dev-secondary" onClick={() => openGroupManager()}><FolderPlus size={17} />新建分组</button>}
                      <button className="dev-add" onClick={() => startNew(tab)}><Plus size={17} />新增{tabCopy[tab].add}</button>
                    </div>
                  </div>
                  {tab === 'materials' ? (
                    <div className="dev-material-tree">
                      {content.materialGroups.map((group, groupIndex) => {
                        const groupMaterials = content.materials.filter(item => item.groupId === group.id)
                        const collapsed = collapsedGroups.includes(group.id)
                        return (
                          <section className={`dev-material-group ${collapsed ? 'is-collapsed' : ''}`} key={group.id}>
                            <div className="dev-material-group-head">
                              <button className="dev-material-group-toggle" onClick={() => toggleMaterialGroup(group.id)} aria-expanded={!collapsed}>
                                <span className="dev-material-folder"><Folder /></span>
                                <span className="dev-material-group-copy"><small>GROUP {String(groupIndex + 1).padStart(2, '0')}</small><strong>{group.name}</strong><em>{groupMaterials.length} 张图片</em></span>
                                {collapsed ? <ChevronRight /> : <ChevronDown />}
                              </button>
                              <div className="dev-material-group-actions">
                                <button onClick={() => startNew('materials', group.id)} title={`向“${group.name}”添加图片`} aria-label={`向“${group.name}”添加图片`}><Plus /></button>
                                <button onClick={() => openGroupManager(group)} title="重命名分组" aria-label={`重命名“${group.name}”`}><Pencil /></button>
                                <button className="danger" disabled={content.materialGroups.length <= 1} onClick={() => removeGroup(group.id)} title={content.materialGroups.length <= 1 ? '至少需要保留一个分组' : '删除分组'} aria-label={`删除“${group.name}”`}><Trash2 /></button>
                              </div>
                            </div>
                            {!collapsed && (
                              <div className="dev-material-children">
                                {!groupMaterials.length && <button className="dev-material-empty" onClick={() => startNew('materials', group.id)}><ImagePlus />这个分组还没有图片，点击添加</button>}
                                {groupMaterials.map(item => (
                                  <article className="dev-item dev-item--downloadable" key={item.id}>
                                    <div className="dev-item-thumb"><img src={item.image} alt="" /></div>
                                    <div><strong>{item.title || '未命名素材'}</strong><p>IMAGE · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</p></div>
                                    <button onClick={() => downloadImage(item)} aria-label="下载原图" title="下载到本地"><Download size={16} /></button>
                                    <button onClick={() => startEdit('materials', item)} aria-label="编辑"><Pencil size={16} /></button>
                                    <button className="danger" onClick={() => removeItem('materials', item.id)} aria-label="删除"><Trash2 size={16} /></button>
                                  </article>
                                ))}
                              </div>
                            )}
                          </section>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="dev-item-list">
                      {!content[tab].length && <div className="dev-list-empty">暂无内容，点击右上角开始创建。</div>}
                      {content[tab].map(item => (
                        <article className={`dev-item ${tab === 'photos' ? 'dev-item--downloadable' : ''}`} key={item.id}>
                          <div className="dev-item-thumb">{(item.cover || item.image) ? <img src={item.cover || item.image} alt="" /> : <Code2 />}</div>
                          <div><strong>{item.title || (tab === 'photos' ? '未命名相片' : '')}</strong><p>{item.excerpt || item.description || (tab === 'photos' ? `PHOTO · ${new Date(item.createdAt).toLocaleDateString('zh-CN')}` : '')}</p></div>
                          {tab === 'photos' && <button onClick={() => downloadImage(item)} aria-label="下载原图" title="下载到本地"><Download size={16} /></button>}
                          <button onClick={() => startEdit(tab, item)} aria-label="编辑"><Pencil size={16} /></button>
                          <button className="danger" onClick={() => removeItem(tab, item.id)} aria-label="删除"><Trash2 size={16} /></button>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}

              {editor?.type === 'articles' && (
                <form className="dev-editor" onSubmit={submitArticle}>
                  <div className="dev-editor-title"><button type="button" onClick={() => setEditor(null)}>← 返回</button><h3>{editor.id ? '编辑文章' : '新建文章'}</h3></div>
                  <div className="dev-field-grid">
                    <label className="wide">文章标题<input value={articleForm.title} onChange={event => setArticleForm({ ...articleForm, title: event.target.value })} required /></label>
                    <label>发布日期<input type="date" value={articleForm.date} onChange={event => setArticleForm({ ...articleForm, date: event.target.value })} required /></label>
                    <label>标签（逗号分隔）<input value={articleForm.tags} onChange={event => setArticleForm({ ...articleForm, tags: event.target.value })} placeholder="Python, Agent" /></label>
                    <label className="wide">摘要<textarea rows="3" value={articleForm.excerpt} onChange={event => setArticleForm({ ...articleForm, excerpt: event.target.value })} required /></label>
                  </div>
                  <RichTextEditor value={articleForm.body} onChange={body => setArticleForm(current => ({ ...current, body }))} uploadImage={async file => { const url = await readImage(file); setArticleForm(current => ({ ...current, screenshots: [...new Set([...(current.screenshots || []), url])] })); return url }} label="文章正文" />
                  <label className="dev-upload dev-upload--single"><ImagePlus /><span>上传文章封面<small>正文配图请使用上方“插入图片”</small></span><input type="file" accept="image/*" onChange={async event => { const file = event.target.files[0]; if (file) { const cover = await readImage(file); setArticleForm(current => ({ ...current, cover })) } }} /></label>
                  {articleForm.cover && <div className="dev-project-preview"><img src={articleForm.cover} alt="" /><button type="button" onClick={() => setArticleForm({ ...articleForm, cover: '' })}><X /></button></div>}
                  <button className="dev-save" disabled={saving || uploading}><Save size={17} />{uploading ? '正在处理图片…' : saving ? '正在保存…' : '保存并发布'}</button>
                </form>
              )}

              {editor?.type === 'photos' && (
                <form className="dev-editor" onSubmit={submitPhoto}>
                  <div className="dev-editor-title"><button type="button" onClick={() => setEditor(null)}>← 返回</button><h3>{editor.id ? '编辑相片' : '添加相片'}</h3></div>
                  <div className="dev-field-grid">
                    <label className="wide">相片名称（可选）<input value={photoForm.title} onChange={event => setPhotoForm({ ...photoForm, title: event.target.value })} placeholder="不填则自动显示 PHOTO 编号" /></label>
                  </div>
                  <label className="dev-upload dev-upload--single"><ImagePlus /><span>{editor.id ? '替换相片' : '选择相片'}<small>{editor.id ? '单张图片，自动压缩为 WebP' : '可一次选择多张，自动压缩为 WebP'}</small></span><input type="file" accept="image/*" multiple={!editor.id} onChange={async event => { const files = [...event.target.files]; if (files.length) setPhotoForm({ ...photoForm, images: (await Promise.all(files.map(file => readImage(file)))).filter(Boolean) }) }} /></label>
                  {!!photoForm.images.length && <div className="dev-media-preview">{photoForm.images.map((image, index) => <div key={index}><img src={image} alt="" /><button type="button" onClick={() => setPhotoForm({ ...photoForm, images: photoForm.images.filter((_, itemIndex) => index !== itemIndex) })}><X /></button></div>)}</div>}
                  <button className="dev-save" disabled={saving || uploading}><Save size={17} />{uploading ? '正在处理图片…' : saving ? '正在保存…' : '保存并发布'}</button>
                </form>
              )}

              {editor?.type === 'materials' && (
                <form className="dev-editor" onSubmit={submitMaterial}>
                  <div className="dev-editor-title"><button type="button" onClick={() => setEditor(null)}>← 返回</button><h3>{editor.id ? '编辑素材' : '添加素材'}</h3></div>
                  <div className="dev-field-grid">
                    <label className="wide">素材名称（可选）<input value={materialForm.title} onChange={event => setMaterialForm({ ...materialForm, title: event.target.value })} placeholder="例如：RETRO CAT COLLAGE" /></label>
                    <label className="wide">所属分组<select value={materialForm.groupId} onChange={event => setMaterialForm({ ...materialForm, groupId: event.target.value })} required>{content.materialGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                  </div>
                  <label className="dev-upload dev-upload--single"><ImagePlus /><span>{editor.id ? '替换素材' : '选择素材图片'}<small>{editor.id ? '单张图片，自动压缩为 WebP' : '可一次选择多张，保留竖长图比例'}</small></span><input type="file" accept="image/*" multiple={!editor.id} onChange={async event => { const files = [...event.target.files]; if (files.length) setMaterialForm({ ...materialForm, images: (await Promise.all(files.map(file => readImage(file)))).filter(Boolean) }) }} /></label>
                  {!!materialForm.images.length && <div className="dev-media-preview dev-media-preview--poster">{materialForm.images.map((image, index) => <div key={index}><img src={image} alt="" /><button type="button" onClick={() => setMaterialForm({ ...materialForm, images: materialForm.images.filter((_, itemIndex) => index !== itemIndex) })}><X /></button></div>)}</div>}
                  <button className="dev-save" disabled={saving || uploading}><Save size={17} />{uploading ? '正在处理图片…' : saving ? '正在保存…' : '保存并发布'}</button>
                </form>
              )}

              {editor?.type === 'materialGroups' && (
                <div className="dev-editor">
                  <div className="dev-editor-title"><button type="button" onClick={() => setEditor(null)}>← 返回</button><h3>素材分组管理</h3></div>
                  <form className="dev-group-form" onSubmit={submitGroup}>
                    <label>{groupForm.id ? '修改分组名称' : '新建分组'}<input value={groupForm.name} onChange={event => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="例如：复古海报" required /></label>
                    <button className="dev-save" disabled={saving}><Save size={16} />{groupForm.id ? '保存名称' : '创建分组'}</button>
                  </form>
                  <div className="dev-group-list">
                    {content.materialGroups.map(group => (
                      <article key={group.id}>
                        <div><strong>{group.name}</strong><span>{content.materials.filter(item => item.groupId === group.id).length} 张素材</span></div>
                        <button onClick={() => openGroupManager(group)} aria-label="重命名分组"><Pencil size={16} /></button>
                        <button className="danger" onClick={() => removeGroup(group.id)} aria-label="删除分组"><Trash2 size={16} /></button>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {editor?.type === 'projects' && (
                <form className="dev-editor" onSubmit={submitProject}>
                  <div className="dev-editor-title"><button type="button" onClick={() => setEditor(null)}>← 返回</button><h3>{editor.id ? '编辑项目' : '新建项目'}</h3></div>
                  <div className="dev-field-grid">
                    <label className="wide">项目名称<input value={projectForm.title} onChange={event => setProjectForm({ ...projectForm, title: event.target.value })} required /></label>
                    <label>副标题<input value={projectForm.subtitle} onChange={event => setProjectForm({ ...projectForm, subtitle: event.target.value })} /></label>
                    <label>结果 / 数据<input value={projectForm.metric} onChange={event => setProjectForm({ ...projectForm, metric: event.target.value })} /></label>
                    <label className="wide">项目描述<textarea rows="5" value={projectForm.description} onChange={event => setProjectForm({ ...projectForm, description: event.target.value })} required /></label>
                    <label>技术栈（逗号分隔）<input value={projectForm.tags} onChange={event => setProjectForm({ ...projectForm, tags: event.target.value })} placeholder="Python, Django" /></label>
                    <label>项目链接<input type="url" value={projectForm.href} onChange={event => setProjectForm({ ...projectForm, href: event.target.value })} placeholder="https://" /></label>
                  </div>
                  <RichTextEditor value={projectForm.body || ''} onChange={body => setProjectForm(current => ({ ...current, body }))} uploadImage={async file => { const url = await readImage(file); setProjectForm(current => ({ ...current, screenshots: [...new Set([...(current.screenshots || []), url])] })); return url }} label="项目详情" />
                  <label className="dev-upload dev-upload--single"><ImagePlus /><span>上传项目封面<small>详情配图请使用上方“插入图片”</small></span><input type="file" accept="image/*" onChange={async event => { const file = event.target.files[0]; if (file) { const image = await readImage(file); setProjectForm(current => ({ ...current, image })) } }} /></label>
                  {projectForm.image && <div className="dev-project-preview"><img src={projectForm.image} alt="" /><button type="button" onClick={() => setProjectForm({ ...projectForm, image: '' })}><X /></button></div>}
                  <button className="dev-save" disabled={saving || uploading}><Save size={17} />{uploading ? '正在处理图片…' : saving ? '正在保存…' : '保存并发布'}</button>
                </form>
              )}
              {notice && <div className="dev-notice">{notice}</div>}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
