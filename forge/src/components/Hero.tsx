import { MagneticButton } from './MagneticButton'
import { useScrollY } from '../hooks/useScrollProgress'

export function Hero() {
  const y = useScrollY()
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const scale = reduced ? 1 : 1 + Math.min(y, 700) / 2800
  const shift = reduced ? 0 : Math.min(y, 500) * 0.12

  return (
    <section className="hero">
      <div className="hero__media" style={{ transform: `scale(${scale})` }}>
        <img src="/images/hero.jpg" alt="Athlete mid-deadlift in a dark industrial gym" />
      </div>
      <div className="hero__veil" />
      <div className="hero__copy" style={{ transform: `translate3d(${-shift}px,0,0)` }}>
        <p className="kicker">Performance lab · Est. 2024</p>
        <h1 className="display">
          <span>
            <em>Built to</em>
          </span>
          <span>
            <em>Outperform</em>
          </span>
        </h1>
        <p>Apparel, fuel, and hardware engineered for athletes who treat every session like a test. Train hard. Live strong.</p>
        <div className="hero__cta">
          <MagneticButton to="/shop/men">Shop men</MagneticButton>
          <MagneticButton to="/shop/women" variant="ghost">
            Shop women
          </MagneticButton>
          <MagneticButton to="/shop" variant="dark">
            Explore collection
          </MagneticButton>
        </div>
      </div>
      <div className="scroll-ind">
        Scroll
        <i />
      </div>
    </section>
  )
}
