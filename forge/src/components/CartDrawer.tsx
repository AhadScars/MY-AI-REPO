import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatPrice, FREE_SHIPPING, getProductById } from '../data/products'
import { useStore } from '../context/StoreContext'

export function CartDrawer() {
  const {
    cartOpen,
    setCartOpen,
    cart,
    updateQty,
    removeFromCart,
    cartSubtotal,
    shippingLeft,
    discount,
    discountCode,
    applyCode,
  } = useStore()

  const discounted = Math.round(cartSubtotal * (1 - discount))
  const ship = discounted >= FREE_SHIPPING || discounted === 0 ? 0 : 149
  const total = discounted + ship
  const progress = Math.min(100, (cartSubtotal / FREE_SHIPPING) * 100)

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            className="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            aria-label="Shopping cart"
          >
            <header>
              <h2 className="display">Your kit</h2>
              <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close cart">
                <X size={20} />
              </button>
            </header>
            <div className="drawer__body">
              <div className="ship-bar">
                <p className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {shippingLeft === 0
                    ? 'Free shipping unlocked'
                    : `Add ${formatPrice(shippingLeft)} more for FREE SHIPPING`}
                </p>
                <div className="track">
                  <div className="fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              {cart.length === 0 && <p style={{ color: 'var(--muted)' }}>Your cart is empty. Load it.</p>}
              {cart.map((line) => {
                const p = getProductById(line.productId)
                if (!p) return null
                return (
                  <div className="cline" key={line.key}>
                    <img src={p.images[0]} alt="" />
                    <div>
                      <strong>{p.name}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {line.color} · {line.size}
                      </div>
                      <div className="qty" style={{ marginTop: 8 }}>
                        <button onClick={() => updateQty(line.key, line.qty - 1)} aria-label="Decrease">
                          <Minus size={12} />
                        </button>
                        <span>{line.qty}</span>
                        <button onClick={() => updateQty(line.key, line.qty + 1)} aria-label="Increase">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{formatPrice(p.price * line.qty)}</div>
                      <button
                        onClick={() => removeFromCart(line.key)}
                        style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <footer>
              <CodeField applied={discountCode} onApply={applyCode} />
              <div className="totals">
                <span>Subtotal</span>
                <span>{formatPrice(cartSubtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="totals">
                  <span>Discount ({discountCode})</span>
                  <span>-{formatPrice(cartSubtotal - discounted)}</span>
                </div>
              )}
              <div className="totals">
                <span>Shipping</span>
                <span>{ship === 0 ? 'Free' : formatPrice(ship)}</span>
              </div>
              <div className="totals big">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Link to="/checkout" className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setCartOpen(false)}>
                Checkout
              </Link>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function CodeField({ applied, onApply }: { applied: string; onApply: (c: string) => boolean }) {
  const [code, setCode] = useState(applied)
  return (
    <form
      className="code-row"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(code)
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Discount code · FORGE10"
        aria-label="Discount code"
      />
      <button className="btn btn--dark" type="submit">
        Apply
      </button>
    </form>
  )
}
