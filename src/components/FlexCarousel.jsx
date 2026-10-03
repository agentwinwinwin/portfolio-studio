import { useEffect, useMemo, useRef, useState } from 'react'
import './FlexCarousel.css'

const wrapIndex = (value, length) => ((value % length) + length) % length
const signedDistance = (index, active, length) => {
  let distance = index - active
  if (distance > length / 2) distance -= length
  if (distance < -length / 2) distance += length
  return distance
}

export default function FlexCarousel({
  items = [], intro = 'rise', fit = 'portrait', cardHeight = .58, gap = 18, radius = 18,
  bend = .34, tilt = 10, dispersion = .42, squeeze = .15,
  autoplay = false, interval = 4, captions = true, captureWheel = false, paused = false, onChange, onSelect,
  className = '',
}) {
  const rootRef = useRef(null)
  const pointerRef = useRef(null)
  const wheelLockRef = useRef(false)
  const lastDragAtRef = useRef(0)
  const [active, setActive] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const [size, setSize] = useState({ width: 1200, height: 620 })
  const [ready, setReady] = useState(false)
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  const list = items || []

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const resize = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 })
    resize.observe(root)
    intersection.observe(root)
    const timer = window.setTimeout(() => setReady(true), reduced || intro === 'none' ? 10 : 120)
    return () => {
      resize.disconnect()
      intersection.disconnect()
      window.clearTimeout(timer)
    }
  }, [intro, reduced])

  useEffect(() => {
    if (!autoplay || reduced || !visible || dragging || paused || list.length < 2) return undefined
    const timer = window.setInterval(() => setActive(value => wrapIndex(value + 1, list.length)), interval * 1000)
    return () => window.clearInterval(timer)
  }, [autoplay, dragging, interval, list.length, paused, reduced, visible])

  useEffect(() => {
    if (!list.length) return
    setActive(value => Math.min(value, list.length - 1))
  }, [list.length])

  useEffect(() => {
    if (list[active]) onChange?.(active, list[active])
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const cardH = Math.max(210, Math.min(size.height * cardHeight, size.height - 120))
  const ratio = fit === 'square' ? 1 : fit === 'landscape' ? 1.34 : .66
  const cardW = cardH * ratio
  const step = Math.min(cardW + gap, size.width * (size.width < 700 ? .54 : .27))

  const move = direction => {
    if (list.length < 2) return
    setActive(value => wrapIndex(value + direction, list.length))
  }

  const onPointerDown = event => {
    if (event.button !== undefined && event.button !== 0) return
    pointerRef.current = { id: event.pointerId, x: event.clientX, startX: event.clientX, moved: false }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = event => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    pointer.x = event.clientX
    if (Math.abs(event.clientX - pointer.startX) > 6) pointer.moved = true
    setDragX(event.clientX - pointer.startX)
  }

  const finishDrag = event => {
    const pointer = pointerRef.current
    if (!pointer || pointer.id !== event.pointerId) return
    const distance = event.clientX - pointer.startX
    if (Math.abs(distance) > Math.min(70, step * .28)) move(distance < 0 ? 1 : -1)
    if (pointer.moved) lastDragAtRef.current = Date.now()
    pointerRef.current = null
    setDragging(false)
    setDragX(0)
  }

  const onWheel = event => {
    if (!captureWheel || wheelLockRef.current || list.length < 2) return
    if (Math.abs(event.deltaX) < 3 && Math.abs(event.deltaY) < 3) return
    event.preventDefault()
    wheelLockRef.current = true
    move((Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) > 0 ? 1 : -1)
    window.setTimeout(() => { wheelLockRef.current = false }, 360)
  }

  const select = index => {
    if (Date.now() - lastDragAtRef.current < 280) return
    onSelect?.(index, list[index])
  }

  const onKeyDown = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1) }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
    else if ((event.key === 'Enter' || event.key === ' ') && list[active]) { event.preventDefault(); select(active) }
  }

  if (!list.length) return null
  const current = list[active] || list[0]

  return (
    <div
      ref={rootRef}
      className={`flex-carousel flex-carousel--${intro} ${ready ? 'is-ready' : ''} ${dragging ? 'is-dragging' : ''} ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="素材图片轮播"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onWheel={captureWheel ? onWheel : undefined}
      onKeyDown={onKeyDown}
    >
      <div className="flex-carousel__stage" aria-live="polite">
        {list.map((item, index) => {
          const distance = signedDistance(index, active, list.length)
          const x = distance * step + dragX
          const normalized = Math.max(-1, Math.min(1, x / Math.max(size.width * .55, 1)))
          const y = Math.sin(normalized * Math.PI) * bend * size.height * .22
          const rotation = normalized * tilt
          const activeCard = index === active
          const speedScale = dragging ? 1 - Math.min(squeeze, Math.abs(dragX) / Math.max(size.width, 1) * squeeze * 4) : 1
          const opacity = Math.max(.22, 1 - Math.abs(normalized) * .68)
          return (
            <button
              type="button"
              className={`flex-carousel__card ${activeCard ? 'is-active' : ''}`}
              key={item.id || item.src}
              onClick={event => { event.stopPropagation(); select(index) }}
              aria-label={`${item.title || item.alt || `素材 ${index + 1}`}，点击查看大图`}
              style={{
                '--fc-x': `${x}px`, '--fc-y': `${y}px`, '--fc-rotate': `${rotation}deg`,
                '--fc-scale': speedScale, '--fc-opacity': opacity,
                '--fc-width': `${cardW}px`, '--fc-height': `${cardH}px`,
                '--fc-radius': `${radius}px`, '--fc-dispersion': dispersion,
                zIndex: 50 - Math.round(Math.abs(distance)),
              }}
            >
              <img src={item.src} alt={item.alt || item.title || ''} draggable="false" decoding="async" loading="lazy" />
              <span className="flex-carousel__edge" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      {captions && current && (
        <div className="flex-carousel__caption" aria-hidden="true">
          <span key={`${active}-${current.title}`} className="flex-carousel__title">{current.title || current.alt || 'UNTITLED'}</span>
          <span className="flex-carousel__subtitle">{current.subtitle}</span>
          <span className="flex-carousel__count">{String(active + 1).padStart(2, '0')} <i>/</i> {String(list.length).padStart(2, '0')}</span>
        </div>
      )}
      <div className="flex-carousel__hint">AUTO / HOLD &amp; DRAG / CLICK TO VIEW</div>
    </div>
  )
}
