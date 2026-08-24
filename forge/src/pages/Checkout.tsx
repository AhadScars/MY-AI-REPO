import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, FREE_SHIPPING, getProductById } from '../data/products'
import { useStore } from '../context/StoreContext'
import { MagneticButton } from '../components/MagneticButton'

export function Checkout() {
  const { cart, cartSubtotal, discount, discountCode, applyCode, clearCart } = useStore()
  const [done, setDone] = useState(false)
  const [code, setCode] = useState(discountCode)
  const discounted = Math.round(cartSubtotal * (1 - discount))
  const ship = discounted >= FREE_SHIPPING || discounted === 0 ? 0 : 149
  const total = discounted + ship

  if (done) {
    return (
      <div className="container success page">
        <p className="kicker">Order locked</p>
        <h1 className="display">You’re in the fight.</h1>
        <p style={{ color: 'var(--muted)', maxWidth: 420, margin: '0 auto 24px' }}>
          A confirmation is on its way. This is a demo checkout — no payment was captured.
        </p>
        <Link to="/shop" className="btn">
          Keep training
        </Link>
      </div>
    )
  }

  return (
    <div className="container checkout page">
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault()
          if (!cart.length) return
          clearCart()
          setDone(true)
        }}
      >
        <h2 className="display">Checkout</h2>
        <p className="kicker" style={{ marginBottom: 16 }}>
          Encrypted · UPI / cards / COD
        </p>
        <div className="fields">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required placeholder="you@forge.fit" />
          </div>
          <div className="fields two">
            <div className="field">
              <label htmlFor="fn">First name</label>
              <input id="fn" required />
            </div>
            <div className="field">
              <label htmlFor="ln">Last name</label>
              <input id="ln" required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="addr">Address</label>
            <input id="addr" required placeholder="Street, area" />
          </div>
          <div className="fields two">
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" required />
            </div>
            <div className="field">
              <label htmlFor="pin">PIN</label>
              <input id="pin" required pattern="[0-9]{6}" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" required type="tel" />
          </div>
          <div className="field">
            <label htmlFor="pay">Payment</label>
            <select id="pay" defaultValue="upi">
              <option value="upi">UPI</option>
              <option value="card">Credit / debit card</option>
              <option value="cod">Cash on delivery</option>
            </select>
          </div>
        </div>
        <MagneticButton type="submit" style={{ width: '100%', marginTop: 20 }} disabled={!cart.length}>
          Place order · {formatPrice(total)}
        </MagneticButton>
      </form>

      <aside className="panel">
        <h2 className="display">Bag</h2>
        {cart.length === 0 && (
          <p>
            Nothing here. <Link to="/shop">Load the rack.</Link>
          </p>
        )}
        {cart.map((line) => {
          const p = getProductById(line.productId)
          if (!p) return null
          return (
            <div className="cline" key={line.key}>
              <img src={p.images[0]} alt="" />
              <div>
                <strong>{p.name}</strong>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {line.color} · {line.size} · ×{line.qty}
                </div>
              </div>
              <div>{formatPrice(p.price * line.qty)}</div>
            </div>
          )
        })}
        <form
          className="code-row"
          style={{ marginTop: 16 }}
          onSubmit={(e) => {
            e.preventDefault()
            applyCode(code)
          }}
        >
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FORGE10 / VOLT15" />
          <button className="btn btn--dark" type="submit">
            Apply
          </button>
        </form>
        <div className="totals">
          <span>Subtotal</span>
          <span>{formatPrice(cartSubtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="totals">
            <span>Discount</span>
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
      </aside>
    </div>
  )
}
