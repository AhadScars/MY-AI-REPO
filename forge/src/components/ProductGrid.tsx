import { useEffect, useRef, useState } from 'react'
import type { Product } from '../data/products'
import { ProductCard } from './ProductCard'

export function ProductGrid({ items }: { items: Product[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!items.length) {
    return (
      <div className="empty">
        <p className="kicker">Empty rack</p>
        <h2 className="display">No pieces match.</h2>
        <p>Try clearing filters or search another term.</p>
      </div>
    )
  }

  return (
    <div className="pgrid stagger" ref={ref}>
      {items.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          style={{
            opacity: on ? 1 : 0,
            transform: on ? 'none' : 'translateY(28px)',
            transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${i * 0.07}s, transform 0.7s cubic-bezier(.22,1,.36,1) ${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  )
}
