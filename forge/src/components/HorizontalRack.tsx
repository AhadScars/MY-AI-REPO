import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, products } from '../data/products'
import { useElementProgress } from '../hooks/useScrollProgress'

export function HorizontalRack() {
  const ref = useRef<HTMLElement>(null)
  const p = useElementProgress(ref)
  const items = products.filter((x) => x.featured || x.badge === 'drop')

  return (
    <section className="hrack" ref={ref} aria-label="Featured rack">
      <div className="hrack__sticky">
        <div className="container hrack__head">
          <p className="kicker">Pinned collection</p>
          <h2 className="display">The rack</h2>
        </div>
        <div
          className="hrack__row"
          style={{ transform: `translate3d(${8 - p * 62}vw, 0, 0)` }}
        >
          {items.map((item) => (
            <Link key={item.id} to={`/product/${item.slug}`} className="hrack__card">
              <img src={item.images[0]} alt={item.name} />
              <div>
                <strong>{item.name}</strong>
                <span>{formatPrice(item.price)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
