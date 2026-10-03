import { useEffect, useState } from 'react'
import './GooeyNav.css'

export default function GooeyNav({
  items,
  initialActiveIndex = 0,
  activeIndex: controlledActiveIndex,
  onNavigate,
}) {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex)

  const selectItem = (index) => setActiveIndex(index)

  useEffect(() => {
    if (Number.isInteger(controlledActiveIndex)) setActiveIndex(controlledActiveIndex)
  }, [controlledActiveIndex])

  return (
    <div className="gooey-nav-container">
      <nav aria-label="主导航">
        <ul>
          {items.map((item, index) => (
            <li key={item.href} className={activeIndex === index ? 'active' : ''}>
              <a
                href={item.href}
                onClick={() => { selectItem(index); onNavigate?.() }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') selectItem(index)
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
