import type { Review } from '../data/products'
import { Stars } from './AnimatedSection'

export function Reviews({ items }: { items: Review[] }) {
  if (!items.length) return <p style={{ color: 'var(--muted)' }}>No reviews yet. Be the first after you train in it.</p>
  return (
    <div>
      {items.map((r) => (
        <article className="review" key={r.id}>
          <img src={r.avatar} alt="" />
          <div>
            <strong>{r.name}</strong> {r.verified && <span className="kicker">Verified</span>}
            <div>
              <Stars value={r.rating} />
            </div>
            <h3>{r.title}</h3>
            <p>{r.body}</p>
            <span style={{ color: 'var(--faint)', fontSize: 12 }}>{r.date}</span>
          </div>
        </article>
      ))}
    </div>
  )
}
