import { useCallback, useEffect, useRef } from 'react'
import './BorderGlow.css'

function parseHSL(hslStr) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/)
  if (!match) return { h: 40, s: 80, l: 80 }
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) }
}

function buildGlowVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor)
  const base = `${h}deg ${s}% ${l}%`
  const opacities = [100, 60, 50, 40, 30, 20, 10]
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10']
  return Object.fromEntries(keys.map((key, index) => [
    `--glow-color${key}`,
    `hsl(${base} / ${Math.min(opacities[index] * intensity, 100)}%)`,
  ]))
}

const positions = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%']
const keys = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven']
const colorMap = [0, 1, 2, 0, 1, 2, 1]

function buildGradientVars(colors) {
  const vars = {}
  keys.forEach((key, index) => {
    const color = colors[Math.min(colorMap[index], colors.length - 1)]
    vars[key] = `radial-gradient(at ${positions[index]}, ${color} 0px, transparent 50%)`
  })
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`
  return vars
}

function easeOutCubic(x) { return 1 - ((1 - x) ** 3) }
function easeInCubic(x) { return x ** 3 }

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
  const timeout = window.setTimeout(() => {
    const startedAt = performance.now()
    const tick = () => {
      const progress = Math.min((performance.now() - startedAt) / duration, 1)
      onUpdate(start + (end - start) * ease(progress))
      if (progress < 1) requestAnimationFrame(tick)
      else onEnd?.()
    }
    requestAnimationFrame(tick)
  }, delay)
  return timeout
}

export default function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
}) {
  const cardRef = useRef(null)
  const pointerFrameRef = useRef(0)
  const pointerPositionRef = useRef({ x: 0, y: 0 })

  const handlePointerMove = useCallback((event) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    if (pointerFrameRef.current) return
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = 0
      const card = cardRef.current
      if (!card) return
      const rect = card.getBoundingClientRect()
      const x = pointerPositionRef.current.x - rect.left
      const y = pointerPositionRef.current.y - rect.top
      const cx = rect.width / 2
      const cy = rect.height / 2
      const dx = x - cx
      const dy = y - cy
      const kx = dx === 0 ? Infinity : cx / Math.abs(dx)
      const ky = dy === 0 ? Infinity : cy / Math.abs(dy)
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
      if (angle < 0) angle += 360
      card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3))
      card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(pointerFrameRef.current), [])

  useEffect(() => {
    if (!animated || !cardRef.current) return undefined
    const card = cardRef.current
    const timers = []
    card.classList.add('sweep-active')
    card.style.setProperty('--cursor-angle', '110deg')
    timers.push(animateValue({ duration: 500, onUpdate: value => card.style.setProperty('--edge-proximity', value) }))
    timers.push(animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: value => card.style.setProperty('--cursor-angle', `${355 * (value / 100) + 110}deg`) }))
    timers.push(animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: value => card.style.setProperty('--cursor-angle', `${355 * (value / 100) + 110}deg`) }))
    timers.push(animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0, onUpdate: value => card.style.setProperty('--edge-proximity', value), onEnd: () => card.classList.remove('sweep-active') }))
    return () => timers.forEach(window.clearTimeout)
  }, [animated])

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`border-glow-card ${className}`.trim()}
      style={{
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': `${borderRadius}px`,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...buildGlowVars(glowColor, glowIntensity),
        ...buildGradientVars(colors),
      }}
    >
      <span className="edge-light" />
      <div className="border-glow-inner">{children}</div>
    </div>
  )
}
