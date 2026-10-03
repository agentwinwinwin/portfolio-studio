import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import './Stack.css'

const makeRotation = (index) => {
  const rotations = [-4.2, 3.1, -2.4, 4.6, -3.4, 2.2]
  return rotations[index % rotations.length]
}

export default function Stack({
  randomRotation = true,
  sensitivity = 170,
  sendToBackOnClick = true,
  cards = [],
  animationConfig = { stiffness: 250, damping: 28 },
  autoplay = true,
  autoplayDelay = 3200,
  pauseOnHover = true,
}) {
  const reduceMotion = useReducedMotion()
  const [stack, setStack] = useState(() => cards.map((content, index) => ({
    id: index,
    content,
    rotation: randomRotation ? makeRotation(index) : 0,
  })))
  const [isHovered, setIsHovered] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    setStack(cards.map((content, index) => ({
      id: index,
      content,
      rotation: randomRotation ? makeRotation(index) : 0,
    })))
  }, [cards, randomRotation])

  const moveFrontToBack = () => {
    setStack(current => current.length > 1 ? [...current.slice(1), current[0]] : current)
  }

  useEffect(() => {
    if (!autoplay || reduceMotion || stack.length < 2 || (pauseOnHover && isHovered)) return undefined
    const interval = window.setInterval(moveFrontToBack, autoplayDelay)
    return () => window.clearInterval(interval)
  }, [autoplay, autoplayDelay, isHovered, pauseOnHover, reduceMotion, stack.length])

  const ordered = useMemo(() => stack.map((card, position) => ({ ...card, position })), [stack])

  return (
    <div
      className="stack-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="可拖拽的黑猫照片堆叠"
    >
      {ordered.map(({ id, content, rotation, position }) => {
        const isFront = position === 0
        return (
          <motion.div
            className="stack-card-shell"
            key={id}
            style={{ zIndex: stack.length - position }}
            animate={{
              rotate: rotation,
              scale: 1 - position * 0.035,
              x: position * 11,
              y: position * 13,
              opacity: position > 3 ? 0 : 1,
            }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', ...animationConfig }}
            drag={isFront && !reduceMotion}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.62}
            onDragStart={(_, info) => { dragStart.current = info.point }}
            onDragEnd={(_, info) => {
              const distance = Math.hypot(
                info.point.x - dragStart.current.x,
                info.point.y - dragStart.current.y,
              )
              if (distance > sensitivity) moveFrontToBack()
            }}
            onClick={() => {
              if (isFront && sendToBackOnClick) moveFrontToBack()
            }}
            role={isFront ? 'button' : undefined}
            tabIndex={isFront ? 0 : -1}
            onKeyDown={(event) => {
              if (isFront && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                moveFrontToBack()
              }
            }}
            aria-label={isFront ? '查看下一张照片' : undefined}
          >
            <div className="stack-card">{content}</div>
          </motion.div>
        )
      })}
    </div>
  )
}
