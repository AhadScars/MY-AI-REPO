import { useEffect, useState, type RefObject } from 'react'

export function useScrollY() {
  const [y, setY] = useState(0)
  useEffect(() => {
    const onScroll = () => setY(window.scrollY)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return y
}

export function useElementProgress(ref: RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = el.offsetHeight - window.innerHeight
      const scrolled = -rect.top
      if (total <= 0) {
        setP(rect.top < window.innerHeight ? 1 : 0)
        return
      }
      setP(Math.min(1, Math.max(0, scrolled / total)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ref])
  return p
}
