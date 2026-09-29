import { useEffect, useRef, useState } from 'react'
import { useReveal } from '../hooks/useReveal'
import './Stats.css'

const STATS = [
  { value: 10000, suffix: '+', label: 'Items reported' },
  { value: 6000, suffix: '+', label: 'Items recovered' },
  { value: 95, suffix: '%', label: 'Verified reports' },
  { value: 24, suffix: '/7', label: 'Accessible' },
]

export default function Stats() {
  const [ref, visible] = useReveal(0.4)

  return (
    <section className="stats" ref={ref}>
      <div className="stats__inner">
        {STATS.map((stat) => (
          <Counter key={stat.label} stat={stat} run={visible} />
        ))}
      </div>
    </section>
  )
}

function Counter({ stat, run }) {
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!run || started.current) return
    started.current = true
    const duration = 1400
    const start = performance.now()

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(stat.value * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [run, stat.value])

  return (
    <div className="stat">
      <span className="stat__value">
        {display.toLocaleString()}
        <span className="stat__suffix">{stat.suffix}</span>
      </span>
      <span className="stat__label">{stat.label}</span>
    </div>
  )
}
