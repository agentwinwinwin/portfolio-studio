import { ArrowUpRight, CalendarDays, Hash, Image as ImageIcon } from 'lucide-react'

export default function ArticleArchive({ articles = [], onOpen }) {
  return (
    <>
      <section className="articles section shell motion-section" id="articles">
        <div className="motion-display">FIELD <span>NOTES</span></div>
        <div className="section-heading section-heading--split">
          <div>
            <div className="section-eyebrow"><span>03</span> WRITING / 开发手记</div>
            <h2>记录构建过程，<br />不只展示结果。</h2>
          </div>
          <p>关于 Python、Agent、数据工程与产品实践的长期记录。</p>
        </div>

        {articles.length ? (
          <div className="article-stream">
            {articles.map((article, index) => (
              <button className="article-row" data-motion-card key={article.id} onClick={() => onOpen?.(article)}>
                <span className="article-row-index">{String(index + 1).padStart(2, '0')}</span>

                <div className="article-row-main">
                  <div className="article-author">
                    <span className="article-avatar">DEMO</span>
                    <strong>示例作者</strong>
                    <i />
                    <span>PYTHON / AI AGENT</span>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                  <div className="article-row-meta">
                    <span><CalendarDays />{article.date || new Date(article.createdAt).toLocaleDateString('zh-CN')}</span>
                    {article.tags?.map(tag => <span key={tag}><Hash />{tag}</span>)}
                    {!!article.screenshots?.length && <span><ImageIcon />{article.screenshots.length} 张配图</span>}
                  </div>
                </div>

                <div className={`article-row-side ${article.cover ? 'article-row-side--cover' : ''}`}>
                  {article.cover && <img src={article.cover} alt="" loading="lazy" decoding="async" />}
                  <span className="article-read">READ NOTE <ArrowUpRight /></span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="article-empty" data-motion-card>
            <span>NO. 000</span>
            <p>还没有发布开发手记。</p>
            <small>进入开发者模式后，可以添加文章、封面和项目截图。</small>
          </div>
        )}
      </section>

    </>
  )
}
