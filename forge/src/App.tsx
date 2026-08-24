import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { Navbar } from './components/Navbar'
import { SearchOverlay } from './components/SearchOverlay'
import { useStore } from './context/StoreContext'
import { useLenis } from './hooks/useLenis'
import { Account } from './pages/Account'
import { Checkout } from './pages/Checkout'
import { Home } from './pages/Home'
import { Product } from './pages/Product'
import { Shop } from './pages/Shop'
import { Legal } from './pages/Legal'
import { Wishlist } from './pages/Wishlist'

export default function App() {
  useLenis()
  const { pathname } = useLocation()
  const { toasts, setMobileOpen, setSearchOpen } = useStore()

  useEffect(() => {
    window.scrollTo(0, 0)
    setMobileOpen(false)
    setSearchOpen(false)
  }, [pathname, setMobileOpen, setSearchOpen])

  return (
    <div className="app">
      <Navbar />
      <SearchOverlay />
      <CartDrawer />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:category" element={<Shop />} />
            <Route path="/product/:slug" element={<Product />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/account" element={<Account />} />
            <Route path="/legal/:slug" element={<Legal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
      <Footer />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'warn' ? 'warn' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
