import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { useStore } from '../context/StoreContext'

export function Footer() {
  const { toast } = useStore()
  const [email, setEmail] = useState('')

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <Logo />
          <p className="brand">
            Performance apparel, fuel, and hardware for athletes who treat the floor like a proving ground.
          </p>
          <div className="socials">
            <a className="icon-btn" href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
              </svg>
            </a>
            <a className="icon-btn" href="https://youtube.com" aria-label="YouTube" target="_blank" rel="noreferrer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12.2s0-3.2-.4-4.6c-.2-.8-.9-1.5-1.7-1.7C18.4 5.5 12 5.5 12 5.5s-6.4 0-7.9.4c-.8.2-1.5.9-1.7 1.7C2 9 2 12.2 2 12.2s0 3.2.4 4.6c.2.8.9 1.5 1.7 1.7 1.5.4 7.9.4 7.9.4s6.4 0 7.9-.4c.8-.2 1.5-.9 1.7-1.7.4-1.4.4-4.6.4-4.6zM10 15.2V9.2l5.2 3-5.2 3z" />
              </svg>
            </a>
            <a className="icon-btn" href="https://x.com" aria-label="X" target="_blank" rel="noreferrer">
              𝕏
            </a>
          </div>
        </div>
        <div>
          <h4>Shop</h4>
          <Link to="/shop/men">Men</Link>
          <Link to="/shop/women">Women</Link>
          <Link to="/shop/accessories">Accessories</Link>
          <Link to="/shop/supplements">Supplements</Link>
          <Link to="/shop/equipment">Equipment</Link>
          <Link to="/shop/new">New drops</Link>
          <Link to="/shop/sale">Sale</Link>
        </div>
        <div>
          <h4>Support</h4>
          <Link to="/account">Account</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/legal/shipping">Shipping</Link>
          <Link to="/legal/returns">Returns</Link>
          <Link to="/checkout">Checkout</Link>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#why">Why FORGE</a>
          <a href="#community">Community</a>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/terms">Terms</Link>
        </div>
        <div>
          <h4>Join the list</h4>
          <form
            className="foot-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (email.includes('@')) {
                toast('You’re on the movement list.')
                setEmail('')
              }
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              aria-label="Email"
            />
            <button className="btn" type="submit">
              Join
            </button>
          </form>
          <div className="payrow" aria-label="Payment methods">
            {['UPI', 'VISA', 'MASTERCARD', 'RUPAY', 'COD'].map((p) => (
              <span className="pay" key={p}>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer__base">
        <span>© {new Date().getFullYear()} FORGE Athletics. All rights reserved.</span>
        <span>Free shipping over ₹2,499 · 14-day returns · Ships pan-India</span>
      </div>
    </footer>
  )
}
