import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { categoryMeta, products } from '../data/products'
import { useStore } from '../context/StoreContext'
import { useScrollY } from '../hooks/useScrollProgress'
import { Logo } from './Logo'

const links = [
  { to: '/shop/men', label: 'Men', key: 'men' },
  { to: '/shop/women', label: 'Women', key: 'women' },
  { to: '/shop/accessories', label: 'Accessories', key: 'accessories' },
  { to: '/shop/supplements', label: 'Supplements', key: 'supplements' },
  { to: '/shop/equipment', label: 'Equipment', key: 'equipment' },
  { to: '/shop/new', label: 'New drops', key: 'new', cls: 'nav__link--new' },
  { to: '/shop/sale', label: 'Sale', key: 'sale', cls: 'nav__link--hot' },
]

export function Navbar() {
  const y = useScrollY()
  const { pathname } = useLocation()
  const solid = y > 40 || pathname !== '/'
  const { cartCount, wishlist, setSearchOpen, setCartOpen, mobileOpen, setMobileOpen } = useStore()
  const [mega, setMega] = useState<string | null>(null)

  return (
    <>
      <header className={`nav ${solid ? 'is-solid' : ''}`}>
        <div className="nav__inner">
          <Logo />
          <nav className="nav__links" aria-label="Primary" onMouseLeave={() => setMega(null)}>
            {links.map((l) => (
              <NavLink
                key={l.key}
                to={l.to}
                className={({ isActive }) => `nav__link ${l.cls ?? ''} ${isActive ? 'is-on' : ''}`}
                onMouseEnter={() => setMega(['men', 'women'].includes(l.key) ? l.key : null)}
              >
                {l.label}
              </NavLink>
            ))}
            <AnimatePresence>
              {mega && (
                <motion.div
                  className="mega"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                >
                  <div className="mega__cols">
                    {Object.values(categoryMeta).map((c) => (
                      <Link key={c.href} to={c.href} className="mini" onClick={() => setMega(null)}>
                        <strong>{c.label}</strong>
                        <span>{c.blurb}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="mega__feat">
                    {products
                      .filter((p) => p.gender === mega || p.category === mega)
                      .slice(0, 2)
                      .map((p) => (
                        <Link key={p.id} to={`/product/${p.slug}`} className="mega__card" onClick={() => setMega(null)}>
                          <img src={p.images[0]} alt={p.name} />
                          <span>{p.name}</span>
                        </Link>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
          <div className="nav__actions">
            <button className="icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
              <Search size={18} />
            </button>
            <Link to="/account" className="icon-btn" aria-label="Account">
              <User size={18} />
            </Link>
            <Link to="/wishlist" className="icon-btn" aria-label="Wishlist">
              <Heart size={18} />
              {wishlist.length > 0 && <span className="badge">{wishlist.length}</span>}
            </Link>
            <button className="icon-btn" aria-label="Cart" onClick={() => setCartOpen(true)}>
              <ShoppingBag size={18} />
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </button>
            <button
              className="icon-btn nav__burger"
              aria-label="Menu"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            className="mnav"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {links.map((l) => (
              <Link key={l.key} to={l.to} onClick={() => setMobileOpen(false)}>
                {l.label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
