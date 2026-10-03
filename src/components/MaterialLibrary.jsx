import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import FlexCarousel from './FlexCarousel.jsx'

export default function MaterialLibrary({ materials = [], materialGroups = [] }) {
  const groups = useMemo(() => materialGroups.length ? materialGroups : [{ id: 'seed-material-group-01', name: '全部素材' }], [materialGroups])
  const [groupId, setGroupId] = useState(groups[0]?.id || '')
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (!groups.some(group => group.id === groupId)) setGroupId(groups[0]?.id || '')
  }, [groupId, groups])

  useEffect(() => {
    if (!active) return undefined
    document.body.classList.add('modal-open')
    const close = event => event.key === 'Escape' && setActive(null)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('keydown', close)
      document.body.classList.remove('modal-open')
    }
  }, [active])

  const currentGroup = groups.find(group => group.id === groupId) || groups[0]
  const validGroupIds = new Set(groups.map(group => group.id))
  const items = materials
    .filter(item => item.groupId === currentGroup?.id || (!validGroupIds.has(item.groupId) && currentGroup?.id === groups[0]?.id))
    .map(item => ({ ...item, src: item.image, title: item.title || '未命名素材', subtitle: currentGroup?.name }))

  return (
    <>
      <section className="materials section motion-section" id="materials">
        <div className="shell materials-heading">
          <div className="motion-display">VISUAL <span>VAULT</span></div>
          <div className="section-heading section-heading--split">
            <div>
              <div className="section-eyebrow"><span>05</span> MATERIALS / 素材库</div>
              <h2>收集灵感，<br />也收集视觉语言。</h2>
            </div>
            <p>按主题整理的视觉档案。图片会缓慢自动切换，按住拖动可手动浏览，点击任意图片查看大图。</p>
          </div>
          <div className="material-groups" role="tablist" aria-label="素材分组">
            {groups.map((group, index) => {
              const count = materials.filter(item => item.groupId === group.id || (!validGroupIds.has(item.groupId) && index === 0)).length
              return (
                <button key={group.id} role="tab" aria-selected={group.id === currentGroup?.id} className={group.id === currentGroup?.id ? 'active' : ''} onClick={() => setGroupId(group.id)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>{group.name}<i>{count}</i>
                </button>
              )
            })}
          </div>
        </div>
        <div className="material-carousel" data-motion-card>
          {items.length ? (
            <FlexCarousel
              key={currentGroup?.id}
              items={items}
              intro="deal"
              fit="portrait"
              cardHeight={.64}
              gap={22}
              radius={20}
              bend={.46}
              tilt={11}
              dispersion={.5}
              squeeze={.14}
              autoplay
              interval={6.5}
              captureWheel={false}
              paused={Boolean(active)}
              captions
              onSelect={(_, item) => setActive(item)}
            />
          ) : (
            <div className="material-empty"><span>GROUP / EMPTY</span><p>这个分组还是空的。</p><small>进入开发者模式向「{currentGroup?.name}」上传素材。</small></div>
          )}
          <div className="material-carousel-index"><span>{currentGroup?.name || '素材库'}</span><span>{String(items.length).padStart(2, '0')} ASSETS</span></div>
        </div>
      </section>

      {active && (
        <div className="material-lightbox" onMouseDown={event => event.target === event.currentTarget && setActive(null)}>
          <button onClick={() => setActive(null)} aria-label="关闭素材预览"><X /></button>
          <figure>
            <img src={active.image} alt={active.title || '素材原图'} />
            <figcaption>{active.title || 'UNTITLED MATERIAL'}</figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
