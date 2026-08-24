import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { categoryMeta, filterProducts, formatPrice } from '../data/products'
import { useStore } from '../context/StoreContext'

const popular = ['hoodie', 'leggings', 'whey', 'gloves', 'pre-workout']

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, recent, pushRecent } = useStore()
  const [q, setQ] = useState('')
  const results = useMemo(() => (q.trim().length ? filterProducts({ q }).slice(0, 8) : []), [q])

  const close = () => setSearchOpen(false)

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          className="search-ov"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="Search"
        >
          <div className="wrap">
            <header style={{ border: 0, padding: 0, marginBottom: 12 }}>
              <h2 className="display">Search the rack</h2>
              <button className="icon-btn" onClick={close} aria-label="Close search">
                <X />
              </button>
            </header>
            <form
              className="search-field"
              onSubmit={(e) => {
                e.preventDefault()
                pushRecent(q)
              }}
            >
              <Search size={22} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search apparel, kit, fuel…"
                aria-label="Search products"
              />
            </form>
            <div className="search-cols">
              <div>
                <p className="kicker">Popular</p>
                {popular.map((p) => (
                  <button key={p} className="nav__link" style={{ display: 'block' }} onClick={() => setQ(p)}>
                    {p}
                  </button>
                ))}
                {recent.length > 0 && (
                  <>
                    <p className="kicker" style={{ marginTop: 20 }}>
                      Recent
                    </p>
                    {recent.map((p) => (
                      <button key={p} className="nav__link" style={{ display: 'block' }} onClick={() => setQ(p)}>
                        {p}
                      </button>
                    ))}
                  </>
                )}
                <p className="kicker" style={{ marginTop: 20 }}>
                  Categories
                </p>
                {Object.entries(categoryMeta).map(([k, v]) => (
                  <Link key={k} to={v.href} className="nav__link" style={{ display: 'block' }} onClick={close}>
                    {v.label}
                  </Link>
                ))}
              </div>
              <div>
                {q && results.length === 0 && <p style={{ color: 'var(--muted)' }}>Nothing matches “{q}”.</p>}
                {results.map((p) => (
                  <Link key={p.id} to={`/product/${p.slug}`} className="search-hit" onClick={close}>
                    <img src={p.images[0]} alt="" />
                    <div>
                      <strong>{p.name}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>{p.category}</div>
                    </div>
                    <span>{formatPrice(p.price)}</span>
                  </Link>
                ))}
                {q && results.length > 0 && (
                  <Link to={`/shop?q=${encodeURIComponent(q)}`} className="btn btn--ghost" style={{ marginTop: 16 }} onClick={close}>
                    View all results
                  </Link>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
