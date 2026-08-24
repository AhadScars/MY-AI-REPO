import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Sparkles, Truck, CreditCard, RotateCcw } from 'lucide-react'
import { CategoryCard } from '../components/CategoryCard'
import { HorizontalRack } from '../components/HorizontalRack'
import { CountdownTimer } from '../components/CountdownTimer'
import { Hero } from '../components/Hero'
import { MagneticButton } from '../components/MagneticButton'
import { Marquee } from '../components/Marquee'
import { Newsletter } from '../components/Newsletter'
import { ProductGrid } from '../components/ProductGrid'
import { Testimonials } from '../components/Testimonials'
import {
  communityPosts,
  formatPrice,
  getProduct,
  GOALS,
  goalMeta,
  products,
  type Goal,
} from '../data/products'
import { useElementProgress } from '../hooks/useScrollProgress'
import { useInView } from '../hooks/useInView'

const benefits = [
  { icon: Sparkles, title: 'Premium quality', copy: 'Heavyweight knits, bonded seams, hardware that lasts a cycle — not a weekend.' },
  { icon: ShieldCheck, title: 'Performance materials', copy: 'Four-way stretch, cool-touch, squat-proof density. Tested under load.' },
  { icon: Truck, title: 'Fast shipping', copy: 'Metros in 2–4 days. Free over ₹2,499. Tracked every step.' },
  { icon: CreditCard, title: 'Secure payments', copy: 'UPI, cards, and COD. Encrypted checkout. No surprises.' },
  { icon: RotateCcw, title: 'Easy returns', copy: '14 days on unused kit. Limited drops are final unless defective.' },
]

export function Home() {
  const trending = products.filter((p) => p.trending).slice(0, 8)
  const drop = getProduct('shadow-volt-hoodie')!
  const dropEnd = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 6)
    d.setHours(21, 0, 0, 0)
    return d
  }, [])

  return (
    <div className="page">
      <Hero />
      <Marquee />
      <section className="section">
        <div className="container">
          <div className="section__head">
            <div>
              <p className="kicker">The floor</p>
              <h2 className="display">Shop the kit</h2>
            </div>
            <p>Five rooms. One standard. Choose your lane and load the cart.</p>
          </div>
          <div className="cat-grid">
            <CategoryCard id="men" />
            <CategoryCard id="women" />
            <CategoryCard id="accessories" />
            <CategoryCard id="supplements" />
            <CategoryCard id="equipment" />
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#090909' }}>
        <div className="container">
          <div className="section__head">
            <div>
              <p className="kicker">Moving now</p>
              <h2 className="display">Trending now</h2>
            </div>
            <Link to="/shop" className="btn btn--ghost">
              View all
            </Link>
          </div>
          <ProductGrid items={trending} />
        </div>
      </section>

      <HorizontalRack />

      <ShopByGoal />

      <WhyUs />

      <section className="drop">
        <img className="bg" src="/images/drop-hoodie.jpg" alt="" />
        <div className="drop__veil" />
        <div className="drop__copy">
          <p className="kicker">Limited drop · 500 units</p>
          <h2 className="display">Shadow Volt</h2>
          <p style={{ maxWidth: 420, color: '#d4d4d4', marginBottom: 8 }}>
            Numbered heavyweight hoodie. Metallic volt graphic. When the timer dies, so does the stock.
          </p>
          <p style={{ marginBottom: 4 }}>{formatPrice(drop.price)} <s style={{ color: 'var(--faint)' }}>{formatPrice(drop.compareAt!)}</s></p>
          <CountdownTimer until={dropEnd} />
          <MagneticButton to={`/product/${drop.slug}`}>Claim the drop</MagneticButton>
        </div>
      </section>

      <Marquee />

      <section className="section" id="community">
        <div className="container">
          <div className="section__head">
            <div>
              <p className="kicker">The floor is public</p>
              <h2 className="display">Fitness community</h2>
            </div>
            <p>Transformations, sessions, and the people who actually use the kit.</p>
          </div>
          <div className="community-grid">
            <div className="ugc">
              {communityPosts.map((c) => (
                <article key={c.id}>
                  <img src={c.image} alt="" loading="lazy" />
                  <div className="cap">
                    <strong>{c.handle}</strong>
                    <div>{c.caption}</div>
                  </div>
                </article>
              ))}
            </div>
            <Testimonials />
          </div>
        </div>
      </section>

      <Newsletter />
    </div>
  )
}

function ShopByGoal() {
  const wrap = useRef<HTMLElement>(null)
  const p = useElementProgress(wrap)
  const index = Math.min(GOALS.length - 1, Math.floor(p * GOALS.length + 0.001))
  const goal = GOALS[index] as Goal
  const meta = goalMeta[goal]
  const related = products.filter((x) => x.goals.includes(goal)).slice(0, 4)

  return (
    <section className="goals" ref={wrap} aria-label="Shop by goal">
      <div className="goals__sticky">
        <div className="goals__visual">
          {GOALS.map((g) => (
            <img
              key={g}
              src={goalMeta[g].image}
              alt=""
              style={{
                opacity: g === goal ? 1 : 0,
                transform: g === goal ? 'scale(1.04)' : 'scale(1.12)',
              }}
            />
          ))}
        </div>
        <div className="goals__panel">
          <p className="kicker">{meta.kicker}</p>
          <h2 className="display">{meta.label}</h2>
          <p>{meta.copy}</p>
          <div className="goals__dots">
            {GOALS.map((g, i) => (
              <button key={g} className={g === goal ? 'is-on' : ''} type="button">
                <i /> 0{i + 1} {goalMeta[g].label}
              </button>
            ))}
          </div>
          <div className="goals__prods">
            {related.map((item) => (
              <Link key={item.id} to={`/product/${item.slug}`} className="mini-prod">
                <img src={item.images[0]} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatPrice(item.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function WhyUs() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="section why" id="why">
      <div className="container why-grid" ref={ref}>
        <div>
          <p className="kicker">The standard</p>
          <h2 className="display">Why train with us?</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 460 }}>
            FORGE is not a logo on a blank tee. Every piece is cut for output — then stress-tested by athletes who do not do easy weeks.
          </p>
          <div className="benefits">
            {benefits.map((b) => (
              <div className="benefit" key={b.title}>
                <b.icon size={22} />
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="stats">
          <Stat on={inView} to={50} suffix="K+" label="Athletes" />
          <Stat on={inView} to={100} suffix="K+" label="Orders" />
          <Stat on={inView} to={4.9} suffix="/5" label="Rating" decimals />
          <Stat on={inView} to={24} suffix="/7" label="Support" />
        </div>
      </div>
    </section>
  )
}

function Stat({
  on,
  to,
  suffix,
  label,
  decimals,
}: {
  on: boolean
  to: number
  suffix: string
  label: string
  decimals?: boolean
}) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setN(to)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1400)
      const eased = 1 - Math.pow(1 - k, 3)
      setN(to * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, to])

  return (
    <div className="stat">
      <b>
        {decimals ? n.toFixed(1) : Math.round(n)}
        {suffix}
      </b>
      <span>{label}</span>
    </div>
  )
}
