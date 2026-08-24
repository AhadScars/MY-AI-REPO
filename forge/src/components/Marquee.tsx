import { useEffect, useRef } from 'react'

const PHRASES = ['TRAIN HARD', 'NO EXCUSES', 'STRONGER EVERY DAY', 'BUILT DIFFERENT', 'NO ZERO DAYS', 'FORGE AHEAD']

export function Marquee() {
  const track = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const speed = useRef(0.6)
  const dir = useRef(1)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - last
      last = y
      dir.current = delta >= 0 ? 1 : -1
      speed.current = Math.min(1.8, 0.55 + Math.abs(delta) * 0.02)
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    let raf = 0
    const loop = () => {
      const el = track.current
      if (el) {
        offset.current -= speed.current * dir.current
        const w = el.scrollWidth / 2
        if (offset.current <= -w) offset.current += w
        if (offset.current > 0) offset.current -= w
        el.style.transform = `translate3d(${offset.current}px,0,0)`
        speed.current += (0.55 - speed.current) * 0.04
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const items = [...PHRASES, ...PHRASES, ...PHRASES, ...PHRASES]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track" ref={track}>
        {items.map((p, i) => (
          <span key={`${p}-${i}`}>
            {i % 2 === 0 ? p : <b>{p}</b>} ·
          </span>
        ))}
      </div>
    </div>
  )
}
