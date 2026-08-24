import { useEffect, useRef, useState } from 'react'

export function useInView<T extends HTMLElement>(opts?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.unobserve(el)
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px', ...opts },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [opts])

  return { ref, inView }
}
